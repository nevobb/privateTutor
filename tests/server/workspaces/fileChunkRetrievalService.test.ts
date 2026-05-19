import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

const SERVICE_FILE = resolve(
  process.cwd(),
  "src/server/workspaces/fileChunkRetrievalService.ts"
);
const hasFile = existsSync(SERVICE_FILE);
const describeService = hasFile ? describe : describe.skip;

type RetrievalModule = {
  retrieveRelevantFileChunks: (
    input: {
      userId: string;
      workspaceId: string;
      query: string;
      maxChunks: number;
      maxTokens: number;
    },
    deps?: {
      listUploadedFiles: (userId: string, workspaceId: string) => Promise<Record<string, unknown>[]>;
      listFileChunks: (userId: string, workspaceId: string, fileId: string) => Promise<Record<string, unknown>[]>;
    }
  ) => Promise<{
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
  }>;
};

function makeEligibleFile(id: string, name: string) {
  return {
    id,
    name,
    workspaceId: "ws-1",
    extractionStatus: "completed",
    chunkingStatus: "completed",
    chunkCount: 3,
    indexingStatus: "indexed",
    assignmentStatus: "unassigned",
    sourceType: "pdf",
    url: "",
    uploadedAt: new Date(),
  };
}

function makeChunk(chunkId: string, fileId: string, chunkIndex: number, text: string, tokenEstimate = 50) {
  return {
    chunkId,
    fileId,
    workspaceId: "ws-1",
    userId: "alice",
    text,
    chunkIndex,
    charStart: 0,
    charEnd: text.length,
    tokenEstimate,
    source: "extracted_text",
    createdAt: new Date(),
  };
}

