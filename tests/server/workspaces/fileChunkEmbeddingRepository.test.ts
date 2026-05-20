import { beforeAll, describe, expect, it } from "vitest";
import {
  assertFirestoreEmulatorRunning,
  describeFirebaseWorkspaceEmulator,
} from "../../firebase/firestoreTestUtils";
import { createWorkspace } from "../../../src/server/workspaces/workspaceRepository";
import {
  getCurrentChunkEmbedding,
  setCurrentChunkEmbedding,
} from "../../../src/server/workspaces/fileChunkEmbeddingRepository";

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let userCounter = 0;

function nextUser(prefix: string): string {
  userCounter += 1;
  return `${prefix}-${runId}-${userCounter}`;
}

describeFirebaseWorkspaceEmulator("fileChunkEmbeddingRepository against Firestore emulator", () => {
  beforeAll(async () => {
    await assertFirestoreEmulatorRunning();
  });

  it("writes and reads current embedding record", async () => {
    const alice = nextUser("alice");
    const workspace = await createWorkspace(alice, { name: "Physics" });
    const now = new Date();

    await setCurrentChunkEmbedding({
      userId: alice,
      workspaceId: workspace.id,
      fileId: "file-1",
      chunkId: "chunk_0000",
      vector: [0.1, 0.2, 0.3, 0.4],
      embeddingStatus: "completed",
      embeddingProvider: "deterministic_mock",
      embeddingModel: "deterministic-4d-v1",
      embeddingDimension: 4,
      embeddingUpdatedAt: now,
      embeddingErrorCode: null,
      embeddingSourceTextHash: "abc123",
    });

    const loaded = await getCurrentChunkEmbedding(alice, workspace.id, "file-1", "chunk_0000");
    expect(loaded).not.toBeNull();
    expect(loaded?.embeddingStatus).toBe("completed");
    expect(loaded?.vector).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(loaded?.embeddingModel).toBe("deterministic-4d-v1");
  });
});
