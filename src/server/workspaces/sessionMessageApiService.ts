import { isInstructionAwarenessQuestion, PUBLIC_TEACHING_CONTRACT_SUMMARY } from "../tutor/teachingContract";
import { classifyTutorRequest } from "../tutor/requestClassifier";
import {
  buildArtifactAwareFileInventory,
  buildFileInventory,
  formatArtifactAwareFileInventoryResponse,
  formatFileInventoryResponse,
} from "../tutor/fileInventoryService";
import { listFileChunks as defaultListFileChunks } from "./fileChunkRepository";
import {
  getDocumentOutline as defaultGetDocumentOutline,
  listDetectedQuestions as defaultListDetectedQuestions,
  listDocumentPages as defaultListDocumentPages,
} from "./documentArtifactRepository";
import { getMockTutorResponse as defaultGetMockTutorResponse } from "../../lib/tutor";
import { getActiveTutorProvider } from "../tutor/providerRegistry";
import type { ConversationTurn, TutorGroundingContext } from "../tutor/schemas";
import type { AuthenticatedUser } from "../auth/authTypes";
import {
  appendMessage as defaultAppendMessage,
  listSessionMessages as defaultListSessionMessages,
} from "./messageRepository";
import {
  getUploadedFile as defaultGetUploadedFile,
  listUploadedFiles as defaultListUploadedFiles,
} from "./uploadedFileRepository";
import type { PostMessageApiResponse, PostMessageRequest } from "./sessionMessageApiSchemas";
import { serializeMessage } from "./sessionMessageApiSchemas";
import { getSession as defaultGetSession } from "./sessionRepository";
import { getWorkspace as defaultGetWorkspace } from "./workspaceRepository";
import { writeDecisionLogEntry as defaultWriteDecisionLogEntry } from "./decisionLogRepository";
import { learnerMemoryApiService as defaultLearnerMemoryApiService } from "./learnerMemoryApiService";
import type { MessageRecord } from "./workspaceTypes";
import type { DecisionLogEvent } from "../tutor/schemas";
import type { DecisionLogEntry } from "../../types";
import type { TutorBoundaryResponse } from "../tutor/schemas";
import { decideRetrievalBoundary } from "../tutor/retrievalDecisionBoundary";
import type { CostMode, RetrievalBoundaryDecision, RetrievalScope, WorkMode } from "../../types";
import { webSearchProvider as defaultWebSearchProvider } from "../tutor/webSearchProvider";
import {
  retrieveRelevantFileChunks as defaultRetrieveFileChunks,
} from "./fileChunkRetrievalService";
import type { FileChunkRetrievalInput, FileChunkRetrievalResult, RetrievedFileChunk } from "./fileChunkRetrievalService";

// Maximum number of previous turns to include as context for the AI provider.
// Each "turn" is one message (user or tutor). 20 = 10 exchanges.
const MAX_HISTORY_TURNS = 20;

// Phase 8 metadata-only indexing wrote this placeholder as summaryText for all files.
// It has no informational value and must not be injected into the tutor grounding context.
const LEGACY_SUMMARY_PLACEHOLDER = "Summary placeholder; content extraction not enabled yet.";

export interface SessionMessageApiService {
  listMessagesForUser(
    user: AuthenticatedUser | string,
    workspaceId: string,
    sessionId: string
  ): Promise<MessageRecord[]>;

  sendMessageForUser(
    user: AuthenticatedUser | string,
    sessionId: string,
    input: PostMessageRequest
  ): Promise<PostMessageApiResponse>;
}

interface Repositories {
  getWorkspace: typeof defaultGetWorkspace;
  getSession: typeof defaultGetSession;
  listSessionMessages: typeof defaultListSessionMessages;
  appendMessage: typeof defaultAppendMessage;
  getUploadedFile: typeof defaultGetUploadedFile;
  listUploadedFiles: typeof defaultListUploadedFiles;
  listFileChunks: typeof defaultListFileChunks;
  listDocumentPages: typeof defaultListDocumentPages;
  getDocumentOutline: typeof defaultGetDocumentOutline;
  listDetectedQuestions: typeof defaultListDetectedQuestions;
  writeDecisionLogEntry: typeof defaultWriteDecisionLogEntry;
  processMemoryCandidate: typeof defaultLearnerMemoryApiService.processMemoryCandidate;
  webSearchProvider: typeof defaultWebSearchProvider;
  retrieveFileChunks: (input: FileChunkRetrievalInput) => Promise<FileChunkRetrievalResult>;
  getMockTutorResponse: (
    message: string,
    workMode: Parameters<typeof defaultGetMockTutorResponse>[1],
    costMode: Parameters<typeof defaultGetMockTutorResponse>[2],
    conversationHistory?: ConversationTurn[],
    groundingContext?: TutorGroundingContext
  ) => Promise<TutorBoundaryResponse>;
}

function defaultGetTutorResponse(
  message: string,
  workMode: Parameters<typeof defaultGetMockTutorResponse>[1],
  costMode: Parameters<typeof defaultGetMockTutorResponse>[2],
  conversationHistory?: ConversationTurn[],
  groundingContext?: TutorGroundingContext
): ReturnType<typeof defaultGetMockTutorResponse> {
  const provider = getActiveTutorProvider();
  return provider.call({
    userId: "session-service",
    workspaceId: "session-service",
    message,
    workMode,
    costMode,
    conversationHistory,
    groundingContext,
  }) as ReturnType<typeof defaultGetMockTutorResponse>;
}

function defaultRepositories(): Repositories {
  return {
    getWorkspace: defaultGetWorkspace,
    getSession: defaultGetSession,
    listSessionMessages: defaultListSessionMessages,
    appendMessage: defaultAppendMessage,
    getUploadedFile: defaultGetUploadedFile,
    listUploadedFiles: defaultListUploadedFiles,
    listFileChunks: defaultListFileChunks,
    listDocumentPages: defaultListDocumentPages,
    getDocumentOutline: defaultGetDocumentOutline,
    listDetectedQuestions: defaultListDetectedQuestions,
    writeDecisionLogEntry: defaultWriteDecisionLogEntry,
    processMemoryCandidate: defaultLearnerMemoryApiService.processMemoryCandidate,
    webSearchProvider: defaultWebSearchProvider,
    retrieveFileChunks: defaultRetrieveFileChunks,
    getMockTutorResponse: defaultGetTutorResponse,
  };
}