describeService("retrieveRelevantFileChunks", () => {
  let mod: RetrievalModule;

  beforeAll(async () => {
    mod = (await import("../../../src/server/workspaces/fileChunkRetrievalService")) as RetrievalModule;
  });

  it("returns empty when no eligible files", async () => {
    const deps = {
      listUploadedFiles: vi.fn(async () => [
        {
          id: "f1",
          extractionStatus: "not_started",
          chunkingStatus: "not_started",
          chunkCount: 0,
          indexingStatus: "indexed",
          assignmentStatus: "unassigned",
          sourceType: "pdf",
          url: "",
          uploadedAt: new Date(),
        },
      ]),
      listFileChunks: vi.fn(async () => []),
    };

    const result = await mod.retrieveRelevantFileChunks(
      { userId: "alice", workspaceId: "ws-1", query: "test", maxChunks: 5, maxTokens: 2000 },
      deps
    );

    expect(result.chunks).toHaveLength(0);
    expect(result.eligibleFileCount).toBe(0);
    expect(deps.listFileChunks).not.toHaveBeenCalled();
  });

  it("returns empty with eligibleFileCount > 0 when files have no chunks", async () => {
    const deps = {
      listUploadedFiles: vi.fn(async () => [makeEligibleFile("f1", "notes.pdf")]),
      listFileChunks: vi.fn(async () => []),
    };

    const result = await mod.retrieveRelevantFileChunks(
      { userId: "alice", workspaceId: "ws-1", query: "test", maxChunks: 5, maxTokens: 2000 },
      deps
    );

    expect(result.chunks).toHaveLength(0);
    expect(result.eligibleFileCount).toBe(1);
  });

  it("ranks chunks by keyword overlap with query", async () => {
    const deps = {
      listUploadedFiles: vi.fn(async () => [makeEligibleFile("f1", "notes.pdf")]),
      listFileChunks: vi.fn(async () => [
        makeChunk("c1", "f1", 0, "Newton laws motion physics force"),
        makeChunk("c2", "f1", 1, "quantum mechanics wave function"),
        makeChunk("c3", "f1", 2, "Newton force acceleration laws"),
      ]),
    };

    const result = await mod.retrieveRelevantFileChunks(
      { userId: "alice", workspaceId: "ws-1", query: "Newton laws force", maxChunks: 3, maxTokens: 10000 },
      deps
    );

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].chunkId).not.toBe("c2");
    const scores = result.chunks.map((c) => c.score);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  });

  it("uses chunkIndex as deterministic tie-breaker for equal scores", async () => {
    const deps = {
      listUploadedFiles: vi.fn(async () => [makeEligibleFile("f1", "notes.pdf")]),
      listFileChunks: vi.fn(async () => [
        makeChunk("c3", "f1", 2, "apple banana cherry"),
        makeChunk("c1", "f1", 0, "apple banana cherry"),
        makeChunk("c2", "f1", 1, "apple banana cherry"),
      ]),
    };

    const result = await mod.retrieveRelevantFileChunks(
      { userId: "alice", workspaceId: "ws-1", query: "apple banana cherry", maxChunks: 3, maxTokens: 10000 },
      deps
    );

    expect(result.chunks.map((c) => c.chunkId)).toEqual(["c1", "c2", "c3"]);
  });

  it("respects maxChunks limit", async () => {
    const deps = {
      listUploadedFiles: vi.fn(async () => [makeEligibleFile("f1", "notes.pdf")]),
      listFileChunks: vi.fn(async () => [
        makeChunk("c1", "f1", 0, "relevant content here"),
        makeChunk("c2", "f1", 1, "relevant content here"),
        makeChunk("c3", "f1", 2, "relevant content here"),
        makeChunk("c4", "f1", 3, "relevant content here"),
        makeChunk("c5", "f1", 4, "relevant content here"),
      ]),
    };

    const result = await mod.retrieveRelevantFileChunks(
      { userId: "alice", workspaceId: "ws-1", query: "relevant content", maxChunks: 2, maxTokens: 10000 },
      deps
    );

    expect(result.chunks).toHaveLength(2);
  });

  it("respects maxTokens budget", async () => {
    const deps = {
      listUploadedFiles: vi.fn(async () => [makeEligibleFile("f1", "notes.pdf")]),
      listFileChunks: vi.fn(async () => [
        makeChunk("c1", "f1", 0, "relevant content here", 300),
        makeChunk("c2", "f1", 1, "relevant content here", 300),
        makeChunk("c3", "f1", 2, "relevant content here", 300),
      ]),
    };

    const result = await mod.retrieveRelevantFileChunks(
      { userId: "alice", workspaceId: "ws-1", query: "relevant content", maxChunks: 10, maxTokens: 500 },
      deps
    );

    expect(result.chunks).toHaveLength(1);
  });

  it("returns deterministic order for same input", async () => {
    const deps = {
      listUploadedFiles: vi.fn(async () => [
        makeEligibleFile("f1", "notes.pdf"),
        makeEligibleFile("f2", "book.pdf"),
      ]),
      listFileChunks: vi.fn(async (_uid: string, _wsId: string, fileId: string) => {
        if (fileId === "f1") {
          return [
            makeChunk("c1a", "f1", 0, "mechanics force velocity"),
            makeChunk("c1b", "f1", 1, "thermodynamics heat entropy"),
          ];
        }
        return [
          makeChunk("c2a", "f2", 0, "force gravity mechanics"),
          makeChunk("c2b", "f2", 1, "optics light refraction"),
        ];
      }),
    };

    const input = { userId: "alice", workspaceId: "ws-1", query: "mechanics force", maxChunks: 4, maxTokens: 10000 };
    const r1 = await mod.retrieveRelevantFileChunks(input, deps);
    const r2 = await mod.retrieveRelevantFileChunks(input, deps);
    expect(r1.chunks.map((c) => c.chunkId)).toEqual(r2.chunks.map((c) => c.chunkId));
  });

  it("returns eligibleFileCount from chunked-eligible files only", async () => {
    const deps = {
      listUploadedFiles: vi.fn(async () => [
        makeEligibleFile("f1", "notes.pdf"),
        makeEligibleFile("f2", "book.pdf"),
        {
          id: "f3",
          name: "not-chunked.pdf",
          extractionStatus: "not_started",
          chunkingStatus: "not_started",
          chunkCount: 0,
          indexingStatus: "indexed",
          assignmentStatus: "unassigned",
          sourceType: "pdf",
          url: "",
          uploadedAt: new Date(),
        },
      ]),
      listFileChunks: vi.fn(async () => [makeChunk("c1", "f1", 0, "test content")]),
    };

    const result = await mod.retrieveRelevantFileChunks(
      { userId: "alice", workspaceId: "ws-1", query: "test", maxChunks: 5, maxTokens: 10000 },
      deps
    );

    expect(result.eligibleFileCount).toBe(2);
  });

  it("attaches correct sourceLabel from file name", async () => {
    const deps = {
      listUploadedFiles: vi.fn(async () => [makeEligibleFile("f1", "Mechanics Lecture.pdf")]),
      listFileChunks: vi.fn(async () => [makeChunk("c1", "f1", 0, "mechanics force acceleration")]),
    };

    const result = await mod.retrieveRelevantFileChunks(
      { userId: "alice", workspaceId: "ws-1", query: "mechanics force", maxChunks: 3, maxTokens: 10000 },
      deps
    );

    expect(result.chunks[0].sourceLabel).toBe("Mechanics Lecture.pdf");
  });
});
