import { describe, expect, it, vi } from "vitest";
import { createFileChunkEmbeddingService } from "../../../src/server/workspaces/fileChunkEmbeddingService";
import type { AuthenticatedUser } from "../../../src/server/auth/authTypes";
import type { FileChunkRecord, UploadedFileRecord, WorkspaceRecord } from "../../../src/server/workspaces/workspaceTypes";

const user: AuthenticatedUser = { userId: "alice", email: "alice@test.example" };
const now = new Date("2026-05-20T08:00:00.000Z");

const workspace: WorkspaceRecord = {
  id: "ws-1",
  userId: "alice",
  name: "Physics",
  description: "",
  status: "active",
  createdAt: now,
  updatedAt: now,
};

const file: UploadedFileRecord = {
  id: "file-1",
  userId: "alice",
  workspaceId: "ws-1",
  name: "doc.pdf",
  url: "",
  uploadedAt: now,
  assignmentStatus: "assigned",
  indexingStatus: "indexed",
  sourceType: "pdf",
  summaryStatus: "not_requested",
  summarySource: "none",
  extractionStatus: "completed",
  chunkingStatus: "completed",
  chunkCount: 2,
  createdAt: now,
  updatedAt: now,
};

const chunks: FileChunkRecord[] = [
  {
    chunkId: "chunk_0000",
    userId: "alice",
    workspaceId: "ws-1",
    fileId: "file-1",
    text: "Mechanics chunk",
    chunkIndex: 0,
    charStart: 0,
    charEnd: 14,
    tokenEstimate: 4,
    source: "extracted_text",
    createdAt: now,
  },
];

function deps() {
  return {
    getWorkspace: vi.fn(async () => workspace),
    getUploadedFile: vi.fn(async () => file),
    listFileChunks: vi.fn(async () => chunks),
    updateChunkEmbeddingLifecycle: vi.fn(async () => {}),
    setCurrentChunkEmbedding: vi.fn(async () => {}),
    embeddingProvider: {
      embedText: vi.fn(async () => ({
        vector: [0.1, 0.2],
        provider: "deterministic_mock",
        model: "deterministic-2d-v1",
        dimension: 2,
        sourceTextHash: "hash-1",
      })),
    },
  };
}

describe("fileChunkEmbeddingService", () => {
  it("marks chunk embeddings completed on success", async () => {
    const mockDeps = deps();
    const service = createFileChunkEmbeddingService(mockDeps as never);

    const result = await service.runEmbeddingLifecycleForFile(user, "ws-1", "file-1");

    expect(result).toEqual({ ok: true, embeddedChunkCount: 1, failedChunkCount: 0 });
    expect(mockDeps.updateChunkEmbeddingLifecycle).toHaveBeenCalledWith(
      "alice",
      "ws-1",
      "file-1",
      "chunk_0000",
      expect.objectContaining({ embeddingStatus: "completed", embeddingErrorCode: null })
    );
  });

  it("marks failed when provider throws", async () => {
    const mockDeps = deps();
    mockDeps.embeddingProvider.embedText = vi.fn(async () => {
      throw new Error("boom");
    });

    const service = createFileChunkEmbeddingService(mockDeps as never);
    const result = await service.runEmbeddingLifecycleForFile(user, "ws-1", "file-1");

    expect(result).toEqual({ ok: true, embeddedChunkCount: 0, failedChunkCount: 1 });
    expect(mockDeps.updateChunkEmbeddingLifecycle).toHaveBeenLastCalledWith(
      "alice",
      "ws-1",
      "file-1",
      "chunk_0000",
      expect.objectContaining({ embeddingStatus: "failed", embeddingErrorCode: "embedding_generation_failed" })
    );
  });
});