export function createSessionMessageApiService(
  repositories: Repositories = defaultRepositories()
): SessionMessageApiService {
  return {
    async listMessagesForUser(user, workspaceId, sessionId) {
      const userId = resolveTrustedUserId(user);

      const workspace = await repositories.getWorkspace(userId, workspaceId);
      if (!workspace) throw new Error("Workspace not found.");

      const session = await repositories.getSession(userId, workspaceId, sessionId);
      if (!session) throw new Error("Session not found.");

      return repositories.listSessionMessages(userId, workspaceId, sessionId);
    },

    async sendMessageForUser(user, sessionId, input) {
      const userId = resolveTrustedUserId(user);

      const workspace = await repositories.getWorkspace(userId, input.workspaceId);
      if (!workspace) throw new Error("Workspace not found.");

      const session = await repositories.getSession(userId, input.workspaceId, sessionId);
      if (!session) throw new Error("Session not found.");

      const attachedFileIds = await validateAttachedFileIds(
        repositories,
        userId,
        input.workspaceId,
        input.attachedFileIds
      );

      // Fetch existing messages BEFORE appending the current user message,
      // so history only includes previous turns.
      const existingMessages = await repositories.listSessionMessages(userId, input.workspaceId, sessionId);
      const conversationHistory: ConversationTurn[] = existingMessages
        .slice(-MAX_HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content }));

      const userRecord = await repositories.appendMessage(userId, input.workspaceId, sessionId, {
        role: "user",
        content: input.userMessage,
        attachedFileIds,
      });

      // Deterministic instruction-awareness: if the user asks how the tutor is supposed to teach,
      // return the public teaching contract summary without calling the LLM provider.
      if (isInstructionAwarenessQuestion(input.userMessage)) {
        const assistantRecord = await repositories.appendMessage(userId, input.workspaceId, sessionId, {
          role: "tutor",
          content: PUBLIC_TEACHING_CONTRACT_SUMMARY,
        });
        return {
          userMessage: serializeMessage(userRecord),
          assistantMessage: serializeMessage(assistantRecord),
          internalUpdate: {
            detected_intent: "user_preference",
            confidence: 1.0,
            should_stop_progression: false,
            local_question: { detected: false, reason: "" },
            retrieval: { used: false, scope: "none", source_ids: [], why: "instruction_awareness_shortcut" },
            retrieval_decision: { needs_retrieval: false, retrieval_scope: "none", max_chunks: 0, max_tokens: 0, should_ask_clarification_first: false },
            learner_memory_update: { needed: false, update_type: "none", memory_type: "none", content: "", confidence: 0 },
            knowledge_base_action: { needed: false, action: "none", confidence: 0, requires_user_confirmation: false },
            decision_log_entries: [],
          },
        };
      }

      // Classify request intent before calling the model.
      // This prevents the model from mishandling file-related meta-questions using training-data defaults.
      const requestClassification = classifyTutorRequest(input.userMessage);

      // Deterministic file-access status: "can you see/access the file?"
      // Answered from real Firestore state — model NOT called.
      if (requestClassification.intent === "file_access_status") {
        const files = await repositories.listUploadedFiles(userId, input.workspaceId);
        const readyFiles = files.filter(
          (f) => f.extractionStatus === "completed" && f.chunkingStatus === "completed"
        );
        const processingFiles = files.filter(
          (f) =>
            f.extractionStatus === "pending" ||
            f.chunkingStatus === "pending" ||
            f.extractionStatus === "not_started" ||
            f.chunkingStatus === "not_started"
        );

        let content: string;
        if (readyFiles.length > 0) {
          const fileList = readyFiles
            .map((f) => `• ${f.originalFileName ?? f.name}`)
            .join("\n");
          content = `כן, אני יכול להשתמש בטקסט שחולץ מהקבצים הבאים:\n${fileList}\n\nשאל אותי שאלה על התוכן ואני אענה מהחומר שחולץ.\n\nהערה: כרגע אני לא מנתח חזותית גרפים, מעגלים, או תרשימים. ניתוח חזותי יתווסף בשלב נפרד.`;
        } else if (processingFiles.length > 0) {
          content = `הקובץ עדיין בעיבוד — חילוץ טקסט, יצירת צ׳אנקים, או embeddings. המתן כמה שניות ונסה שוב.`;
        } else if (files.length > 0) {
          content = `הקבצים שהועלו טרם הסתיים עיבודם. ייתכן שקרתה שגיאה בעיבוד — בדוק את סטטוס הקבצים ונסה להעלות מחדש אם נדרש.`;
        } else {
          content = `לא נמצאו קבצים שהועלו למרחב הלימוד הנוכחי. העלה קובץ PDF או DOCX כדי שאוכל לעבוד עם התוכן.`;
        }

        const assistantRecord = await repositories.appendMessage(userId, input.workspaceId, sessionId, {
          role: "tutor",
          content,
        });
        return makeDeterministicReturn(userRecord, assistantRecord, "file_access_awareness_shortcut");
      }

      // Deterministic file-content inventory: "which questions/exercises are in the file?"
      // Model NOT called. Answers from real chunk text via buildFileInventory().
      if (requestClassification.intent === "file_content_inventory") {
        const files = await repositories.listUploadedFiles(userId, input.workspaceId);
        const readyFile = files.find(
          (f) => f.extractionStatus === "completed" && f.chunkingStatus === "completed"
        );

        let content: string;
        if (readyFile) {
          const artifactAwareContent = await maybeBuildArtifactAwareInventoryContent(
            repositories,
            userId,
            readyFile
          );

          if (artifactAwareContent) {
            content = artifactAwareContent;
          } else {
            const chunks = await repositories.listFileChunks(userId, input.workspaceId, readyFile.id);
            const inventory = buildFileInventory(readyFile.originalFileName ?? readyFile.name, chunks);
            content = formatFileInventoryResponse(inventory);
          }
        } else if (files.length > 0) {
          const fileStatuses = files
            .map((f) => {
              const ext = f.extractionStatus ?? "not_started";
              const chk = f.chunkingStatus ?? "not_started";
              return `• ${f.originalFileName ?? f.name}: חילוץ=${ext}, צ׳אנקים=${chk}`;
            })
            .join("\n");
          content = `הקבצים הבאים עדיין בעיבוד — לא ניתן לתת רשימת שאלות עדיין:\n${fileStatuses}\n\nהמתן שהעיבוד יסתיים ונסה שוב.`;
        } else {
          content =
            "לא נמצאו קבצים שהועלו למרחב הלימוד הנוכחי. העלה קובץ PDF או DOCX כדי שאוכל לעבוד עם התוכן.";
        }

        const assistantRecord = await repositories.appendMessage(userId, input.workspaceId, sessionId, {
          role: "tutor",
          content,
        });
        return makeDeterministicReturn(userRecord, assistantRecord, "file_content_inventory_shortcut");
      }

      // Deterministic visual reference: "what is in the graph/diagram/circuit?"
      // Visual PDF understanding is not yet implemented. Offer text-based fallback.
      if (requestClassification.intent === "visual_reference_request") {
        const content =
          "כרגע אני לא מנתח חזותית גרפים, מעגלים, תרשימים, או תמונות מתוך PDF. ניתוח חזותי יתווסף בשלב נפרד.\n\nאם הטקסט שחולץ מהקובץ מכיל תיאור טקסטואלי של האיור, אוכל לעזור על סמך הטקסט. שאל שאלה ספציפית על הנושא ואנסה.";
        const assistantRecord = await repositories.appendMessage(userId, input.workspaceId, sessionId, {
          role: "tutor",
          content,
        });
        return makeDeterministicReturn(userRecord, assistantRecord, "visual_reference_shortcut");
      }

      // Derive active attachment context: current turn's IDs, or latest prior user attachment.
      const activeAttachedFileIds = deriveActiveAttachedFileIds(attachedFileIds, existingMessages);

      // Readiness gate: if active attached files are not yet extracted/chunked, return an
      // honest deterministic response instead of silently retrieving from other workspace files.
      if (activeAttachedFileIds) {
        const readiness = await checkAttachedFilesReadiness(
          repositories,
          userId,
          input.workspaceId,
          activeAttachedFileIds
        );
        if (!readiness.ready) {
          const fileList = readiness.processingFileNames
            .map((n) => `"${n}"`)
            .join(", ");
          const plural = readiness.processingFileNames.length > 1;
          const content = `הקובץ${plural ? "ים" : ""} ${fileList} שצירפת עדיין בעיבוד — חילוץ טקסט, יצירת צ'אנקים, או יצירת embeddings. המתן כמה שניות ושאל שוב.`;
          const assistantRecord = await repositories.appendMessage(userId, input.workspaceId, sessionId, {
            role: "tutor",
            content,
          });
          return makeDeterministicReturn(userRecord, assistantRecord, "attached_file_not_ready");
        }
      }

      const tutorResponse = await repositories.getMockTutorResponse(
        input.userMessage,
        input.workMode,
        input.costMode,
        conversationHistory
      );

      const retrievalDecision = ensureRetrievalDecision(
        tutorResponse,
        input.userMessage,
        input.workMode,
        input.costMode
      );

      const guardedDecision = applyWorkModeGuardrails(
        tutorResponse,
        retrievalDecision,
        input.workMode,
        input.costMode
      );

      const retrievalExecution = await executeRetrievalForTutorResponse(
        repositories,
        userId,
        input.workspaceId,
        input.userMessage,
        input.workMode,
        tutorResponse,
        guardedDecision,
        input.costMode,
        activeAttachedFileIds
      );

      if (retrievalExecution.retrievedChunks.length > 0) {
        const groundingContext = await buildArtifactAwareGroundingContext(
          repositories,
          userId,
          input.workspaceId,
          input.userMessage,
          retrievalExecution.retrievedChunks
        );
        const groundedResponse = await repositories.getMockTutorResponse(
          input.userMessage,
          input.workMode,
          input.costMode,
          conversationHistory,
          groundingContext
        );
        tutorResponse.message = { ...tutorResponse.message, content: groundedResponse.message.content };
        tutorResponse.decisionLogEvents = [
          ...(tutorResponse.decisionLogEvents ?? []),
          {
            type: "retrieval_executed",
            title: "Grounded provider call executed",
            detail: `grounding_context_injected=true; chunks=${retrievalExecution.retrievedChunks.length}; total_token_estimate=${groundingContext.totalTokenEstimate}`,
          },
        ];
      }

      if (input.workMode === "Temporary Chat") {
        tutorResponse.internalUpdate.learner_memory_update = {
          needed: false,
          update_type: "none",
          memory_type: "none",
          content: "",
          confidence: 0,
        };
        tutorResponse.decisionLogEvents = [
          ...(tutorResponse.decisionLogEvents ?? []),
          {
            type: "memory_not_written",
            title: "Temporary chat memory write skipped",
            detail: "Temporary Chat avoids permanent learner memory writes by policy.",
          },
        ];
      } else {
        await repositories.processMemoryCandidate({
          user: typeof user === "string" ? { userId, email: `${userId}@local` } : user,
          workspaceId: input.workspaceId,
          userMessage: input.userMessage,
          internalUpdate: tutorResponse.internalUpdate,
          temporaryChat: false,
        });
      }

      const assistantRecord = await repositories.appendMessage(userId, input.workspaceId, sessionId, {
        role: "tutor",
        content: tutorResponse.message.content,
        citations: retrievalExecution.citations,
      });

      await persistDecisionLogEvents(
        repositories,
        userId,
        input.workspaceId,
        sessionId,
        tutorResponse.decisionLogEvents
      );

      return {
        userMessage: serializeMessage(userRecord),
        assistantMessage: serializeMessage(assistantRecord),
        internalUpdate: tutorResponse.internalUpdate,
      };
    },
  };
}

