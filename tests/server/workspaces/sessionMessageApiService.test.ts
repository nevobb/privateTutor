import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

const SERVICE_FILE = resolve(process.cwd(), "src/server/workspaces/sessionMessageApiService.ts");
const hasFile = existsSync(SERVICE_FILE);
const describeService = hasFile ? describe : describe.skip;

type ChunkRetrievalResult = {
  chunks: Array<{
    chunkId: string;
    fileId: string;
    workspaceId: string;
    text: string;
    chunkIndex: number;
    tokenEstimate: number;
    score: number;
    sourceLabel: string;
  }>;
  eligibleFileCount: number;
};

type ServiceModule = {
  createSessionMessageApiService: (repos?: {
    getWorkspace: (userId: string, workspaceId: string) => Promise<Record<string, unknown> | null>;
    getSession: (userId: string, workspaceId: string, sessionId: string) => Promise<Record<string, unknown> | null>;
    listSessionMessages: (userId: string, workspaceId: string, sessionId: string) => Promise<Record<string, unknown>[]>;
    appendMessage: (userId: string, workspaceId: string, sessionId: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    listUploadedFiles: (userId: string, workspaceId: string) => Promise<Array<Record<string, unknown>>>;
    writeDecisionLogEntry: (
      userId: string,
      input: {
        decisionType: string;
        title: string;
        decision: string;
        rationale: string;
        workspaceId?: string;
        sessionId?: string;
      }
    ) => Promise<Record<string, unknown>>;
    processMemoryCandidate: (input: Record<string, unknown>) => Promise<void>;
    webSearchProvider: {
      search: (query: string) => Promise<{
        query: string;
        hits: Array<{
          sourceId: string;
          title: string;
          snippet: string;
          url: string;
          stance: "supports" | "conflicts" | "neutral";
        }>;
      }>;
    };
    retrieveFileChunks: (input: {
      userId: string;
      workspaceId: string;
      query: string;
      maxChunks: number;
      maxTokens: number;
    }) => Promise<ChunkRetrievalResult>;
    getMockTutorResponse: (
      msg: string,
      wm: string,
      cm: string,
      history?: Array<{ role: string; content: string }>,
      groundingContext?: {
        mode: "none" | "file_chunks";
        chunks: Array<{ sourceId: string; fileId: string; chunkId: string; chunkIndex: number; text: string; tokenEstimate: number; sourceLabel?: string }>;
        totalTokenEstimate: number;
        instruction: string;
      }
    ) => Promise<{
      message: { id: string; role: string; content: string };
      internalUpdate: Record<string, unknown>;
      decisionLogEvents?: Array<{ type: string; title: string; detail: string }>;
    }>;
  }) => {
    listMessagesForUser: (user: string, workspaceId: string, sessionId: string) => Promise<Record<string, unknown>[]>;
    sendMessageForUser: (user: string, sessionId: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
};

let mod: ServiceModule;

const baseMessage = {
  id: "m1",
  role: "user",
  content: "hi",
  userId: "alice",
  workspaceId: "ws-1",
  sessionId: "s-1",
  sequence: 1,
  createdAt: new Date(),
  status: "sent",
};
const tutorMessage = { ...baseMessage, id: "m2", role: "tutor", content: "response", sequence: 2 };
const tutorResponse = {
  message: { id: "m2", role: "tutor", content: "response" },
  internalUpdate: {
    detected_intent: "factual_or_regular",
    retrieval_decision: {
      needs_retrieval: true,
      retrieval_scope: "topic",
      max_chunks: 4,
      max_tokens: 1400,
      should_ask_clarification_first: false,
    },
  },
  decisionLogEvents: [
    { type: "deepseek_provider", title: "DeepSeek provider used", detail: "Model deepseek-chat" },
    { type: "harness_classification", title: "Harness classification applied", detail: "Parsed JSON" },
    {
      type: "retrieval_scope",
      title: "Retrieval boundary decision",
      detail: "needs_retrieval=true; retrieval_scope=topic; max_chunks=4; max_tokens=1400",
    },
  ],
};

function makeIndexedFiles(count: number) {
  return Array.from({ length: count }).map((_, i) => ({
    id: `file-${i + 1}`,
    name: `doc-${i + 1}.pdf`,
    indexingStatus: "indexed",
    summaryStatus: "ready",
    summaryText: `Summary ${i + 1}`,
    confidence: 0.9 - i * 0.01,
  }));
}

function makeRepos(
  overrides: Partial<Parameters<ServiceModule["createSessionMessageApiService"]>[0]> = {}
) {
  const documentTutorContextService = {
    classifyIntent: vi.fn(() => ({ intent: "general_tutor_question" as const })),
    buildVisualNotSupportedAnswer: vi.fn(
      () => "הבנת תוכן חזותי (כמו גרפים/דיאגרמות) עדיין לא פעילה."
    ),
    resolveRelevantFileForDocumentIntent: vi.fn(async () => ({
      ok: false as const,
      code: "unsupported_state" as const,
      reason: "not-ready",
    })),
    buildAmbiguousFilesAnswer: vi.fn(() => "ambiguous"),
    buildInventoryAnswer: vi.fn(() => "inventory"),
    resolveDetectedQuestionReference: vi.fn(() => ({ ok: false as const, message: "not found" })),
    buildQuestionGrounding: vi.fn(() => ({ contextText: "", sourcePages: [] })),
  };

  return {
    getWorkspace: vi.fn(async (uid: string, wsId: string) =>
      uid === "alice" && wsId === "ws-1" ? { id: "ws-1", userId: "alice" } : null
    ),
    getSession: vi.fn(async (uid: string, wsId: string, sessId: string) =>
      uid === "alice" && wsId === "ws-1" && sessId === "s-1"
        ? { id: "s-1", userId: "alice" }
        : null
    ),
    listSessionMessages: vi.fn(async () => [baseMessage]),
    appendMessage: vi.fn(
      async (_uid: string, _wsId: string, _sessId: string, input: Record<string, unknown>) =>
        input.role === "user" ? baseMessage : tutorMessage
    ),
    listUploadedFiles: vi.fn(async () => [
      {
        id: "file-1",
        name: "Mechanics.pdf",
        indexingStatus: "indexed",
        summaryStatus: "ready",
        summaryText: "Summary placeholder; content extraction not enabled yet.",
        confidence: 0.9,
      },
    ]),
    writeDecisionLogEntry: vi.fn(async () => ({ id: "d1" })),
    processMemoryCandidate: vi.fn(async () => {}),
    webSearchProvider: {
      search: vi.fn(async (query: string) => ({
        query,
        hits: [
          {
            sourceId: "web-1",
            title: "Fresh source",
            snippet: "Latest update from public source",
            url: "https://example.com/latest",
            stance: "supports",
          },
        ],
      })),
    },
    retrieveFileChunks: vi.fn(async () => ({ chunks: [], eligibleFileCount: 0 })),
    documentTutorContextService,
    getMockTutorResponse: vi.fn(async () => tutorResponse),
    ...overrides,
  };
}

describeService("sessionMessageApiService", () => {
  beforeAll(async () => {
    mod = (await import("../../../src/server/workspaces/sessionMessageApiService")) as ServiceModule;
  });

  describe("listMessagesForUser", () => {
    it("returns messages when workspace and session owned", async () => {
      const repos = makeRepos();
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.listMessagesForUser("alice", "ws-1", "s-1");
      expect(repos.listSessionMessages).toHaveBeenCalledWith("alice", "ws-1", "s-1");
      expect(result).toHaveLength(1);
    });

    it("throws 'Workspace not found.' when workspace missing", async () => {
      const repos = makeRepos({ getWorkspace: vi.fn(async () => null) });
      const service = mod.createSessionMessageApiService(repos);
      await expect(service.listMessagesForUser("bob", "ws-1", "s-1")).rejects.toThrow(
        "Workspace not found."
      );
    });

    it("throws 'Session not found.' when session missing", async () => {
      const repos = makeRepos({ getSession: vi.fn(async () => null) });
      const service = mod.createSessionMessageApiService(repos);
      await expect(service.listMessagesForUser("alice", "ws-1", "missing")).rejects.toThrow(
        "Session not found."
      );
    });

    it("uses trusted userId from auth user object", async () => {
      const repos = makeRepos();
      const service = mod.createSessionMessageApiService(repos);
      await service.listMessagesForUser(
        { userId: "alice", email: "alice@test" } as never,
        "ws-1",
        "s-1"
      );
      expect(repos.getWorkspace).toHaveBeenCalledWith("alice", "ws-1");
    });
  });

  describe("sendMessageForUser", () => {
    it("routes inventory requests to document model answer", async () => {
      const repos = makeRepos({
        documentTutorContextService: {
          classifyIntent: vi.fn(() => ({ intent: "document_inventory_request" })),
          resolveRelevantFileForDocumentIntent: vi.fn(async () => ({
            ok: true,
            resolved: {
              file: { id: "file-1", name: "Exam.pdf", originalFileName: "Exam.pdf" },
              pages: [],
              detectedQuestions: [],
              outline: null,
            },
          })),
          buildInventoryAnswer: vi.fn(() => "1. שאלה 1\n2. שאלה 2"),
        } as never,
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה שאלות יש בקובץ?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      expect(repos.appendMessage).toHaveBeenLastCalledWith(
        "alice",
        "ws-1",
        "s-1",
        expect.objectContaining({ role: "tutor", content: expect.stringContaining("שאלה") })
      );
      expect(result.internalUpdate).toMatchObject({
        detected_intent: "document_inventory_request",
      });
    });

    it("routes specific question request and uses grounded tutor call", async () => {
      const repos = makeRepos({
        documentTutorContextService: {
          classifyIntent: vi.fn(() => ({
            intent: "specific_detected_question_request",
            requestedQuestionNumber: 3,
          })),
          resolveRelevantFileForDocumentIntent: vi.fn(async () => ({
            ok: true,
            resolved: {
              file: { id: "file-1", name: "Exam.pdf", originalFileName: "Exam.pdf" },
              pages: [{ pageNumber: 2, extractedText: "שאלה 3: חשב", cleanedText: "שאלה 3: חשב" }],
              detectedQuestions: [{ id: "q3", labelRaw: "שאלה 3", questionNumber: 3, pageStart: 2, pageEnd: 2 }],
              outline: null,
            },
          })),
          resolveDetectedQuestionReference: vi.fn(() => ({
            ok: true,
            question: { id: "q3", labelRaw: "שאלה 3", questionNumber: 3, pageStart: 2, pageEnd: 2 },
          })),
          buildQuestionGrounding: vi.fn(() => ({
            contextText: "התמקד בשאלה 3",
            sourcePages: [{ pageNumber: 2, extractedText: "שאלה 3: חשב", cleanedText: "שאלה 3: חשב" }],
          })),
        } as never,
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "תסביר לי שאלה 3",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).toHaveBeenCalledTimes(1);
      expect(repos.appendMessage).toHaveBeenLastCalledWith(
        "alice",
        "ws-1",
        "s-1",
        expect.objectContaining({
          role: "tutor",
          citations: expect.arrayContaining([expect.objectContaining({ id: "page_0002" })]),
        })
      );
      expect(result.internalUpdate).toMatchObject({
        detected_intent: "specific_detected_question_request",
      });
    });

    it("returns visual limitation response for visual reference intent", async () => {
      const repos = makeRepos({
        documentTutorContextService: {
          classifyIntent: vi.fn(() => ({ intent: "visual_reference_request" })),
          buildVisualNotSupportedAnswer: vi.fn(() => "Visual understanding is not active yet."),
        } as never,
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "מה רואים בגרף?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.appendMessage).toHaveBeenLastCalledWith(
        "alice",
        "ws-1",
        "s-1",
        expect.objectContaining({ role: "tutor", content: expect.stringContaining("Visual understanding") })
      );
      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
    });

    it("appends user message, calls mock tutor, appends assistant message", async () => {
      const repos = makeRepos();
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      });
      expect(repos.appendMessage).toHaveBeenCalledTimes(2);
      expect(repos.appendMessage).toHaveBeenNthCalledWith(
        1,
        "alice",
        "ws-1",
        "s-1",
        expect.objectContaining({ role: "user", content: "hi" })
      );
      expect(repos.getMockTutorResponse).toHaveBeenCalledWith("hi", "Learning", "Normal Learning", [
        { role: "user", content: "hi" },
      ]);
      expect(repos.processMemoryCandidate).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "ws-1", userMessage: "hi" })
      );
      expect(repos.writeDecisionLogEntry).toHaveBeenCalledTimes(5);
      expect(repos.writeDecisionLogEntry).toHaveBeenNthCalledWith(
        1,
        "alice",
        expect.objectContaining({
          decisionType: "model_provider",
          title: "DeepSeek provider used",
          workspaceId: "ws-1",
          sessionId: "s-1",
        })
      );
      expect(repos.appendMessage).toHaveBeenNthCalledWith(
        2,
        "alice",
        "ws-1",
        "s-1",
        expect.objectContaining({ role: "tutor" })
      );
      expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({ decisionType: "retrieval_scope" })
      );
      expect(result).toMatchObject({
        internalUpdate: {
          retrieval: {
            used: true,
            source_ids: ["file-1"],
          },
        },
      });
      expect(result).toHaveProperty("userMessage");
      expect(result).toHaveProperty("assistantMessage");
      expect(result).toHaveProperty("internalUpdate");
    });

    it("maps memory_not_written events into memory_not_written decision type", async () => {
      const repos = makeRepos({
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          decisionLogEvents: [{ type: "memory_not_written", title: "skip", detail: "tmp chat" }],
        })),
      });
      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "hi",
        workMode: "Temporary Chat",
        costMode: "Normal Learning",
      });

      expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({ decisionType: "memory_not_written" })
      );
      expect(repos.processMemoryCandidate).not.toHaveBeenCalled();
    });

    it("throws 'Workspace not found.' when workspace missing", async () => {
      const repos = makeRepos({ getWorkspace: vi.fn(async () => null) });
      const service = mod.createSessionMessageApiService(repos);
      await expect(
        service.sendMessageForUser("bob", "s-1", {
          workspaceId: "ws-1",
          userMessage: "hi",
          workMode: "Learning",
          costMode: "Normal Learning",
        })
      ).rejects.toThrow("Workspace not found.");
    });

    it("throws 'Session not found.' when session missing", async () => {
      const repos = makeRepos({ getSession: vi.fn(async () => null) });
      const service = mod.createSessionMessageApiService(repos);
      await expect(
        service.sendMessageForUser("alice", "missing", {
          workspaceId: "ws-1",
          userMessage: "hi",
          workMode: "Learning",
          costMode: "Normal Learning",
        })
      ).rejects.toThrow("Session not found.");
    });

    it("skips retrieval execution when no indexed files are available", async () => {
      const repos = makeRepos({
        listUploadedFiles: vi.fn(async () => []),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(result).toMatchObject({
        internalUpdate: {
          retrieval: {
            used: false,
            source_ids: [],
            why: "retrieval_skipped_no_indexed_files",
          },
        },
      });
    });

    it("marks retrieval failed when repository lookup throws", async () => {
      const repos = makeRepos({
        listUploadedFiles: vi.fn(async () => {
          throw new Error("db_down");
        }),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(result).toMatchObject({
        internalUpdate: {
          retrieval: {
            used: false,
            why: "retrieval_failed_internal_error",
          },
        },
      });
      expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({ decision: expect.stringContaining("db_down"), decisionType: "retrieval_scope" })
      );
    });

    it("enforces Cheap Practice retrieval chunk budget", async () => {
      const repos = makeRepos({
        listUploadedFiles: vi.fn(async () => makeIndexedFiles(8)),
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "workspace",
              max_chunks: 8,
              max_tokens: 9000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "from my notes",
        workMode: "Practice",
        costMode: "Cheap Practice",
      });

      const internal = result.internalUpdate as { retrieval: { source_ids: string[] } };
      expect(internal.retrieval.source_ids).toHaveLength(2);
      expect(result).toMatchObject({
        internalUpdate: {
          retrieval_decision: {
            retrieval_scope: "topic",
          },
        },
      });
    });

    it("enforces Normal Learning retrieval chunk budget", async () => {
      const repos = makeRepos({
        listUploadedFiles: vi.fn(async () => makeIndexedFiles(8)),
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "workspace",
              max_chunks: 8,
              max_tokens: 9000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "from my notes",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const internal = result.internalUpdate as { retrieval: { source_ids: string[] } };
      expect(internal.retrieval.source_ids).toHaveLength(4);
    });

    it("enforces Deep Research retrieval chunk budget", async () => {
      const repos = makeRepos({
        listUploadedFiles: vi.fn(async () => makeIndexedFiles(12)),
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "workspace",
              max_chunks: 12,
              max_tokens: 18000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "from my notes",
        workMode: "Research",
        costMode: "Deep Research",
      });

      const internal = result.internalUpdate as { retrieval: { source_ids: string[] } };
      expect(internal.retrieval.source_ids).toHaveLength(10);
    });

    it("executes web retrieval in Research mode when freshness cues are present", async () => {
      const repos = makeRepos({
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "web",
              max_chunks: 6,
              max_tokens: 7000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "latest updates",
        workMode: "Research",
        costMode: "Normal Learning",
      });

      expect(repos.webSearchProvider.search).toHaveBeenCalledWith("latest updates");
      expect(result).toMatchObject({
        internalUpdate: {
          retrieval: {
            scope: "web",
            used: true,
          },
        },
      });
      expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({
          decisionType: "web_search",
          title: "Web search executed",
        })
      );
    });

    it("skips web retrieval when freshness cue is missing", async () => {
      const repos = makeRepos({
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "web",
              max_chunks: 6,
              max_tokens: 7000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "summarize the concept",
        workMode: "Research",
        costMode: "Normal Learning",
      });

      expect(repos.webSearchProvider.search).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        internalUpdate: {
          retrieval: {
            scope: "web",
            used: false,
            why: "web_search_skipped_no_freshness_signal",
          },
        },
      });
      expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({
          decisionType: "web_search",
          title: "Web search skipped",
        })
      );
    });

    it("applies Build project-context policy to workspace scope", async () => {
      const repos = makeRepos({
        listUploadedFiles: vi.fn(async () => makeIndexedFiles(5)),
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "session",
              max_chunks: 4,
              max_tokens: 5000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "help me build this project",
        workMode: "Build",
        costMode: "Normal Learning",
      });

      expect(result).toMatchObject({
        internalUpdate: {
          retrieval_decision: {
            retrieval_scope: "workspace",
          },
          retrieval: {
            scope: "workspace",
          },
        },
      });
      expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({
          decisionType: "retrieval_scope",
          title: "Build project-context policy applied",
        })
      );
    });
  });

  describe("chunk retrieval integration", () => {
    it("uses persisted chunks when eligible files exist and chunks match", async () => {
      const matchingChunks = [
        {
          chunkId: "ck-1",
          fileId: "file-A",
          workspaceId: "ws-1",
          text: "Newton laws motion force",
          chunkIndex: 0,
          tokenEstimate: 80,
          score: 3,
          semanticScore: 0.88,
          finalScore: 0.88,
          sourceLabel: "Physics.pdf",
          retrievalMethod: "semantic",
        },
        {
          chunkId: "ck-2",
          fileId: "file-A",
          workspaceId: "ws-1",
          text: "acceleration second law force",
          chunkIndex: 1,
          tokenEstimate: 60,
          score: 2,
          semanticScore: 0.85,
          finalScore: 0.85,
          sourceLabel: "Physics.pdf",
          retrievalMethod: "semantic",
        },
      ];

      const repos = makeRepos({
        appendMessage: vi.fn(
          async (_uid: string, _wsId: string, _sessId: string, input: Record<string, unknown>) =>
            input.role === "user"
              ? baseMessage
              : { ...tutorMessage, citations: input.citations }
        ),
        retrieveFileChunks: vi.fn(async () => ({
          chunks: matchingChunks,
          eligibleFileCount: 1,
        })),
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "workspace",
              max_chunks: 4,
              max_tokens: 5000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "explain Newton laws force",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.retrieveFileChunks).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "alice",
          workspaceId: "ws-1",
          query: "explain Newton laws force",
        })
      );
      expect(result).toMatchObject({
        internalUpdate: {
          retrieval: {
            used: true,
            source_ids: ["ck-1", "ck-2"],
            why: expect.stringContaining("semantic_retrieval_executed"),
          },
        },
      });

      const assistantMsg = result.assistantMessage as { citations?: Array<{ id: string; sourceId: string; referenceText: string }> };
      expect(assistantMsg.citations).toBeDefined();
      expect(assistantMsg.citations![0]).toMatchObject({
        id: "ck-1",
        sourceId: "file-A:ck-1",
        referenceText: expect.stringContaining("Newton"),
      });
    });

    it("skips retrieval with no_matching_file_chunks when eligible files exist but no chunks match", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({
          chunks: [],
          eligibleFileCount: 2,
        })),
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "workspace",
              max_chunks: 4,
              max_tokens: 5000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(result).toMatchObject({
        internalUpdate: {
          retrieval: {
            used: false,
            why: "no_matching_file_chunks",
          },
        },
      });
      expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({
          decisionType: "retrieval_scope",
          title: "Retrieval skipped",
        })
      );
    });

    it("falls back to indexed-file retrieval when no chunked files exist", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({ chunks: [], eligibleFileCount: 0 })),
        listUploadedFiles: vi.fn(async () => [
          {
            id: "file-1",
            name: "Mechanics.pdf",
            indexingStatus: "indexed",
            summaryStatus: "ready",
            summaryText: "Summary text here",
            confidence: 0.9,
          },
        ]),
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "workspace",
              max_chunks: 4,
              max_tokens: 5000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(result).toMatchObject({
        internalUpdate: {
          retrieval: {
            used: true,
            source_ids: ["file-1"],
          },
        },
      });
    });

    it("marks retrieval_failed when retrieveFileChunks throws", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => {
          throw new Error("chunk_db_down");
        }),
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "workspace",
              max_chunks: 4,
              max_tokens: 5000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(result).toMatchObject({
        internalUpdate: {
          retrieval: {
            used: false,
            why: "retrieval_failed_internal_error",
          },
        },
      });
      expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({
          decisionType: "retrieval_scope",
          title: "Retrieval failed",
          decision: expect.stringContaining("chunk_db_down"),
        })
      );
    });

    it("decision log includes retrieval_executed event with chunk ids", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({
          chunks: [
            {
              chunkId: "ck-X",
              fileId: "file-B",
              workspaceId: "ws-1",
              text: "some content",
              chunkIndex: 0,
              tokenEstimate: 50,
              score: 1,
              sourceLabel: "doc.pdf",
            },
          ],
          eligibleFileCount: 1,
        })),
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "topic",
              max_chunks: 4,
              max_tokens: 5000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "some content query",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({
          decisionType: "retrieval_scope",
          title: "Retrieval executed",
          decision: expect.stringContaining("ck-X"),
        })
      );
    });

    it("marks keyword fallback when semantic retrieval is unavailable", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({
          chunks: [
            {
              chunkId: "ck-F",
              fileId: "file-B",
              workspaceId: "ws-1",
              text: "force laws",
              chunkIndex: 0,
              tokenEstimate: 50,
              score: 2,
              sourceLabel: "doc.pdf",
              retrievalMethod: "keyword_fallback",
            },
          ],
          eligibleFileCount: 1,
        })),
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "topic",
              max_chunks: 4,
              max_tokens: 5000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "force laws",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(result).toMatchObject({
        internalUpdate: {
          retrieval: {
            used: true,
            why: expect.stringContaining("keyword_fallback"),
          },
        },
      });
    });

    it("web retrieval path is unaffected when scope is web", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({ chunks: [], eligibleFileCount: 0 })),
        getMockTutorResponse: vi.fn(async () => ({
          ...tutorResponse,
          internalUpdate: {
            ...tutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: true,
              retrieval_scope: "web",
              max_chunks: 4,
              max_tokens: 5000,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "latest news today",
        workMode: "Research",
        costMode: "Normal Learning",
      });

      expect(repos.retrieveFileChunks).not.toHaveBeenCalled();
      expect(repos.webSearchProvider.search).toHaveBeenCalledWith("latest news today");
    });
  });

  describe("grounded provider call (Phase 19)", () => {
    const chunkedTutorDecision = {
      ...tutorResponse,
      internalUpdate: {
        ...tutorResponse.internalUpdate,
        retrieval_decision: {
          needs_retrieval: true,
          retrieval_scope: "workspace",
          max_chunks: 4,
          max_tokens: 5000,
          should_ask_clarification_first: false,
        },
      },
    };

    const matchingChunk = {
      chunkId: "ck-grnd",
      fileId: "file-G",
      workspaceId: "ws-1",
      text: "Grounding text from uploaded file",
      chunkIndex: 0,
      tokenEstimate: 80,
      score: 3,
      sourceLabel: "Physics.pdf",
    };

    it("calls getMockTutorResponse twice when chunks are found — once initial, once grounded", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({
          chunks: [matchingChunk],
          eligibleFileCount: 1,
        })),
        getMockTutorResponse: vi.fn(async () => chunkedTutorDecision),
      });

      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).toHaveBeenCalledTimes(2);
    });

    it("second provider call receives groundingContext with retrieved chunks", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({
          chunks: [matchingChunk],
          eligibleFileCount: 1,
        })),
        getMockTutorResponse: vi.fn(async () => chunkedTutorDecision),
      });

      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const calls = (repos.getMockTutorResponse as ReturnType<typeof vi.fn>).mock.calls;
      const secondCall = calls[1];
      const groundingContext = secondCall[4];
      expect(groundingContext).toBeDefined();
      expect(groundingContext.mode).toBe("file_chunks");
      expect(groundingContext.chunks).toHaveLength(1);
      expect(groundingContext.chunks[0].sourceId).toBe("file-G:ck-grnd");
      expect(groundingContext.chunks[0].text).toContain("Grounding text");
    });

    it("does NOT call getMockTutorResponse a second time when no chunks found", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({ chunks: [], eligibleFileCount: 0 })),
        getMockTutorResponse: vi.fn(async () => chunkedTutorDecision),
      });

      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).toHaveBeenCalledTimes(1);
    });

    it("transcript has exactly one user and one tutor message when chunks found", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({
          chunks: [matchingChunk],
          eligibleFileCount: 1,
        })),
        getMockTutorResponse: vi.fn(async () => chunkedTutorDecision),
      });

      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.appendMessage).toHaveBeenCalledTimes(2);
      expect(repos.appendMessage).toHaveBeenNthCalledWith(
        1, "alice", "ws-1", "s-1", expect.objectContaining({ role: "user" })
      );
      expect(repos.appendMessage).toHaveBeenNthCalledWith(
        2, "alice", "ws-1", "s-1", expect.objectContaining({ role: "tutor" })
      );
    });

    it("decision log includes grounded provider call event when chunks found", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({
          chunks: [matchingChunk],
          eligibleFileCount: 1,
        })),
        getMockTutorResponse: vi.fn(async () => chunkedTutorDecision),
      });

      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({
          decisionType: "retrieval_scope",
          title: "Grounded provider call executed",
          decision: expect.stringContaining("grounding_context_injected=true"),
        })
      );
    });

    it("grounded content from second provider call replaces initial message content", async () => {
      const repos = makeRepos({
        appendMessage: vi.fn(
          async (_uid: string, _wsId: string, _sessId: string, input: Record<string, unknown>) =>
            input.role === "user"
              ? baseMessage
              : { ...tutorMessage, content: input.content as string }
        ),
        retrieveFileChunks: vi.fn(async () => ({
          chunks: [matchingChunk],
          eligibleFileCount: 1,
        })),
        getMockTutorResponse: vi.fn(
          async (
            _msg: string,
            _wm: string,
            _cm: string,
            _hist?: unknown,
            groundingCtx?: { mode: string; chunks?: unknown[] }
          ) => {
            if (groundingCtx?.mode === "file_chunks") {
              return {
                ...chunkedTutorDecision,
                message: { id: "m2", role: "tutor", content: "grounded answer with file content" },
              };
            }
            return chunkedTutorDecision;
          }
        ),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toBe("grounded answer with file content");
    });
  });
});
