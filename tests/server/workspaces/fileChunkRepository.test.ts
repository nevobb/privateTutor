import { beforeAll, describe, expect, it } from "vitest";
import {
  assertFirestoreEmulatorRunning,
  describeFirebaseWorkspaceEmulator,
} from "../../firebase/firestoreTestUtils";
import { createWorkspace } from "../../../src/server/workspaces/workspaceRepository";
import { replaceFileChunks, listFileChunks, deleteFileChunks } from "../../../src/server/workspaces/fileChunkRepository";

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let userCounter = 0;

function nextUser(prefix: string): string {
  userCounter += 1;
  return `${prefix}-${runId}-${userCounter}`;
}

describeFirebaseWorkspaceEmulator("fileChunkRepository against Firestore emulator", () => {
  beforeAll(async () => {
    await assertFirestoreEmulatorRunning();
  });

  it("replaces and lists chunks ordered by chunkIndex", async () => {
    const alice = nextUser("alice");
    const workspace = await createWorkspace(alice, { name: "Physics" });

    await replaceFileChunks(alice, workspace.id, "file-1", [
      {
        chunkId: "chunk_0001",
        userId: alice,
        workspaceId: workspace.id,
        fileId: "file-1",
        text: "chunk two",
        chunkIndex: 1,
        charStart: 10,
        charEnd: 20,
        tokenEstimate: 3,
        source: "extracted_text",
      },
      {
        chunkId: "chunk_0000",
        userId: alice,
        workspaceId: workspace.id,
        fileId: "file-1",
        text: "chunk one",
        chunkIndex: 0,
        charStart: 0,
        charEnd: 9,
        tokenEstimate: 3,
        source: "extracted_text",
      },
    ]);

    const listed = await listFileChunks(alice, workspace.id, "file-1");
    expect(listed).toHaveLength(2);
    expect(listed[0].chunkId).toBe("chunk_0000");
    expect(listed[1].chunkId).toBe("chunk_0001");
  });

  it("deletes chunks for file", async () => {
    const alice = nextUser("alice");
    const workspace = await createWorkspace(alice, { name: "Math" });

    await replaceFileChunks(alice, workspace.id, "file-2", [
      {
        chunkId: "chunk_0000",
        userId: alice,
        workspaceId: workspace.id,
        fileId: "file-2",
        text: "chunk",
        chunkIndex: 0,
        charStart: 0,
        charEnd: 5,
        tokenEstimate: 2,
        source: "extracted_text",
      },
    ]);

    await deleteFileChunks(alice, workspace.id, "file-2");
    const listed = await listFileChunks(alice, workspace.id, "file-2");
    expect(listed).toEqual([]);
  });
});