export const sessionMessageApiService: SessionMessageApiService = createSessionMessageApiService();

async function maybeBuildArtifactAwareInventoryContent(
  repositories: Repositories,
  userId: string,
  readyFile: {
    id: string;
    name?: string;
    originalFileName?: string;
    understandingStatus?: unknown;
    pageCount?: unknown;
    outlineTitle?: unknown;
    detectedQuestionCount?: unknown;
    extractionQuality?: unknown;
    deepPdfStatus?: unknown;
  }
): Promise<string | null> {
  if (readyFile.understandingStatus !== "completed") {
    return null;
  }

  try {
    const fileId = String(readyFile.id);
    const [pages, outline, detectedQuestions] = await Promise.all([
      repositories.listDocumentPages(userId, fileId),
      repositories.getDocumentOutline(userId, fileId),
      repositories.listDetectedQuestions(userId, fileId),
    ]);

    const inventory = buildArtifactAwareFileInventory({
      fileName: String(readyFile.originalFileName ?? readyFile.name ?? "הקובץ"),
      pageCount:
        typeof readyFile.pageCount === "number"
          ? readyFile.pageCount
          : pages.length > 0
            ? pages.length
            : undefined,
      outlineTitle:
        typeof readyFile.outlineTitle === "string" && readyFile.outlineTitle.trim().length > 0
          ? readyFile.outlineTitle
          : undefined,
      detectedQuestionCount:
        typeof readyFile.detectedQuestionCount === "number"
          ? readyFile.detectedQuestionCount
          : undefined,
      extractionQuality:
        readyFile.extractionQuality === "good" ||
        readyFile.extractionQuality === "partial" ||
        readyFile.extractionQuality === "poor"
          ? readyFile.extractionQuality
          : undefined,
      deepPdfStatus:
        readyFile.deepPdfStatus === "not_started" ||
        readyFile.deepPdfStatus === "recommended" ||
        readyFile.deepPdfStatus === "pending" ||
        readyFile.deepPdfStatus === "completed" ||
        readyFile.deepPdfStatus === "failed" ||
        readyFile.deepPdfStatus === "skipped"
          ? readyFile.deepPdfStatus
          : undefined,
      outline,
      detectedQuestions,
    });

    return inventory ? formatArtifactAwareFileInventoryResponse(inventory) : null;
  } catch {
    return null;
  }
}

