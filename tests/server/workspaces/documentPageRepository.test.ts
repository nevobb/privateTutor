import { beforeAll, describe, expect, it } from "vitest";
import {
  assertFirestoreEmulatorRunning,
  describeFirebaseWorkspaceEmulator,
} from "../../firebase/firestoreTestUtils";
import { createWorkspace } from "../../../src/server/workspaces/workspaceRepository";
import {
  listDocumentPages,
  replaceDocumentPages,
  deleteDocumentPages,
} from "../../../src/server/workspaces/documentPageRepository";

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let userCounter = 0;

function nextUser(prefix: string): string {
  userCounter += 1;
  return `${prefix}-${runId}-${userCounter}`;
}

describeFirebaseWorkspaceEmulator("documentPageRepository against Firestore emulator", () => {
  beforeAll(async () => {
    await assertFirestoreEmulatorRunning();
  });

  it("replaces and lists pages ordered by pageNumber", async () => {
    const alice = nextUser("alice");
    const workspace = await createWorkspace(alice, { name: "Linear Algebra" });

    await replaceDocumentPages(alice, workspace.id, "file-1", [
      {
        id: "page_0002",
        userId: alice,
        workspaceId: workspace.id,
        fileId: "file-1",
        pageNumber: 2,
        extractedText: "Page two text",
        cleanedText: "Page two text",
        textQuality: "good",
      },
      {
        id: "page_0001",
        userId: alice,
        workspaceId: workspace.id,
        fileId: "file-1",
        pageNumber: 1,
        extractedText: "Page one text",
        cleanedText: "Page one text",
        textQuality: "good",
      },
    ]);

    const pages = await listDocumentPages(alice, workspace.id, "file-1");
    expect(pages).toHaveLength(2);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[1].pageNumber).toBe(2);
  });

  it("deletes pages for file", async () => {
    const alice = nextUser("alice");
    const workspace = await createWorkspace(alice, { name: "Calculus" });

    await replaceDocumentPages(alice, workspace.id, "file-2", [
      {
        id: "page_0001",
        userId: alice,
        workspaceId: workspace.id,
        fileId: "file-2",
        pageNumber: 1,
        extractedText: "Only page",
      },
    ]);

    await deleteDocumentPages(alice, workspace.id, "file-2");
    const pages = await listDocumentPages(alice, workspace.id, "file-2");
    expect(pages).toEqual([]);
  });
});

