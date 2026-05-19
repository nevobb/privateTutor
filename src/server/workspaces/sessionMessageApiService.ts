import { getMockTutorResponse as defaultGetMockTutorResponse } from "../../lib/tutor";
import { getActiveTutorProvider } from "../tutor/providerRegistry";
import type { ConversationTurn } from "../tutor/schemas";
import type { AuthenticatedUser } from "../auth/authTypes";
import {
  appendMessage as defaultAppendMessage,
  listSessionMessages as defaultListSessionMessages,
} from "./messageRepository";
import { listUploadedFiles as defaultListUploadedFiles } from "./uploadedFileRepository";
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

// Maximum number of previous turns to include as context for the AI provider.
// Each "turn" is one message (user or tutor). 20 = 10 exchanges.
const MAX_HISTORY_TURNS = 20;

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
  listUploadedFiles: typeof defaultListUploadedFiles;
  writeDecisionLogEntry: typeof defaultWriteDecisionLogEntry;
  processMemoryCandidate: typeof defaultLearnerMemoryApiService.processMemoryCandidate;
  webSearchProvider: typeof defaultWebSearchProvider;
  getMockTutorResponse: (
    message: string,
    workMode: Parameters<typeof defaultGetMockTutorResponse>[1],
    costMode: Parameters<typeof defaultGetMockTutorResponse>[2],
    conversationHistory?: ConversationTurn[]
  ) => Promise<TutorBoundaryResponse>;
}

function defaultGetTutorResponse(
  message: string,
  workMode: Parameters<typeof defaultGetMockTutorResponse>[1],
  costMode: Parameters<typeof defaultGetMockTutorResponse>[2],
  conversationHistory?: ConversationTurn[]
): ReturnType<typeof defaultGetMockTutorResponse> {
  const provider = getActiveTutorProvider();
  return provider.call({
    userId: "session-service",
    workspaceId: "session-service",
    message,
    workMode,
    costMode,
    conversationHistory,
  }) as ReturnType<typeof defaultGetMockTutorResponse>;
}

function defaultRepositories(): Repositories {
  return {
    getWorkspace: defaultGetWorkspace,
    getSession: defaultGetSession,
    listSessionMessages: defaultListSessionMessages,
    appendMessage: defaultAppendMessage,
    listUploadedFiles: defaultListUploadedFiles,
    writeDecisionLogEntry: defaultWriteDecisionLogEntry,
    processMemoryCandidate: defaultLearnerMemoryApiService.processMemoryCandidate,
    webSearchProvider: defaultWebSearchProvider,
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

      // Fetch existing messages BEFORE appending the current user message,
      // so history only includes previous turns.
      const existingMessages = await repositories.listSessionMessages(userId, input.workspaceId, sessionId);
      const conversationHistory: ConversationTurn[] = existingMessages
        .slice(-MAX_HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content }));

      const userRecord = await repositories.appendMessage(userId, input.workspaceId, sessionId, {
        role: "user",
        content: input.userMessage,
      });

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
        input.costMode
      );

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

function resolveTrustedUserId(user: AuthenticatedUser | string): string {
  return typeof user === "string" ? user : user.userId;
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
  costMode: CostMode
): Promise<{ citations: TutorBoundaryResponse["message"]["citations"] }> {
  if (!decision.needs_retrieval) {
    tutorResponse.internalUpdate.retrieval = {
      ...tutorResponse.internalUpdate.retrieval,
      used: false,
      scope: "none",
      source_ids: [],
      why: "retrieval_not_requested_by_decision",
    };
    return { citations: tutorResponse.message.citations };
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
      tutorResponse.decisionLogEvents.push({
        type: "retrieval_skipped",
        title: "Retrieval skipped",
        detail: "No indexed files are available in this workspace.",
      });
      return { citations: tutorResponse.message.citations };
    }

    const ranked = indexed.sort((a, b) => {
      const scoreA = (a.summaryStatus === "ready" ? 2 : 0) + (a.confidence ?? 0);
      const scoreB = (b.summaryStatus === "ready" ? 2 : 0) + (b.confidence ?? 0);
      return scoreB - scoreA;
    });
    const selected = ranked.slice(0, effectiveMaxChunks);
    const sourceIds = selected.map((file) => file.id);

    tutorResponse.internalUpdate.retrieval = {
      used: true,
      scope: decision.retrieval_scope,
      source_ids: sourceIds,
      why: `retrieval_executed_selected_${sourceIds.length}_indexed_files`,
    };

    const citations = selected.map((file) => ({
      id: `retrieval-${file.id}`,
      sourceId: file.id,
      referenceText:
        file.summaryStatus === "ready" && file.summaryText
          ? file.summaryText
          : `Retrieved from indexed file: ${file.name}`,
    }));

    tutorResponse.decisionLogEvents.push({
      type: "retrieval_executed",
      title: "Retrieval executed",
      detail: `selected_sources=${sourceIds.join(",")}; indexed_candidates=${indexed.length}; applied_max_chunks=${effectiveMaxChunks}; applied_max_tokens=${effectiveMaxTokens}`,
    });

    return { citations: citations.length > 0 ? citations : tutorResponse.message.citations };
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
    return { citations: tutorResponse.message.citations };
  }
}

async function executeWebSearchRetrieval(
  repositories: Repositories,
  userMessage: string,
  workMode: WorkMode,
  maxChunks: number,
  tutorResponse: TutorBoundaryResponse
): Promise<{ citations: TutorBoundaryResponse["message"]["citations"] }> {
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
    return { citations: tutorResponse.message.citations };
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
      return { citations: tutorResponse.message.citations };
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

    return { citations };
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
    return { citations: tutorResponse.message.citations };
  }
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