function resolveTrustedUserId(user: AuthenticatedUser | string): string {
  return typeof user === "string" ? user : user.userId;
}

export class SessionMessageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionMessageValidationError";
  }
}

export function isSessionMessageValidationError(error: unknown): error is SessionMessageValidationError {
  return error instanceof SessionMessageValidationError;
}

async function validateAttachedFileIds(
  repositories: Repositories,
  userId: string,
  workspaceId: string,
  attachedFileIds: string[] | undefined
): Promise<string[] | undefined> {
  if (!attachedFileIds || attachedFileIds.length === 0) {
    return undefined;
  }

  for (const fileId of attachedFileIds) {
    const file = await repositories.getUploadedFile(userId, fileId);

    if (!file) {
      throw new SessionMessageValidationError(
        `Attached file "${fileId}" was not found, is deleted, or is not available to this user.`
      );
    }

    if (file.workspaceId !== workspaceId) {
      throw new SessionMessageValidationError(
        `Attached file "${fileId}" does not belong to the current workspace.`
      );
    }
  }

  return attachedFileIds;
}

/**
 * Returns the active attached file IDs for a tutor turn.
 * Uses the current message's IDs if present; otherwise derives from the most recent
 * prior user message that carried attachedFileIds. Returns undefined when no context exists.
 */
export function deriveActiveAttachedFileIds(
  currentAttachedFileIds: string[] | undefined,
  existingMessages: MessageRecord[]
): string[] | undefined {
  if (currentAttachedFileIds && currentAttachedFileIds.length > 0) {
    return currentAttachedFileIds;
  }
  for (let i = existingMessages.length - 1; i >= 0; i--) {
    const msg = existingMessages[i];
    if (msg.role === "user" && msg.attachedFileIds && msg.attachedFileIds.length > 0) {
      return msg.attachedFileIds;
    }
  }
  return undefined;
}

async function checkAttachedFilesReadiness(
  repositories: Repositories,
  userId: string,
  workspaceId: string,
  attachedFileIds: string[]
): Promise<{ ready: true } | { ready: false; processingFileNames: string[] }> {
  const notReadyNames: string[] = [];
  for (const fileId of attachedFileIds) {
    const file = await repositories.getUploadedFile(userId, fileId);
    const isReady =
      file &&
      file.workspaceId === workspaceId &&
      file.extractionStatus === "completed" &&
      file.chunkingStatus === "completed";
    if (!isReady) {
      notReadyNames.push(
        (file as { originalFileName?: string; name?: string } | null)?.originalFileName ??
        (file as { name?: string } | null)?.name ??
        fileId
      );
    }
  }
  if (notReadyNames.length === 0) return { ready: true };
  return { ready: false, processingFileNames: notReadyNames };
}

async function persistDecisionLogEvents(
  repositories: Repositories,
  userId: string,
  workspaceId: string,
  sessionId: string,
  events: DecisionLogEvent[] | undefined
): Promise<void> {
  if (!events || events.length === 0) return;

  await Promise.all(
    events.map((event) =>
      repositories.writeDecisionLogEntry(userId, {
        decisionType: mapDecisionType(event.type),
        title: event.title,
        decision: event.detail,
        rationale: `Event type: ${event.type}`,
        workspaceId,
        sessionId,
      })
    )
  );
}

async function executeRetrievalForTutorResponse(
  repositories: Repositories,
  userId: string,
  workspaceId: string,
  userMessage: string,
  workMode: WorkMode,
  tutorResponse: TutorBoundaryResponse,
  decision: RetrievalBoundaryDecision,
  costMode: CostMode,
  prioritizedFileIds?: string[]
): Promise<{ citations: TutorBoundaryResponse["message"]["citations"]; retrievedChunks: RetrievedFileChunk[] }> {
  if (!decision.needs_retrieval) {
    tutorResponse.internalUpdate.retrieval = {
      ...tutorResponse.internalUpdate.retrieval,
      used: false,
      scope: "none",
      source_ids: [],
      why: "retrieval_not_requested_by_decision",
    };
    return { citations: tutorResponse.message.citations, retrievedChunks: [] };
  }

  tutorResponse.decisionLogEvents = [
    ...(tutorResponse.decisionLogEvents ?? []),
    {
      type: "retrieval_requested",
      title: "Retrieval execution requested",
      detail: `scope=${decision.retrieval_scope}; max_chunks=${decision.max_chunks}; max_tokens=${decision.max_tokens}`,
    },
  ];

  if (decision.retrieval_scope === "web") {
    return executeWebSearchRetrieval(
      repositories,
      userMessage,
      workMode,
      decision.max_chunks,
      tutorResponse
    );
  }

  try {
    const modeBudget = getRetrievalBudgetForCostMode(costMode);
    const effectiveMaxChunks = Math.max(1, Math.min(decision.max_chunks, modeBudget.maxChunks));
    const effectiveMaxTokens = Math.min(decision.max_tokens, modeBudget.maxTokens);

    const chunkResult = await repositories.retrieveFileChunks({
      userId,
      workspaceId,
      query: userMessage,
      maxChunks: effectiveMaxChunks,
      maxTokens: effectiveMaxTokens,
      prioritizedFileIds,
    });

    if (chunkResult.eligibleFileCount > 0) {
      return executeChunkRetrieval(tutorResponse, decision, chunkResult, effectiveMaxChunks, effectiveMaxTokens);
    }

    return await executeLegacyIndexedFileRetrieval(
      repositories,
      userId,
      workspaceId,
      tutorResponse,
      decision,
      effectiveMaxChunks,
      effectiveMaxTokens
    );
  } catch (error) {
    tutorResponse.internalUpdate.retrieval = {
      ...tutorResponse.internalUpdate.retrieval,
      used: false,
      source_ids: [],
      why: "retrieval_failed_internal_error",
    };
    tutorResponse.decisionLogEvents.push({
      type: "retrieval_failed",
      title: "Retrieval failed",
      detail: error instanceof Error ? error.message : "Unknown retrieval error",
    });
    return { citations: tutorResponse.message.citations, retrievedChunks: [] };
  }
}

