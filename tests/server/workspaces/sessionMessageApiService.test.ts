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
    listFileChunks: (userId: string, workspaceId: string, fileId: string) => Promise<Array<Record<string, unknown>>>;
    listDocumentPages: (userId: string, fileId: string) => Promise<Array<Record<string, unknown>>>;
    getDocumentOutline: (userId: string, fileId: string, outlineId?: string) => Promise<Record<string, unknown> | null>;
    listDetectedQuestions: (userId: string, fileId: string) => Promise<Array<Record<string, unknown>>>;
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
        summaryText: "Mechanics course overview: Newton's laws, kinematics, energy conservation.",
        confidence: 0.9,
      },
    ]),
    listFileChunks: vi.fn(async () => []),
    listDocumentPages: vi.fn(async () => []),
    getDocumentOutline: vi.fn(async () => null),
    listDetectedQuestions: vi.fn(async () => []),
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
            stance: "supports" as const,
          },
        ],
      })),
    },
    retrieveFileChunks: vi.fn(async () => ({ chunks: [], eligibleFileCount: 0 })),
    getMockTutorResponse: vi.fn(async () => tutorResponse),
    ...overrides,
  };
}

describeService("sessionMessageApiService", () => {
  beforeAll(async () => {
    mod = (await import("../../../src/server/workspaces/sessionMessageApiService")) as unknown as ServiceModule;
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

    it("does not use placeholder summaryText as grounding — reports retrieval_skipped_placeholder_content_only", async () => {
      const repos = makeRepos({
        listUploadedFiles: vi.fn(async () => [
          {
            id: "file-ph",
            name: "hw5.pdf",
            indexingStatus: "indexed",
            summaryStatus: "ready",
            summaryText: "Summary placeholder; content extraction not enabled yet.",
            confidence: 0.9,
          },
        ]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const update = result.internalUpdate as { retrieval: { used: boolean; why: string; source_ids: string[] } };
      expect(update.retrieval.used).toBe(false);
      expect(update.retrieval.why).toBe("retrieval_skipped_placeholder_content_only");
      expect(update.retrieval.source_ids).toHaveLength(0);
      // placeholder text must not appear in any citation
      const assistant = result.assistantMessage as { citations?: Array<{ referenceText: string }> };
      const citationTexts = (assistant.citations ?? []).map((c) => c.referenceText).join("\n");
      expect(citationTexts).not.toContain("Summary placeholder");
    });

    it("uses real summaryText as grounding when available alongside placeholder files", async () => {
      const repos = makeRepos({
        listUploadedFiles: vi.fn(async () => [
          {
            id: "file-real",
            name: "Notes.pdf",
            indexingStatus: "indexed",
            summaryStatus: "ready",
            summaryText: "Newton's laws cover force, mass, and acceleration.",
            confidence: 0.95,
          },
          {
            id: "file-ph",
            name: "hw5.pdf",
            indexingStatus: "indexed",
            summaryStatus: "ready",
            summaryText: "Summary placeholder; content extraction not enabled yet.",
            confidence: 0.9,
          },
        ]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      // real file was selected, placeholder excluded
      const update2 = result.internalUpdate as { retrieval: { used: boolean; source_ids: string[] } };
      expect(update2.retrieval.used).toBe(true);
      expect(update2.retrieval.source_ids).toContain("file-real");
      expect(update2.retrieval.source_ids).not.toContain("file-ph");
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

  describe("file-access awareness shortcut", () => {
    const readyFile = {
      id: "file-ready",
      name: "פיזיקה_2_מטלה_5.pdf",
      originalFileName: "פיזיקה 2 מטלה 5.pdf",
      extractionStatus: "completed",
      chunkingStatus: "completed",
      indexingStatus: "indexed",
    };

    const processingFile = {
      id: "file-proc",
      name: "notes.pdf",
      extractionStatus: "pending",
      chunkingStatus: "not_started",
      indexingStatus: "uploaded",
    };

    function makeContentReflectingRepos(overrides: Partial<Parameters<ServiceModule["createSessionMessageApiService"]>[0]> = {}) {
      return makeRepos({
        appendMessage: vi.fn(
          async (_uid: string, _wsId: string, _sessId: string, input: Record<string, unknown>) =>
            input.role === "user" ? baseMessage : { ...tutorMessage, content: input.content as string }
        ),
        ...overrides,
      });
    }

    it("returns deterministic yes-answer when ready file exists and model is NOT called", async () => {
      const repos = makeContentReflectingRepos({
        listUploadedFiles: vi.fn(async () => [readyFile]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "האם אתה יכול לראות שאלות מהקובץ פיזיקה 2 מטלה 5",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/כן/);
      expect(assistant.content).toMatch(/טקסט שחולץ/);
    });

    it("includes the original file name in the file-access response", async () => {
      const repos = makeContentReflectingRepos({
        listUploadedFiles: vi.fn(async () => [readyFile]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "האם אתה יכול לראות את הקובץ?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toContain("פיזיקה 2 מטלה 5.pdf");
    });

    it("returns processing message when file is still being processed", async () => {
      const repos = makeContentReflectingRepos({
        listUploadedFiles: vi.fn(async () => [processingFile]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "האם אתה יכול לראות את הקובץ?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/עיבוד/);
    });

    it("returns no-file message when no files are uploaded", async () => {
      const repos = makeContentReflectingRepos({
        listUploadedFiles: vi.fn(async () => []),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "האם אתה יכול לראות את הקובץ?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/לא נמצאו קבצים/);
    });

    it("includes visual limitation note in the yes-answer", async () => {
      const repos = makeContentReflectingRepos({
        listUploadedFiles: vi.fn(async () => [readyFile]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "האם אתה יכול לראות שאלות מהקובץ?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/חזותית/);
    });

    it("does not trigger file-access shortcut for regular content questions", async () => {
      const repos = makeRepos({
        listUploadedFiles: vi.fn(async () => [readyFile]),
      });
      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "תסביר לי מה זה פוטנציאל חשמלי",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).toHaveBeenCalled();
    });
  });

  describe("file-content inventory shortcut", () => {
    const readyFileWithChunks = {
      id: "file-inv",
      name: "physics_hw5.pdf",
      originalFileName: "פיזיקה 2 מטלה 5.pdf",
      extractionStatus: "completed",
      chunkingStatus: "completed",
      indexingStatus: "indexed",
    };

    const questionChunks = [
      { chunkId: "c0", userId: "alice", workspaceId: "ws-1", fileId: "file-inv", text: "שאלה 1\nחשב את הפוטנציאל...", chunkIndex: 0, charStart: 0, charEnd: 50, tokenEstimate: 20, source: "extracted_text", createdAt: new Date() },
      { chunkId: "c1", userId: "alice", workspaceId: "ws-1", fileId: "file-inv", text: "שאלה 2\nמצא את עוצמת השדה...", chunkIndex: 1, charStart: 50, charEnd: 100, tokenEstimate: 20, source: "extracted_text", createdAt: new Date() },
    ];

    function makeInventoryRepos(overrides: Partial<Parameters<ServiceModule["createSessionMessageApiService"]>[0]> = {}) {
      return makeRepos({
        appendMessage: vi.fn(
          async (_uid: string, _wsId: string, _sessId: string, input: Record<string, unknown>) =>
            input.role === "user" ? baseMessage : { ...tutorMessage, content: input.content as string }
        ),
        listUploadedFiles: vi.fn(async () => [readyFileWithChunks]),
        listFileChunks: vi.fn(async () => questionChunks),
        ...overrides,
      });
    }

    it("routes 'איזה שאלות יש בקובץ?' to inventory shortcut — model NOT called, chunks scanned via buildFileInventory", async () => {
      const repos = makeInventoryRepos();
      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה שאלות יש בקובץ?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      expect(repos.listFileChunks).toHaveBeenCalledWith("alice", "ws-1", "file-inv");
    });

    it("routes original failing question 'איזה שאלות אתה יכול לראות בקובץ?' to inventory — model NOT called", async () => {
      const repos = makeInventoryRepos();
      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה שאלות אתה יכול לראות בקובץ?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
    });

    it("routes uploaded-file inventory phrasing to local inventory response and bypasses model", async () => {
      const repos = makeInventoryRepos();
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      expect(repos.listUploadedFiles).toHaveBeenCalledWith("alice", "ws-1");
      expect(repos.listFileChunks).toHaveBeenCalledWith("alice", "ws-1", "file-inv");
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/כן, אני רואה|נראה שזה קובץ/);
      expect(assistant.content).toContain("שאלה 1");
      expect(assistant.content).not.toMatch(/אין לי גישה ישירה/i);
      expect(assistant.content).not.toMatch(/הקובץ זוהה והטקסט חולץ|מקטעים שזוהו|אני עובד עם הטקסט שחולץ/);
    });

    it("uses persisted document artifacts when understandingStatus is completed and artifacts are useful", async () => {
      const artifactFile = {
        ...readyFileWithChunks,
        understandingStatus: "completed" as const,
        pageCount: 4,
        outlineTitle: "מטלה 5",
        detectedQuestionCount: 2,
        extractionQuality: "good" as const,
        deepPdfStatus: "not_started" as const,
      };
      const repos = makeInventoryRepos({
        listUploadedFiles: vi.fn(async () => [artifactFile]),
        listFileChunks: vi.fn(async () => questionChunks),
        getDocumentOutline: vi.fn(async () => ({
          outlineId: "v1",
          userId: "alice",
          fileId: "file-inv",
          title: "מטלה 5",
          sections: [],
          confidence: "high",
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        listDetectedQuestions: vi.fn(async () => [
          {
            questionId: "q-1",
            userId: "alice",
            fileId: "file-inv",
            label: "שאלה 1",
            questionNumber: 1,
            summary: "חשב את הפוטנציאל החשמלי.",
            pageStart: 2,
            pageEnd: 2,
            charStart: 0,
            charEnd: 30,
            sourceChunkIds: [],
            subsections: [],
            confidence: 0.92,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            questionId: "q-2",
            userId: "alice",
            fileId: "file-inv",
            label: "שאלה 2",
            questionNumber: 2,
            summary: "מצא את עוצמת השדה.",
            pageStart: 3,
            pageEnd: 3,
            charStart: 31,
            charEnd: 60,
            sourceChunkIds: [],
            subsections: [],
            confidence: 0.88,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      expect(repos.getDocumentOutline).toHaveBeenCalledWith("alice", "file-inv");
      expect(repos.listDetectedQuestions).toHaveBeenCalledWith("alice", "file-inv");
      expect(repos.listFileChunks).not.toHaveBeenCalled();
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/כן, אני רואה|נראה שזה קובץ/);
      expect(assistant.content).toContain("חשב את הפוטנציאל החשמלי");
      expect(assistant.content).not.toContain("0 0 1 2");
      expect(assistant.content).not.toMatch(/מספר עמודים שזוהו|מספר שאלות\/מקטעים שזוהו/);
    });

    it("inventory response avoids backend status-report wording", async () => {
      const repos = makeInventoryRepos();
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "תן לי רשימת שאלות מהקובץ",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).not.toMatch(/הקובץ זוהה והטקסט חולץ|אני עובד עם הטקסט שחולץ|מקטעים שזוהו חלקית/);
    });

    it("falls back to chunk-based inventory when understandingStatus is missing", async () => {
      const repos = makeInventoryRepos({
        listUploadedFiles: vi.fn(async () => [{ ...readyFileWithChunks, understandingStatus: undefined }]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "מה יש בקבצים שהעליתי?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.listFileChunks).toHaveBeenCalledWith("alice", "ws-1", "file-inv");
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toContain("שאלה 1");
    });

    it("falls back safely when understandingStatus is failed", async () => {
      const repos = makeInventoryRepos({
        listUploadedFiles: vi.fn(async () => [{ ...readyFileWithChunks, understandingStatus: "failed" }]),
      });
      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "תראה לי את הקבצים שהעליתי",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.listFileChunks).toHaveBeenCalledWith("alice", "ws-1", "file-inv");
      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
    });

    it("inventory: real sections listed, no refusal, offers to start from a question", async () => {
      const repos = makeInventoryRepos();
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה שאלות יש בקובץ?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).not.toMatch(/אני לא יכול/i);
      // must not dump raw chunk artifacts
      expect(assistant.content).not.toMatch(/-- \d+ of \d+/);
      expect(assistant.content).toMatch(/כן, אני רואה|נראה שזה קובץ/);
      // must include real section headings found in the chunks
      expect(assistant.content).toMatch(/שאלה [12]|נתחיל משאלה/);
    });

    it("when no ready files, inventory returns no-file message without calling model", async () => {
      const repos = makeInventoryRepos({ listUploadedFiles: vi.fn(async () => []) });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה שאלות יש בקובץ?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      expect(repos.listFileChunks).not.toHaveBeenCalled();
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/לא נמצאו קבצים/i);
    });

    it("inventory response includes section headings extracted from real chunk text", async () => {
      const repos = makeInventoryRepos();
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "תן לי רשימת שאלות מהקובץ",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const assistant = result.assistantMessage as { content?: string };
      // buildFileInventory scans chunk text — "שאלה 1" and "שאלה 2" are headings in questionChunks
      expect(assistant.content).toContain("שאלה 1");
      expect(assistant.content).toContain("שאלה 2");
      // file name used in inventory comes from originalFileName
      // model was not called — deterministic path
      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
    });

    it("for garbled math-heavy chunks, inventory bypasses model, hides broken snippet, and returns one structured warning", async () => {
      const garbledChunks = [
        {
          chunkId: "cg-0",
          userId: "alice",
          workspaceId: "ws-1",
          fileId: "file-inv",
          text: "שאלה 1\n0 0 1 2  a B I ",
          chunkIndex: 0,
          charStart: 0,
          charEnd: 25,
          tokenEstimate: 10,
          source: "extracted_text",
          createdAt: new Date(),
        },
      ];
      const repos = makeInventoryRepos({
        listFileChunks: vi.fn(async () => garbledChunks),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה שאלות יש בקובץ?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).not.toMatch(/אין לי גישה ישירה/i);
      expect(assistant.content).not.toContain("0 0 1 2  a B I ");
      expect(assistant.content).toMatch(/כן, אני רואה|נראה שזה קובץ/);
      expect(assistant.content).toMatch(/חלק מהנוסחאות.*לא חולצו מספיק טוב/);
      expect(assistant.content).toMatch(/אני לא רוצה להציג אותן כאילו הן ודאיות/);
      expect(assistant.content).not.toContain("תצוגת הנוסחה/הסימון הושמטה");
      expect(assistant.content).not.toMatch(/הקובץ זוהה והטקסט חולץ|מקטעים שזוהו חלקית|אני עובד עם הטקסט שחולץ/);
      expect(assistant.content).toMatch(/שאלה|מקטע|עמוד/);
      expect(assistant.content).not.toMatch(/אני רואה את ה-PDF|יכול לראות את ה-PDF|Gemini/);
    });

    it("artifact-aware inventory includes honest quality warning for poor extraction and does not claim reliable formulas", async () => {
      const repos = makeInventoryRepos({
        listUploadedFiles: vi.fn(async () => [
          {
            ...readyFileWithChunks,
            understandingStatus: "completed",
            pageCount: 2,
            detectedQuestionCount: 1,
            extractionQuality: "poor",
            deepPdfStatus: "not_started",
          },
        ]),
        getDocumentOutline: vi.fn(async () => ({
          outlineId: "v1",
          userId: "alice",
          fileId: "file-inv",
          title: "פיזיקה",
          sections: [],
          confidence: "medium",
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        listDetectedQuestions: vi.fn(async () => [
          {
            questionId: "q-1",
            userId: "alice",
            fileId: "file-inv",
            label: "שאלה 1",
            topic: "שדה מגנטי",
            pageStart: 2,
            pageEnd: 2,
            charStart: 0,
            charEnd: 20,
            sourceChunkIds: [],
            subsections: [],
            confidence: 0.54,
            extractionNotes: "math_garbled",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה שאלות יש בקובץ?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/חלק מהנוסחאות.*לא חולצו מספיק טוב/);
      expect(assistant.content).not.toMatch(/נוסחה תקינה|אני רואה את ה-PDF|Gemini|אני עובד עם הטקסט שחולץ/);
    });

    it("artifact-aware inventory uses deepPdfStatus recommended wording without claiming Gemini ran", async () => {
      const repos = makeInventoryRepos({
        listUploadedFiles: vi.fn(async () => [
          {
            ...readyFileWithChunks,
            understandingStatus: "completed",
            pageCount: 2,
            detectedQuestionCount: 1,
            extractionQuality: "partial",
            deepPdfStatus: "recommended",
          },
        ]),
        getDocumentOutline: vi.fn(async () => ({
          outlineId: "v1",
          userId: "alice",
          fileId: "file-inv",
          title: "פיזיקה",
          sections: [],
          confidence: "medium",
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        listDetectedQuestions: vi.fn(async () => [
          {
            questionId: "q-1",
            userId: "alice",
            fileId: "file-inv",
            label: "שאלה 1",
            summary: "חשב את השדה החשמלי.",
            pageStart: 1,
            pageEnd: 1,
            charStart: 0,
            charEnd: 20,
            sourceChunkIds: [],
            subsections: [],
            confidence: 0.82,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה שאלות יש בקובץ?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/כדאי לבחור|הכי טוב לבחור|עדיף לבחור/);
      expect(assistant.content).not.toMatch(/Gemini|נותח כבר|נותח באמצעות/);
    });

    it("suppresses weak duplicate artifact sections and returns a general warning instead of fake summaries", async () => {
      const repos = makeInventoryRepos({
        listUploadedFiles: vi.fn(async () => [
          {
            ...readyFileWithChunks,
            understandingStatus: "completed",
            pageCount: 4,
            detectedQuestionCount: 2,
            extractionQuality: "poor",
            deepPdfStatus: "not_started",
          },
        ]),
        getDocumentOutline: vi.fn(async () => ({
          outlineId: "v1",
          userId: "alice",
          fileId: "file-inv",
          title: "פיזיקה",
          sections: [],
          confidence: "medium",
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        listDetectedQuestions: vi.fn(async () => [
          {
            questionId: "q-1",
            userId: "alice",
            fileId: "file-inv",
            label: "מקטע ג׳",
            summary: "א ת השטף המגנטי",
            pageStart: 2,
            pageEnd: 2,
            charStart: 0,
            charEnd: 20,
            sourceChunkIds: [],
            subsections: [],
            confidence: 0.51,
            extractionNotes: "spacing_corruption",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            questionId: "q-2",
            userId: "alice",
            fileId: "file-inv",
            label: "מקטע ג׳",
            summary: "פרמטרים,,, a b R I",
            pageStart: 3,
            pageEnd: 3,
            charStart: 21,
            charEnd: 40,
            sourceChunkIds: [],
            subsections: [],
            confidence: 0.49,
            extractionNotes: "punctuation_corruption",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      expect(repos.listFileChunks).not.toHaveBeenCalled();
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/חלק מהנוסחאות.*לא חולצו מספיק טוב|אני לא רוצה להציג/);
      expect(assistant.content).not.toContain("א ת השטף המגנטי");
      expect(assistant.content).not.toContain("פרמטרים,,, a b R I");
      expect(assistant.content?.match(/מקטע ג׳/g)?.length ?? 0).toBeLessThanOrEqual(1);
    });

    it("when files exist but not processed, inventory lists them with status", async () => {
      const processingFile = {
        id: "file-proc",
        name: "math_hw.pdf",
        originalFileName: "מתמטיקה שיעורי בית.pdf",
        extractionStatus: "pending" as const,
        chunkingStatus: "not_started" as const,
        indexingStatus: "uploaded",
      };
      const repos = makeInventoryRepos({
        listUploadedFiles: vi.fn(async () => [processingFile]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "מה יש בקבצים שהעליתי?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      expect(repos.listFileChunks).not.toHaveBeenCalled();
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/עדיין בעיבוד|בעיבוד/);
      expect(assistant.content).toContain("מתמטיקה שיעורי בית.pdf");
    });

    it("when uploaded files exist but chunks are not ready, uploaded-file inventory phrasing reports processing state", async () => {
      const processingFile = {
        id: "file-proc-2",
        name: "chem_hw.pdf",
        originalFileName: "כימיה תרגול.pdf",
        extractionStatus: "completed" as const,
        chunkingStatus: "pending" as const,
        indexingStatus: "uploaded",
      };
      const repos = makeInventoryRepos({
        listUploadedFiles: vi.fn(async () => [processingFile]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "תראה לי את הקבצים שהעליתי",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      expect(repos.listFileChunks).not.toHaveBeenCalled();
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/עדיין בעיבוד|בעיבוד/);
      expect(assistant.content).toContain("כימיה תרגול.pdf");
    });

    it("suppresses weak chunk fallback snippets when artifact-aware inventory is unavailable", async () => {
      const repos = makeInventoryRepos({
        listUploadedFiles: vi.fn(async () => [
          {
            ...readyFileWithChunks,
            understandingStatus: "failed",
          },
        ]),
        listFileChunks: vi.fn(async () => [
          {
            chunkId: "c-1",
            userId: "alice",
            workspaceId: "ws-1",
            fileId: "file-inv",
            chunkIndex: 0,
            text: "ג.\nא ת השטף המגנטי",
            embedding: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            chunkId: "c-2",
            userId: "alice",
            workspaceId: "ws-1",
            fileId: "file-inv",
            chunkIndex: 1,
            text: "ג.\nפרמטרים,,, a b R I",
            embedding: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      expect(repos.listFileChunks).toHaveBeenCalled();
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/הטקסט שיצא מהם לא מספיק נקי כדי לסכם אותם בביטחון/);
      expect(assistant.content).not.toContain("א ת השטף המגנטי");
      expect(assistant.content).not.toContain("פרמטרים,,, a b R I");
      expect(assistant.content?.match(/מקטע ג׳/g)?.length ?? 0).toBeLessThanOrEqual(1);
    });

    it("when no uploaded files exist, uploaded-file inventory phrasing reports no files", async () => {
      const repos = makeInventoryRepos({
        listUploadedFiles: vi.fn(async () => []),
      });
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "איזה קבצים העליתי?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      expect(repos.listFileChunks).not.toHaveBeenCalled();
      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/לא נמצאו קבצים/);
    });

    it("does not route specific question 'תסביר שאלה 3' to inventory", async () => {
      const repos = makeInventoryRepos();
      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "תסביר לי שאלה 3",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).toHaveBeenCalled();
      expect(repos.listFileChunks).not.toHaveBeenCalled();
    });
  });

  describe("visual reference shortcut", () => {
    function makeVisualRepos() {
      return makeRepos({
        appendMessage: vi.fn(
          async (_uid: string, _wsId: string, _sessId: string, input: Record<string, unknown>) =>
            input.role === "user" ? baseMessage : { ...tutorMessage, content: input.content as string }
        ),
      });
    }

    it("routes 'מה רואים בגרף?' to visual shortcut — model NOT called", async () => {
      const repos = makeVisualRepos();
      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "מה רואים בגרף?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
    });

    it("visual shortcut response mentions visual PDF understanding is not active", async () => {
      const repos = makeVisualRepos();
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "תסביר את המעגל בתמונה",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const assistant = result.assistantMessage as { content?: string };
      expect(assistant.content).toMatch(/חזותי/i);
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
