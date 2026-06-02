/**
 * MVP behavior regression: upload → extraction → chunking → retrieval → grounded answer.
 *
 * No real Firebase Storage, no real API keys, no network calls.
 * All deps injected via createSessionMessageApiService mock repos.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

const SERVICE_FILE = resolve(
  process.cwd(),
  "src/server/workspaces/sessionMessageApiService.ts"
);
const hasFile = existsSync(SERVICE_FILE);
const describeMvp = hasFile ? describe : describe.skip;

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
  createSessionMessageApiService: (repos?: Record<string, unknown>) => {
    sendMessageForUser: (
      user: string,
      sessionId: string,
      input: Record<string, unknown>
    ) => Promise<{
      userMessage: { id: string; role: string; content: string };
      assistantMessage: { id: string; role: string; content: string; citations?: Array<{ id: string; sourceId: string; referenceText: string }> };
      internalUpdate: {
        retrieval: { used: boolean; scope: string; source_ids: string[]; why: string };
        retrieval_decision?: { needs_retrieval: boolean; retrieval_scope: string };
      };
    }>;
  };
};

let mod: ServiceModule;

const baseUserMessage = {
  id: "m-user",
  role: "user",
  content: "explain Newton",
  userId: "alice",
  workspaceId: "ws-physics",
  sessionId: "sess-1",
  sequence: 1,
  createdAt: new Date(),
  status: "sent",
};

const baseTutorMessage = {
  id: "m-tutor",
  role: "tutor",
  content: "Mock tutor answer about Newton",
  userId: "alice",
  workspaceId: "ws-physics",
  sessionId: "sess-1",
  sequence: 2,
  createdAt: new Date(),
  status: "sent",
};

const baseTutorResponse = {
  message: { id: "m-tutor", role: "tutor", content: "Mock tutor answer about Newton" },
  internalUpdate: {
    detected_intent: "factual_or_regular",
    confidence: 0.9,
    should_stop_progression: false,
    local_question: { detected: false, reason: "" },
    retrieval: { used: false, scope: "none", source_ids: [], why: "" },
    retrieval_decision: {
      needs_retrieval: true,
      retrieval_scope: "workspace",
      max_chunks: 4,
      max_tokens: 5000,
      should_ask_clarification_first: false,
    },
    learner_memory_update: {
      needed: false,
      update_type: "none",
      memory_type: "none",
      content: "",
      confidence: 0,
    },
    knowledge_base_action: {
      needed: false,
      action: "none",
      confidence: 0,
      requires_user_confirmation: false,
    },
    decision_log_entries: [],
  },
  decisionLogEvents: [
    { type: "mock_provider", title: "Mock tutor provider used", detail: "mock" },
    {
      type: "retrieval_scope",
      title: "Retrieval boundary decision",
      detail: "needs_retrieval=true; retrieval_scope=workspace; max_chunks=4; max_tokens=5000",
    },
  ],
};

const physicsChunks: ChunkRetrievalResult = {
  eligibleFileCount: 1,
  chunks: [
    {
      chunkId: "ck-newton-1",
      fileId: "file-physics",
      workspaceId: "ws-physics",
      text: "Newton's first law: an object at rest stays at rest unless acted upon by a net force.",
      chunkIndex: 0,
      tokenEstimate: 60,
      score: 3,
      sourceLabel: "Physics Notes.pdf",
    },
    {
      chunkId: "ck-newton-2",
      fileId: "file-physics",
      workspaceId: "ws-physics",
      text: "Newton's second law: force equals mass times acceleration, F = ma.",
      chunkIndex: 1,
      tokenEstimate: 50,
      score: 2,
      sourceLabel: "Physics Notes.pdf",
    },
  ],
};

function makeRepos(overrides: Record<string, unknown> = {}) {
  return {
    getWorkspace: vi.fn(async () => ({ id: "ws-physics", userId: "alice" })),
    getSession: vi.fn(async () => ({ id: "sess-1", userId: "alice" })),
    listSessionMessages: vi.fn(async () => []),
    appendMessage: vi.fn(
      async (_uid: string, _wsId: string, _sessId: string, input: Record<string, unknown>) =>
        input.role === "user"
          ? baseUserMessage
          : { ...baseTutorMessage, content: input.content as string, citations: input.citations }
    ),
    listUploadedFiles: vi.fn(async () => []),
    listFileChunks: vi.fn(async () => []),
    listDocumentPages: vi.fn(async () => []),
    getDocumentOutline: vi.fn(async () => null),
    listDetectedQuestions: vi.fn(async () => []),
    writeDecisionLogEntry: vi.fn(async () => ({ id: "dlog-1" })),
    processMemoryCandidate: vi.fn(async () => {}),
    webSearchProvider: {
      search: vi.fn(async (query: string) => ({
        query,
        hits: [
          {
            sourceId: "web-src-1",
            title: "Web result",
            snippet: "some web info",
            url: "https://example.com/result",
            stance: "neutral" as const,
          },
        ],
      })),
    },
    retrieveFileChunks: vi.fn(async () => ({ chunks: [], eligibleFileCount: 0 })),
    getMockTutorResponse: vi.fn(async () => baseTutorResponse),
    ...overrides,
  };
}

describeMvp("MVP File Learning Pipeline", () => {
  beforeAll(async () => {
    mod = (await import(
      "../../src/server/workspaces/sessionMessageApiService"
    )) as unknown as ServiceModule;
  });

  describe("deterministic file inventory stabilization", () => {
    it("exact smoke phrase returns structured inventory response without model call", async () => {
      const repos = makeRepos({
        listUploadedFiles: vi.fn(async () => [
          {
            id: "file-physics",
            name: "physics.pdf",
            originalFileName: "פיזיקה 2 מטלה 5.pdf",
            extractionStatus: "completed",
            chunkingStatus: "completed",
            indexingStatus: "indexed",
          },
        ]),
        listFileChunks: vi.fn(async () => [
          {
            chunkId: "inv-1",
            userId: "alice",
            workspaceId: "ws-physics",
            fileId: "file-physics",
            text: "שאלה 1\nחשב את הפוטנציאל החשמלי.",
            chunkIndex: 0,
            charStart: 0,
            charEnd: 32,
            tokenEstimate: 10,
            source: "extracted_text",
            createdAt: new Date(),
          },
        ]),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      expect(result.assistantMessage.content).toMatch(/הקובץ זוהה והטקסט חולץ/);
      expect(result.assistantMessage.content).toMatch(/מקטעים שזוהו/);
      expect(result.assistantMessage.content).toContain("שאלה 1");
      expect(result.assistantMessage.content).not.toMatch(/אין לי גישה ישירה/i);
      expect(result.assistantMessage.content).not.toMatch(/אני רואה את ה-PDF|יכול לראות את ה-PDF/);
    });

    it("uses artifact-aware inventory when completed document artifacts exist", async () => {
      const repos = makeRepos({
        listUploadedFiles: vi.fn(async () => [
          {
            id: "file-physics",
            name: "physics.pdf",
            originalFileName: "פיזיקה 2 מטלה 5.pdf",
            extractionStatus: "completed",
            chunkingStatus: "completed",
            understandingStatus: "completed",
            pageCount: 4,
            outlineTitle: "מטלה 5",
            detectedQuestionCount: 2,
            extractionQuality: "good",
            deepPdfStatus: "not_started",
            indexingStatus: "indexed",
          },
        ]),
        getDocumentOutline: vi.fn(async () => ({
          outlineId: "v1",
          userId: "alice",
          fileId: "file-physics",
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
            fileId: "file-physics",
            label: "שאלה 1",
            summary: "חשב את הפוטנציאל החשמלי.",
            pageStart: 2,
            pageEnd: 2,
            charStart: 0,
            charEnd: 30,
            sourceChunkIds: [],
            subsections: [],
            confidence: 0.9,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            questionId: "q-2",
            userId: "alice",
            fileId: "file-physics",
            label: "שאלה 2",
            summary: "מצא את עוצמת השדה.",
            pageStart: 3,
            pageEnd: 3,
            charStart: 31,
            charEnd: 60,
            sourceChunkIds: [],
            subsections: [],
            confidence: 0.85,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
        listFileChunks: vi.fn(async () => [
          {
            chunkId: "inv-1",
            userId: "alice",
            workspaceId: "ws-physics",
            fileId: "file-physics",
            text: "שאלה 1\n0 0 1 2  a B I ",
            chunkIndex: 0,
            charStart: 0,
            charEnd: 24,
            tokenEstimate: 10,
            source: "extracted_text",
            createdAt: new Date(),
          },
        ]),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.getMockTutorResponse).not.toHaveBeenCalled();
      expect(repos.listFileChunks).not.toHaveBeenCalled();
      expect(result.assistantMessage.content).toMatch(/מספר עמודים שזוהו: 4/);
      expect(result.assistantMessage.content).toContain("חשב את הפוטנציאל החשמלי");
      expect(result.assistantMessage.content).not.toContain("0 0 1 2  a B I ");
    });
  });

  describe("happy path: extraction + chunking completed, matching chunks", () => {
    it("retrieval.used = true when eligible chunks found", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => physicsChunks),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "explain Newton laws force",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(result.internalUpdate.retrieval.used).toBe(true);
      expect(result.internalUpdate.retrieval.source_ids).toContain("ck-newton-1");
    });

    it("citations include chunk source ids when chunks retrieved", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => physicsChunks),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "explain Newton laws force",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const citations = result.assistantMessage.citations ?? [];
      expect(citations.length).toBeGreaterThan(0);
      const sourceIds = citations.map((c) => c.sourceId);
      expect(sourceIds.some((id) => id.includes("ck-newton"))).toBe(true);
    });

    it("second provider call receives groundingContext with retrieved chunks", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => physicsChunks),
      });

      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "explain Newton laws force",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const calls = (repos.getMockTutorResponse as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBe(2);
      const groundingArg = calls[1][4];
      expect(groundingArg).toBeDefined();
      expect(groundingArg.mode).toBe("file_chunks");
      expect(Array.isArray(groundingArg.chunks)).toBe(true);
      expect(groundingArg.chunks.length).toBeGreaterThan(0);
      expect(groundingArg.chunks[0].sourceId).toContain("file-physics");
    });

    it("grounded provider call uses content from second call", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => physicsChunks),
        getMockTutorResponse: vi.fn(
          async (
            _msg: string,
            _wm: string,
            _cm: string,
            _hist?: unknown,
            groundingCtx?: { mode?: string }
          ) => {
            if (groundingCtx?.mode === "file_chunks") {
              return {
                ...baseTutorResponse,
                message: {
                  id: "m-grounded",
                  role: "tutor",
                  content: "Grounded answer referencing Newton's laws from your notes.",
                },
              };
            }
            return baseTutorResponse;
          }
        ),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(result.assistantMessage.content).toContain("Grounded answer");
    });

    it("transcript has exactly one user message and one tutor message", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => physicsChunks),
      });

      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.appendMessage).toHaveBeenCalledTimes(2);
      const calls = (repos.appendMessage as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][3].role).toBe("user");
      expect(calls[1][3].role).toBe("tutor");
    });

    it("decision log records retrieval_executed and grounded provider call", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => physicsChunks),
      });

      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({
          title: "Retrieval executed",
          decision: expect.stringContaining("ck-newton"),
        })
      );
      expect(repos.writeDecisionLogEntry).toHaveBeenCalledWith(
        "alice",
        expect.objectContaining({
          title: "Grounded provider call executed",
          decision: expect.stringContaining("grounding_context_injected=true"),
        })
      );
    });

    it("public response shape is compatible with PostMessageApiResponse", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => physicsChunks),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(result).toHaveProperty("userMessage");
      expect(result).toHaveProperty("assistantMessage");
      expect(result).toHaveProperty("internalUpdate");
      expect(typeof result.userMessage.id).toBe("string");
      expect(result.userMessage.role).toBe("user");
      expect(typeof result.assistantMessage.content).toBe("string");
      expect(result.assistantMessage.role).toBe("tutor");
    });
  });

  describe("negative path: no eligible chunks", () => {
    it("no extracted/chunked files → eligibleFileCount=0 → falls back, no second provider call", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({ chunks: [], eligibleFileCount: 0 })),
        listUploadedFiles: vi.fn(async () => []),
      });

      const service = mod.createSessionMessageApiService(repos);
      await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const calls = (repos.getMockTutorResponse as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBe(1);
      const groundingArg = calls[0][4];
      expect(groundingArg).toBeUndefined();
    });

    it("no extracted files → retrieval skips without inventing context", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({ chunks: [], eligibleFileCount: 0 })),
        listUploadedFiles: vi.fn(async () => []),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const citations = result.assistantMessage.citations ?? [];
      citations.forEach((c) => {
        expect(c.referenceText).not.toContain("Newton");
      });
    });

    it("eligible files but query has no matching chunks → no_matching_file_chunks, no grounding", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({ chunks: [], eligibleFileCount: 1 })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "quantum field theory renormalization",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(result.internalUpdate.retrieval.used).toBe(false);
      expect(result.internalUpdate.retrieval.why).toBe("no_matching_file_chunks");

      const calls = (repos.getMockTutorResponse as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBe(1);
    });

    it("no matching chunks → no fake citations attached", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({ chunks: [], eligibleFileCount: 1 })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "quantum field theory",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const citations = result.assistantMessage.citations ?? [];
      citations.forEach((c) => {
        expect(c.sourceId).not.toContain("ck-");
      });
    });
  });

  describe("negative path: web retrieval unchanged", () => {
    it("scope=web does not call retrieveFileChunks or add grounding", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => ({ chunks: [], eligibleFileCount: 0 })),
        getMockTutorResponse: vi.fn(async () => ({
          ...baseTutorResponse,
          internalUpdate: {
            ...baseTutorResponse.internalUpdate,
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
      await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "latest physics news today",
        workMode: "Research",
        costMode: "Normal Learning",
      });

      expect(repos.retrieveFileChunks).not.toHaveBeenCalled();

      const calls = (repos.getMockTutorResponse as ReturnType<typeof vi.fn>).mock.calls;
      const groundingArg = calls[0][4];
      expect(groundingArg).toBeUndefined();
    });
  });

  describe("boundary: system does not overclaim", () => {
    it("retrieval why string does not contain 'semantic' or 'vector'", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => physicsChunks),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(result.internalUpdate.retrieval.why).not.toContain("semantic");
      expect(result.internalUpdate.retrieval.why).not.toContain("vector");
      expect(result.internalUpdate.retrieval.why).not.toContain("embedding");
    });

    it("citation sourceId follows fileId:chunkId format (deterministic source ids)", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => physicsChunks),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "explain Newton",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      const citations = result.assistantMessage.citations ?? [];
      expect(citations.length).toBeGreaterThan(0);
      citations.forEach((c) => {
        expect(c.sourceId).toMatch(/^[^:]+:[^:]+$/);
      });
    });

    it("no retrieval when needs_retrieval=false", async () => {
      const repos = makeRepos({
        retrieveFileChunks: vi.fn(async () => physicsChunks),
        getMockTutorResponse: vi.fn(async () => ({
          ...baseTutorResponse,
          internalUpdate: {
            ...baseTutorResponse.internalUpdate,
            retrieval_decision: {
              needs_retrieval: false,
              retrieval_scope: "none",
              max_chunks: 0,
              max_tokens: 0,
              should_ask_clarification_first: false,
            },
          },
        })),
      });

      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "sess-1", {
        workspaceId: "ws-physics",
        userMessage: "what is 2+2",
        workMode: "Learning",
        costMode: "Normal Learning",
      });

      expect(result.internalUpdate.retrieval.used).toBe(false);
      const calls = (repos.getMockTutorResponse as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBe(1);
    });
  });
});