async function executeWebSearchRetrieval(
  repositories: Repositories,
  userMessage: string,
  workMode: WorkMode,
  maxChunks: number,
  tutorResponse: TutorBoundaryResponse
): Promise<{ citations: TutorBoundaryResponse["message"]["citations"]; retrievedChunks: RetrievedFileChunk[] }> {
  const isResearchMode = workMode === "Research";
  const hasFreshnessCue = /(latest|recent|today|current|news|update|up-to-date|היום|עדכני|אחרון)/i.test(
    userMessage
  );

  if (!isResearchMode || !hasFreshnessCue) {
    tutorResponse.internalUpdate.retrieval = {
      ...tutorResponse.internalUpdate.retrieval,
      used: false,
      scope: "web",
      source_ids: [],
      why: !isResearchMode
        ? "web_search_skipped_policy_requires_research_mode"
        : "web_search_skipped_no_freshness_signal",
    };
    tutorResponse.decisionLogEvents?.push({
      type: "web_search_skipped",
      title: "Web search skipped",
      detail: !isResearchMode
        ? "Policy guardrail: web retrieval only eligible in Research mode."
        : "Web retrieval requested but no freshness/recentness cue was detected.",
    });
    return { citations: tutorResponse.message.citations, retrievedChunks: [] };
  }

  tutorResponse.decisionLogEvents?.push({
    type: "web_search_requested",
    title: "Web search requested",
    detail: "Research mode + freshness cue detected; executing deterministic web provider.",
  });

  try {
    const result = await repositories.webSearchProvider.search(userMessage);
    const selected = result.hits.slice(0, Math.max(1, maxChunks));
    const sourceIds = selected.map((hit) => hit.sourceId);

    if (selected.length === 0) {
      tutorResponse.internalUpdate.retrieval = {
        ...tutorResponse.internalUpdate.retrieval,
        used: false,
        scope: "web",
        source_ids: [],
        why: "web_search_skipped_no_results",
      };
      tutorResponse.decisionLogEvents?.push({
        type: "web_search_skipped",
        title: "Web search skipped",
        detail: "Web provider returned no results.",
      });
      return { citations: tutorResponse.message.citations, retrievedChunks: [] };
    }

    tutorResponse.internalUpdate.retrieval = {
      used: true,
      scope: "web",
      source_ids: sourceIds,
      why: `web_search_executed_selected_${sourceIds.length}_sources`,
    };

    const citations = selected.map((hit) => ({
      id: `web-${hit.sourceId}`,
      sourceId: hit.sourceId,
      referenceText: `${hit.title}: ${hit.snippet} (${hit.url})`,
    }));

    tutorResponse.decisionLogEvents?.push({
      type: "web_search_executed",
      title: "Web search executed",
      detail: `selected_sources=${sourceIds.join(",")}; total_hits=${result.hits.length}`,
    });

    const hasSupport = selected.some((hit) => hit.stance === "supports");
    const hasConflict = selected.some((hit) => hit.stance === "conflicts");
    if (hasSupport && hasConflict) {
      tutorResponse.decisionLogEvents?.push({
        type: "web_search_conflict",
        title: "Web source conflict detected",
        detail: "Retrieved web sources include conflicting stances.",
      });
    }

    return { citations, retrievedChunks: [] };
  } catch (error) {
    tutorResponse.internalUpdate.retrieval = {
      ...tutorResponse.internalUpdate.retrieval,
      used: false,
      scope: "web",
      source_ids: [],
      why: "web_search_failed_internal_error",
    };
    tutorResponse.decisionLogEvents?.push({
      type: "web_search_skipped",
      title: "Web search failed",
      detail: error instanceof Error ? error.message : "Unknown web search error",
    });
    return { citations: tutorResponse.message.citations, retrievedChunks: [] };
  }
}

function executeChunkRetrieval(
  tutorResponse: TutorBoundaryResponse,
  decision: RetrievalBoundaryDecision,
  chunkResult: FileChunkRetrievalResult,
  effectiveMaxChunks: number,
  effectiveMaxTokens: number
): { citations: TutorBoundaryResponse["message"]["citations"]; retrievedChunks: RetrievedFileChunk[] } {
  const { chunks, eligibleFileCount } = chunkResult;
  const retrievalMethod = chunks[0]?.retrievalMethod ?? "keyword_only";

  if (chunks.length === 0) {
    tutorResponse.internalUpdate.retrieval = {
      ...tutorResponse.internalUpdate.retrieval,
      used: false,
      scope: decision.retrieval_scope,
      source_ids: [],
      why: "no_matching_file_chunks",
    };
    tutorResponse.decisionLogEvents?.push({
      type: "retrieval_skipped",
      title: "Retrieval skipped",
      detail: `No matching file chunks found; eligible_files=${eligibleFileCount}; applied_max_chunks=${effectiveMaxChunks}; semantic_attempted=true; fallback_reason=no_semantic_or_keyword_match`,
    });
    return { citations: tutorResponse.message.citations, retrievedChunks: [] };
  }

  const chunkIds = chunks.map((c) => c.chunkId);
  const fileIds = [...new Set(chunks.map((c) => c.fileId))];

  tutorResponse.internalUpdate.retrieval = {
    used: true,
    scope: decision.retrieval_scope,
    source_ids: chunkIds,
    why:
      retrievalMethod === "semantic"
        ? `semantic_retrieval_executed_selected_${chunks.length}_file_chunks`
        : retrievalMethod === "keyword_fallback"
          ? `keyword_fallback_retrieval_executed_selected_${chunks.length}_file_chunks`
          : `retrieval_executed_selected_${chunks.length}_file_chunks`,
  };

  const citations = chunks.map((chunk) => ({
    id: chunk.chunkId,
    sourceId: `${chunk.fileId}:${chunk.chunkId}`,
    referenceText: chunk.text.length > 200 ? chunk.text.slice(0, 200) + "…" : chunk.text,
  }));

  tutorResponse.decisionLogEvents?.push({
    type: "retrieval_executed",
    title: "Retrieval executed",
    detail: `selected_chunk_ids=${chunkIds.join(",")}; selected_file_ids=${fileIds.join(",")}; total_candidates=${eligibleFileCount}; applied_max_chunks=${effectiveMaxChunks}; applied_max_tokens=${effectiveMaxTokens}; retrieval_method=${retrievalMethod}; semantic_attempted=true; semantic_used=${retrievalMethod === "semantic" ? "true" : "false"}; fallback_reason=${retrievalMethod === "keyword_fallback" ? "semantic_unavailable_or_empty" : "none"}; grounding_context_injected=true`,
  });

  return { citations, retrievedChunks: chunks };
}

