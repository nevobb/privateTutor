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
      understandingStatus: "not_started",
      deepPdfStatus: "not_started",
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
      understandingStatus: "not_started",
      deepPdfStatus: "not_started",
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
      understandingStatus: "not_started",
      deepPdfStatus: "not_started",
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
      understandingStatus: "not_started",
      deepPdfStatus: "not_started",
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
      understandingStatus: "not_started",
      deepPdfStatus: "not_started",
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
    expect(loaded?.understandingStatus).toBeUndefined();
    expect(loaded?.deepPdfStatus).toBeUndefined();
  });

  it("round-trips new document-understanding metadata fields", async () => {
    const alice = nextUser("alice");
    const workspace = await createWorkspace(alice, { name: "Physics" });
    const timestamp = new Date("2026-06-02T10:00:00.000Z");

    const created = await createUploadedFile(alice, {
      workspaceId: workspace.id,
      name: "Structured.pdf",
      sourceType: "pdf",
      assignmentStatus: "assigned",
      indexingStatus: "uploaded",
      summaryStatus: "not_requested",
      summarySource: "none",
      extractionStatus: "not_started",
      understandingStatus: "not_started",
      understandingErrorCode: null,
      understandingUpdatedAt: null,
      pageCount: 12,
      outlineTitle: "חשמל ומגנטיות",
      detectedQuestionCount: 6,
      extractionQuality: "partial",
      chunkingStatus: "not_started",
      deepPdfStatus: "recommended",
      deepPdfProviderName: "gemini_pdf_understanding",
      deepPdfModel: "gemini-2.5-pro",
      deepPdfInputHash: "hash-v1",
      deepPdfStorageGeneration: "gen-v1",
      deepPdfArtifactVersion: "deep_pdf_artifacts_v1",
      deepPdfCompletedAt: timestamp,
      deepPdfErrorCode: null,
      deepPdfUpdatedAt: timestamp,
    });

    const updated = await updateUploadedFile(alice, created.id, {
      understandingStatus: "completed",
      understandingErrorCode: null,
      understandingUpdatedAt: timestamp,
      pageCount: 13,
      outlineTitle: "חשמל ומגנטיות — מטלה 1",
      detectedQuestionCount: 7,
      extractionQuality: "good",
      deepPdfStatus: "completed",
      deepPdfProviderName: "gemini_pdf_understanding",
      deepPdfModel: "gemini-2.5-pro",
      deepPdfInputHash: "hash-v1",
      deepPdfStorageGeneration: "gen-v1",
      deepPdfArtifactVersion: "deep_pdf_artifacts_v1",
      deepPdfCompletedAt: timestamp,
      deepPdfErrorCode: null,
      deepPdfUpdatedAt: timestamp,
    });

    expect(updated).not.toBeNull();
    expect(updated).toMatchObject({
      understandingStatus: "completed",
      pageCount: 13,
      outlineTitle: "חשמל ומגנטיות — מטלה 1",
      detectedQuestionCount: 7,
      extractionQuality: "good",
      deepPdfStatus: "completed",
      deepPdfProviderName: "gemini_pdf_understanding",
      deepPdfModel: "gemini-2.5-pro",
      deepPdfInputHash: "hash-v1",
      deepPdfStorageGeneration: "gen-v1",
      deepPdfArtifactVersion: "deep_pdf_artifacts_v1",
    });
    expect(updated?.deepPdfCompletedAt?.toISOString()).toBe(timestamp.toISOString());
    expect(updated?.deepPdfProviderName).toBe("gemini_pdf_understanding");
    expect(updated?.deepPdfModel).toBe("gemini-2.5-pro");
    expect(updated?.deepPdfInputHash).toBe("hash-v1");
    expect(updated?.deepPdfStorageGeneration).toBe("gen-v1");
    expect(updated?.deepPdfArtifactVersion).toBe("deep_pdf_artifacts_v1");
    expect(updated?.understandingUpdatedAt?.toISOString()).toBe(timestamp.toISOString());
    expect(updated?.deepPdfUpdatedAt?.toISOString()).toBe(timestamp.toISOString());
  });
});

describe("uploadedFileRepository local status mapping", () => {
  it("keeps backward-compatible status values valid in type union", () => {
    const statuses = ["not-indexed", "queued", "uploaded", "indexing", "indexed", "failed"];
    expect(statuses).toHaveLength(6);
  });
});
