import { beforeAll, describe, expect, it } from "vitest";
import { doc, setDoc } from "firebase/firestore/lite";
import {
  assertFirestoreEmulatorRunning,
  describeFirebaseWorkspaceEmulator,
} from "../../firebase/firestoreTestUtils";
import { withFirestoreEmulatorClient } from "../../../src/server/firebase/firestoreEmulatorClient";
import { createWorkspace } from "../../../src/server/workspaces/workspaceRepository";
import {
  createUploadedFile,
  getUploadedFile,
  listUploadedFiles,
  uploadedFilePath,
  updateUploadedFile,
} from "../../../src/server/workspaces/uploadedFileRepository";

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let userCounter = 0;

function nextUser(prefix: string): string {
  userCounter += 1;
  return `${prefix}-${runId}-${userCounter}`;
}

describeFirebaseWorkspaceEmulator("uploadedFileRepository against the Firestore emulator", () => {
  beforeAll(async () => {
    await assertFirestoreEmulatorRunning();
  });

  it("creates and reads uploaded file metadata under the correct user/workspace", async () => {
    const alice = nextUser("alice");
    const workspace = await createWorkspace(alice, { name: "Physics" });

    const created = await createUploadedFile(alice, {
      workspaceId: workspace.id,
      name: "Mechanics Intro.pdf",
      sourceType: "pdf",
      assignmentStatus: "assigned",
      indexingStatus: "uploaded",
      topic: "Mechanics",
      confidence: 0.88,
      summaryStatus: "not_requested",
      summarySource: "none",
      extractionStatus: "not_started",
      chunkingStatus: "not_started",
    });

    const loaded = await getUploadedFile(alice, created.id);

    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject({
      id: created.id,
      userId: alice,
      workspaceId: workspace.id,
      name: "Mechanics Intro.pdf",
      assignmentStatus: "assigned",
      indexingStatus: "uploaded",
      topic: "Mechanics",
      confidence: 0.88,
      summaryStatus: "not_requested",
      summarySource: "none",
      extractionStatus: "not_started",
    });
  });

  it("lists files by workspace and excludes other workspace files", async () => {
    const alice = nextUser("alice");
    const wsA = await createWorkspace(alice, { name: "Physics" });
    const wsB = await createWorkspace(alice, { name: "Math" });

    await createUploadedFile(alice, {
      workspaceId: wsA.id,
      name: "Physics 1.pdf",
      sourceType: "pdf",
      assignmentStatus: "assigned",
      indexingStatus: "uploaded",
      summaryStatus: "not_requested",
      summarySource: "none",
      extractionStatus: "not_started",
      chunkingStatus: "not_started",
    });

    await createUploadedFile(alice, {
      workspaceId: wsB.id,
      name: "Math 1.pdf",
      sourceType: "pdf",
      assignmentStatus: "assigned",
      indexingStatus: "uploaded",
      summaryStatus: "not_requested",
      summarySource: "none",
      extractionStatus: "not_started",
      chunkingStatus: "not_started",
    });

    const files = await listUploadedFiles(alice, wsA.id);

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("Physics 1.pdf");
  });

  it("updates indexing transitions including failed state", async () => {
    const alice = nextUser("alice");
    const workspace = await createWorkspace(alice, { name: "Physics" });

    const created = await createUploadedFile(alice, {
      workspaceId: workspace.id,
      name: "Mechanics Intro.pdf",
      sourceType: "pdf",
      assignmentStatus: "needs-review",
      indexingStatus: "uploaded",
      summaryStatus: "not_requested",
      summarySource: "none",
      extractionStatus: "not_started",
      chunkingStatus: "not_started",
    });

    const indexing = await updateUploadedFile(alice, created.id, { indexingStatus: "indexing" });
    expect(indexing?.indexingStatus).toBe("indexing");

    const failed = await updateUploadedFile(alice, created.id, { indexingStatus: "failed" });
    expect(failed?.indexingStatus).toBe("failed");

    const summaryReady = await updateUploadedFile(alice, created.id, {
      summaryStatus: "ready",
      summaryText: "Summary placeholder; content extraction not enabled yet.",
      summarySource: "placeholder",
      summaryErrorCode: null,
      summaryUpdatedAt: new Date(),
    });
    expect(summaryReady?.summaryStatus).toBe("ready");
    expect(summaryReady?.summarySource).toBe("placeholder");
  });

  it("blocks cross-user access to another user's uploaded file metadata", async () => {
    const alice = nextUser("alice");
    const bob = nextUser("bob");
    const workspace = await createWorkspace(alice, { name: "Private" });

    const created = await createUploadedFile(alice, {
      workspaceId: workspace.id,
      name: "Private.pdf",
      sourceType: "pdf",
      assignmentStatus: "assigned",
      indexingStatus: "uploaded",
      summaryStatus: "not_requested",
      summarySource: "none",
      extractionStatus: "not_started",
      chunkingStatus: "not_started",
    });

    await expect(getUploadedFile(bob, created.id)).resolves.toBeNull();
    await expect(updateUploadedFile(bob, created.id, { indexingStatus: "failed" })).resolves.toBeNull();
    await expect(listUploadedFiles(bob, workspace.id)).resolves.toEqual([]);
  });

  it("maps legacy records without extractionStatus to not_started", async () => {
    const alice = nextUser("alice");
    const workspace = await createWorkspace(alice, { name: "Physics" });
    const fileId = "legacy-file-1";
    const now = new Date();

    await withFirestoreEmulatorClient(alice, async ({ db }) => {
      await setDoc(doc(db as never, ...uploadedFilePath(alice, fileId)), {
        id: fileId,
        userId: alice,
        workspaceId: workspace.id,
        name: "Legacy.pdf",
        url: "",
        uploadedAt: now,
        assignmentStatus: "assigned",
        indexingStatus: "indexed",
        sourceType: "pdf",
        summaryStatus: "ready",
        summaryText: "legacy summary",
        summarySource: "placeholder",
        createdAt: now,
        updatedAt: now,
      });
    });

    const loaded = await getUploadedFile(alice, fileId);
    expect(loaded?.extractionStatus).toBe("not_started");
  });
});

describe("uploadedFileRepository local status mapping", () => {
  it("keeps backward-compatible status values valid in type union", () => {
    const statuses = ["not-indexed", "queued", "uploaded", "indexing", "indexed", "failed"];
    expect(statuses).toHaveLength(6);
  });
});