async function executeLegacyIndexedFileRetrieval(
  repositories: Repositories,
  userId: string,
  workspaceId: string,
  tutorResponse: TutorBoundaryResponse,
  decision: RetrievalBoundaryDecision,
  effectiveMaxChunks: number,
  effectiveMaxTokens: number
): Promise<{ citations: TutorBoundaryResponse["message"]["citations"]; retrievedChunks: RetrievedFileChunk[] }> {
  const files = await repositories.listUploadedFiles(userId, workspaceId);
  const indexed = files.filter((file) => file.indexingStatus === "indexed");

  if (indexed.length === 0) {
    tutorResponse.internalUpdate.retrieval = {
      ...tutorResponse.internalUpdate.retrieval,
      used: false,
      scope: decision.retrieval_scope,
      source_ids: [],
      why: "retrieval_skipped_no_indexed_files",
    };
    tutorResponse.decisionLogEvents?.push({
      type: "retrieval_skipped",
      title: "Retrieval skipped",
      detail: "No indexed files are available in this workspace.",
    });
    return { citations: tutorResponse.message.citations, retrievedChunks: [] };
  }

  const ranked = indexed.sort((a, b) => {
    const scoreA = (a.summaryStatus === "ready" ? 2 : 0) + (a.confidence ?? 0);
    const scoreB = (b.summaryStatus === "ready" ? 2 : 0) + (b.confidence ?? 0);
    return scoreB - scoreA;
  });
  const selected = ranked.slice(0, effectiveMaxChunks);

  // Exclude Phase 8 placeholder summaries — they contain no real content and must
  // not reach the tutor as if file text was available.
  const usableFiles = selected.filter(
    (file) => !(file.summaryStatus === "ready" && file.summaryText === LEGACY_SUMMARY_PLACEHOLDER)
  );

  if (usableFiles.length === 0) {
    tutorResponse.internalUpdate.retrieval = {
      ...tutorResponse.internalUpdate.retrieval,
      used: false,
      scope: decision.retrieval_scope,
      source_ids: [],
      why: "retrieval_skipped_placeholder_content_only",
    };
    tutorResponse.decisionLogEvents?.push({
      type: "retrieval_skipped",
      title: "Retrieval skipped",
      detail: "All indexed files contain only placeholder summaries — no real extracted content available.",
    });
    return { citations: tutorResponse.message.citations, retrievedChunks: [] };
  }

  const sourceIds = usableFiles.map((file) => file.id);

  tutorResponse.internalUpdate.retrieval = {
    used: true,
    scope: decision.retrieval_scope,
    source_ids: sourceIds,
    why: `retrieval_executed_selected_${sourceIds.length}_indexed_files`,
  };

  const citations = usableFiles.map((file) => ({
    id: `retrieval-${file.id}`,
    sourceId: file.id,
    referenceText:
      file.summaryStatus === "ready" && file.summaryText
        ? file.summaryText
        : `Retrieved from indexed file: ${file.name}`,
  }));

  tutorResponse.decisionLogEvents?.push({
    type: "retrieval_executed",
    title: "Retrieval executed",
    detail: `selected_sources=${sourceIds.join(",")}; indexed_candidates=${indexed.length}; applied_max_chunks=${effectiveMaxChunks}; applied_max_tokens=${effectiveMaxTokens}`,
  });

  return { citations: citations.length > 0 ? citations : tutorResponse.message.citations, retrievedChunks: [] };
}

function ensureRetrievalDecision(
  tutorResponse: TutorBoundaryResponse,
  message: string,
  workMode: Parameters<typeof decideRetrievalBoundary>[0]["workMode"],
  costMode: CostMode
): RetrievalBoundaryDecision {
  const existing = tutorResponse.internalUpdate.retrieval_decision;
  if (existing) {
    return existing;
  }

  const fallback = decideRetrievalBoundary({
    message,
    workMode,
    costMode,
  });
  tutorResponse.internalUpdate.retrieval_decision = fallback;
  tutorResponse.decisionLogEvents = [
    ...(tutorResponse.decisionLogEvents ?? []),
    {
      type: "retrieval_scope",
      title: "Retrieval boundary decision (service fallback)",
      detail: [
        `needs_retrieval=${fallback.needs_retrieval ? "true" : "false"}`,
        `retrieval_scope=${fallback.retrieval_scope}`,
        `max_chunks=${fallback.max_chunks}`,
        `max_tokens=${fallback.max_tokens}`,
      ].join("; "),
    },
  ];
  return fallback;
}

function getRetrievalBudgetForCostMode(costMode: CostMode): { maxChunks: number; maxTokens: number } {
  if (costMode === "Cheap Practice") {
    return { maxChunks: 2, maxTokens: 2000 };
  }
  if (costMode === "Deep Research") {
    return { maxChunks: 10, maxTokens: 12000 };
  }
  return { maxChunks: 4, maxTokens: 5000 };
}

function applyWorkModeGuardrails(
  tutorResponse: TutorBoundaryResponse,
  decision: RetrievalBoundaryDecision,
  workMode: WorkMode,
  costMode: CostMode
): RetrievalBoundaryDecision {
  let next = { ...decision };

  if (workMode === "Practice") {
    const scoped = clampScope(next.retrieval_scope, ["none", "session", "topic"]);
    next = {
      ...next,
      retrieval_scope: scoped,
      needs_retrieval: scoped !== "none" && next.needs_retrieval,
    };

    tutorResponse.decisionLogEvents = [
      ...(tutorResponse.decisionLogEvents ?? []),
      {
        type: "work_mode_policy",
        title: "Practice retrieval minimization applied",
        detail: `scope=${next.retrieval_scope}; costMode=${costMode}`,
      },
    ];
  }

  if (workMode === "Research") {
    tutorResponse.decisionLogEvents = [
      ...(tutorResponse.decisionLogEvents ?? []),
      {
        type: "work_mode_policy",
        title: "Research web policy eligibility",
        detail:
          next.retrieval_scope === "web"
            ? "Web scope is policy-allowed in Research mode and may execute when freshness cues are present."
            : `Research scope=${next.retrieval_scope}.`,
      },
    ];
  }

  if (workMode === "Build") {
    if (next.needs_retrieval && (next.retrieval_scope === "none" || next.retrieval_scope === "session")) {
      next = { ...next, retrieval_scope: "workspace" };
    }
    tutorResponse.decisionLogEvents = [
      ...(tutorResponse.decisionLogEvents ?? []),
      {
        type: "work_mode_policy",
        title: "Build project-context policy applied",
        detail: `scope=${next.retrieval_scope}; retrieval=${next.needs_retrieval ? "enabled" : "disabled"}`,
      },
    ];
  }

  tutorResponse.internalUpdate.retrieval_decision = next;
  return next;
}

function clampScope(scope: RetrievalScope, allowed: RetrievalScope[]): RetrievalScope {
  return allowed.includes(scope) ? scope : "topic";
}

function buildGroundingContextFromChunks(chunks: RetrievedFileChunk[]): TutorGroundingContext {
  return {
    mode: "file_chunks",
    chunks: chunks.map((c) => ({
      sourceId: `${c.fileId}:${c.chunkId}`,
      fileId: c.fileId,
      chunkId: c.chunkId,
      chunkIndex: c.chunkIndex,
      text: c.text,
      tokenEstimate: c.tokenEstimate,
      sourceLabel: c.sourceLabel,
    })),
    totalTokenEstimate: chunks.reduce((sum, c) => sum + c.tokenEstimate, 0),
    instruction: "Use the following retrieved learning-material excerpts to inform your answer. Treat them as internal course material.",
  };
}

type ArtifactAwareUploadedFile = {
  id: string;
  understandingStatus?: unknown;
  extractionQuality?: unknown;
  deepPdfStatus?: unknown;
};

type ArtifactGroundingSignal = {
  number?: string;
  letter?: string;
};

async function buildArtifactAwareGroundingContext(
  repositories: Repositories,
  userId: string,
  workspaceId: string,
  userMessage: string,
  chunks: RetrievedFileChunk[]
): Promise<TutorGroundingContext> {
  const baseContext = buildGroundingContextFromChunks(chunks);
  const artifactInstruction = await maybeBuildArtifactAwareGroundingInstruction(
    repositories,
    userId,
    workspaceId,
    userMessage,
    chunks
  );

  if (!artifactInstruction) {
    return baseContext;
  }

  return {
    ...baseContext,
    instruction: `${baseContext.instruction} ${artifactInstruction}`.trim(),
  };
}

async function maybeBuildArtifactAwareGroundingInstruction(
  repositories: Repositories,
  userId: string,
  workspaceId: string,
  userMessage: string,
  chunks: RetrievedFileChunk[]
): Promise<string | null> {
  const pageRefs = extractRequestedPages(userMessage);
  const sectionSignals = extractArtifactGroundingSignals(userMessage);
  if (pageRefs.length === 0 && sectionSignals.length === 0) {
    return null;
  }

  const uploadedFiles = await repositories.listUploadedFiles(userId, workspaceId);
  const retrievedFileIds = new Set(chunks.map((chunk) => chunk.fileId));
  const candidateFiles = uploadedFiles.filter(
    (file): file is typeof file & ArtifactAwareUploadedFile =>
      retrievedFileIds.has(String(file.id)) && file.understandingStatus === "completed"
  );

  if (candidateFiles.length === 0) {
    return null;
  }

  const notes: string[] = [];

  for (const file of candidateFiles) {
    if (notes.length >= 2) break;

    const fileId = String(file.id);
    const [pages, detectedQuestions] = await Promise.all([
      pageRefs.length > 0 ? repositories.listDocumentPages(userId, fileId) : Promise.resolve([]),
      sectionSignals.length > 0 ? repositories.listDetectedQuestions(userId, fileId) : Promise.resolve([]),
    ]);

    const matchedQuestion =
      sectionSignals.length > 0
        ? detectedQuestions.find((question) => matchesArtifactGroundingSignals(question.label, sectionSignals))
        : undefined;

    if (matchedQuestion) {
      const pageLabel = buildArtifactGroundingPageLabel(matchedQuestion.pageStart, matchedQuestion.pageEnd);
      const cleanDetail = sanitizeArtifactGroundingText(
        matchedQuestion.summary ?? matchedQuestion.topic ?? matchedQuestion.extractionNotes
      );

      if (cleanDetail) {
        notes.push(
          `The learner likely refers to section/question "${matchedQuestion.label}"${pageLabel ? ` on ${pageLabel}` : ""}. Helpful artifact hint: ${cleanDetail}.`
        );
      } else {
        notes.push(
          `The learner likely refers to section/question "${matchedQuestion.label}"${pageLabel ? ` on ${pageLabel}` : ""}, but the artifact text there is not clean enough to quote reliably.`
        );
      }
    }

    if (notes.length === 0 && pageRefs.length > 0) {
      const matchedPage = pages.find((page) => pageRefs.includes(page.pageNumber));
      if (matchedPage) {
        const cleanPageHint = sanitizeArtifactGroundingText(matchedPage.cleanedText ?? matchedPage.extractedText);
        if (cleanPageHint) {
          notes.push(`The learner likely refers to page ${matchedPage.pageNumber}. Helpful page hint: ${cleanPageHint}.`);
        } else {
          notes.push(
            `The learner likely refers to page ${matchedPage.pageNumber}, but the artifact text there is not clean enough to quote reliably.`
          );
        }
      }
    }

    const extractionQuality =
      file.extractionQuality === "good" ||
      file.extractionQuality === "partial" ||
      file.extractionQuality === "poor"
        ? file.extractionQuality
        : undefined;

    if (notes.length > 0 && extractionQuality && extractionQuality !== "good") {
      notes.push(
        `Artifact extraction quality is ${extractionQuality}. Use artifact hints only to locate the right part of the material; rely on the retrieved chunk text for actual claims, especially around formulas or diagrams.`
      );
    }

    const deepPdfGroundingNote = buildDeepPdfGroundingNote(file.deepPdfStatus);
    if (deepPdfGroundingNote) {
      notes.push(deepPdfGroundingNote);
    }
  }

  if (notes.length === 0) {
    return null;
  }

  return notes.join(" ");
}

function buildDeepPdfGroundingNote(deepPdfStatus: unknown): string | null {
  if (deepPdfStatus === "completed") {
    return "Advanced document understanding completed for this file. You may express moderate confidence about document structure and section layout, but still ground factual claims in the retrieved chunk text.";
  }
  if (deepPdfStatus === "pending") {
    return "Advanced document understanding is currently in progress for this file. Keep your response tentative — do not claim deep analysis has completed.";
  }
  if (deepPdfStatus === "failed") {
    return "Advanced document understanding failed for this file. Do not claim the file was deeply analysed. Keep responses based only on retrieved chunk text and be honest about limitations.";
  }
  if (deepPdfStatus === "recommended") {
    return "Advanced document understanding may be needed for formulas or diagrams in this file. Do not claim that such analysis already ran.";
  }
  return null;
}

function extractRequestedPages(message: string): number[] {
  return Array.from(message.matchAll(/עמוד\s+(\d+)/g), (match) => Number(match[1])).filter(
    (value) => Number.isFinite(value) && value > 0
  );
}

function extractArtifactGroundingSignals(message: string): ArtifactGroundingSignal[] {
  const signals: ArtifactGroundingSignal[] = [];

  for (const match of message.matchAll(/(?:שאלה|תרגיל|סעיף|מקטע|question|exercise|problem)\s+(\d+)/gi)) {
    signals.push({ number: match[1] });
  }

  for (const match of message.matchAll(/(?:סעיף|מקטע)\s+([אבגדהוזחטיכלמנסעפצקרשת])[׳'"]?/g)) {
    signals.push({ letter: normalizeHebrewGroundingLetter(match[1]) });
  }

  return signals;
}

function matchesArtifactGroundingSignals(label: string, signals: ArtifactGroundingSignal[]): boolean {
  const numericMatch = label.match(/(?:שאלה|תרגיל|סעיף|מקטע|question|exercise|problem)\s+(\d+)/i);
  const letterMatch = label.match(/(?:סעיף|מקטע)\s+([אבגדהוזחטיכלמנסעפצקרשת])[׳'"]?/);
  const labelNumber = numericMatch?.[1];
  const labelLetter = letterMatch ? normalizeHebrewGroundingLetter(letterMatch[1]) : undefined;

  return signals.some(
    (signal) =>
      (signal.number && labelNumber === signal.number) ||
      (signal.letter && labelLetter === signal.letter)
  );
}

function buildArtifactGroundingPageLabel(pageStart?: number, pageEnd?: number): string | null {
  if (typeof pageStart === "number" && typeof pageEnd === "number") {
    return pageStart === pageEnd ? `page ${pageStart}` : `pages ${pageStart}-${pageEnd}`;
  }
  if (typeof pageStart === "number") {
    return `page ${pageStart}`;
  }
  if (typeof pageEnd === "number") {
    return `page ${pageEnd}`;
  }
  return null;
}

function normalizeHebrewGroundingLetter(letter: string): string {
  return letter.replace(/[׳'"]/g, "").trim();
}

function sanitizeArtifactGroundingText(text: string | undefined): string | null {
  if (!text) {
    return null;
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length === 0 || isLowQualityGroundingArtifactText(normalized)) {
    return null;
  }

  const compact = normalized.length > 120 ? `${normalized.slice(0, 119).trimEnd()}…` : normalized;
  return compact;
}

function isLowQualityGroundingArtifactText(text: string): boolean {
  if (/[\uF000-\uF8FF]/u.test(text)) {
    return true;
  }

  if (/(,{2,}|;{2,}|:{2,}|!{2,}|\?{2,})/.test(text)) {
    return true;
  }

  if (/(?:\b[a-zA-Z]\b[\s,]*){3,}/.test(text)) {
    return true;
  }

  const hebrewTokens = text.match(/[א-ת]+/g) ?? [];
  const singleHebrewTokenCount = hebrewTokens.filter((token) => token.length === 1).length;
  const multiCharHebrewTokenCount = hebrewTokens.filter((token) => token.length > 1).length;

  if (singleHebrewTokenCount >= 2 && multiCharHebrewTokenCount <= 1) {
    return true;
  }

  if (/(?:^|\s)[א-ת](?:\s+[א-ת]){1,}\s+[א-ת]{2,}(?:\s|$)/.test(text)) {
    return true;
  }

  if (singleHebrewTokenCount >= 2 && singleHebrewTokenCount >= multiCharHebrewTokenCount) {
    return true;
  }

  const longWordCount = text
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3).length;
  if (text.length < 24 && longWordCount < 2) {
    return true;
  }

  return false;
}

function makeDeterministicReturn(
  userRecord: MessageRecord,
  assistantRecord: MessageRecord,
  why: string
): PostMessageApiResponse {
  return {
    userMessage: serializeMessage(userRecord),
    assistantMessage: serializeMessage(assistantRecord),
    internalUpdate: {
      detected_intent: "user_preference",
      confidence: 1.0,
      should_stop_progression: false,
      local_question: { detected: false, reason: "" },
      retrieval: { used: false, scope: "none", source_ids: [], why },
      retrieval_decision: { needs_retrieval: false, retrieval_scope: "none", max_chunks: 0, max_tokens: 0, should_ask_clarification_first: false },
      learner_memory_update: { needed: false, update_type: "none", memory_type: "none", content: "", confidence: 0 },
      knowledge_base_action: { needed: false, action: "none", confidence: 0, requires_user_confirmation: false },
      decision_log_entries: [],
    },
  };
}

function mapDecisionType(eventType: DecisionLogEvent["type"]): DecisionLogEntry["decisionType"] {
  switch (eventType) {
    case "memory_not_written":
      return "memory_not_written";
    case "retrieval_scope":
    case "retrieval_requested":
    case "retrieval_executed":
    case "retrieval_skipped":
    case "retrieval_failed":
    case "work_mode_policy":
      return "retrieval_scope";
    case "web_search_requested":
    case "web_search_executed":
    case "web_search_skipped":
    case "web_search_conflict":
      return "web_search";
    case "mock_provider":
    case "deepseek_provider":
    case "harness_classification":
    case "harness_fallback":
    case "request_validation":
    case "response_validation":
    default:
      return "model_provider";
  }
}
