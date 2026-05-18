import { beforeAll, expect, it } from "vitest";
import {
  assertFirestoreEmulatorRunning,
  describeFirebaseWorkspaceEmulator,
} from "../../firebase/firestoreTestUtils";
import {
  createWorkspace,
  getWorkspace,
  moveWorkspace,
} from "../../../src/server/workspaces/workspaceRepository";
import {
  createSession,
  getSession,
} from "../../../src/server/workspaces/sessionRepository";
import { appendMessage, listSessionMessages } from "../../../src/server/workspaces/messageRepository";

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let userCounter = 0;

function nextUser(prefix: string): string {
  userCounter += 1;
  return `${prefix}-${runId}-${userCounter}`;
}

describeFirebaseWorkspaceEmulator("workspaceRepository against the Firestore emulator", () => {
  beforeAll(async () => {
    await assertFirestoreEmulatorRunning();
  });

  it("creates and reads back an owned workspace document", async () => {
    const alice = nextUser("alice");

    const created = await createWorkspace(alice, {
      name: "Alice workspace",
      description: "Workspace repository test",
      path: ["root", "algebra"],
      stableIdentityNote: "Keep this workspace stable.",
    });

    const loaded = await getWorkspace(alice, created.id);

    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject({
      id: created.id,
      userId: alice,
      name: "Alice workspace",
      description: "Workspace repository test",
      path: ["root", "algebra"],
      stableIdentityNote: "Keep this workspace stable.",
      status: "active",
    });
  });

  it("keeps another user's workspace out of reach", async () => {
    const alice = nextUser("alice");
    const bob = nextUser("bob");

    const created = await createWorkspace(alice, {
      name: "Private workspace",
    });

    await expect(getWorkspace(bob, created.id)).resolves.toBeNull();
  });

  it("moves workspace path while preserving workspace id and tracking previous paths", async () => {
    const alice = nextUser("alice");

    const created = await createWorkspace(alice, {
      name: "Physics 2",
      path: ["Year 1", "Physics 2"],
    });

    const movedOnce = await moveWorkspace(alice, created.id, {
      currentPath: "Year 1 / Semester B / Physics 2",
    });
    expect(movedOnce).not.toBeNull();
    expect(movedOnce?.id).toBe(created.id);
    expect(movedOnce?.currentPath).toBe("Year 1 / Semester B / Physics 2");
    expect(movedOnce?.previousPaths).toBeUndefined();

    const movedTwice = await moveWorkspace(alice, created.id, {
      currentPath: "Year 1 / Semester B / Mechanics / Physics 2",
    });
    expect(movedTwice).not.toBeNull();
    expect(movedTwice?.id).toBe(created.id);
    expect(movedTwice?.currentPath).toBe("Year 1 / Semester B / Mechanics / Physics 2");
    expect(movedTwice?.previousPaths).toEqual(["Year 1 / Semester B / Physics 2"]);

    const movedThird = await moveWorkspace(alice, created.id, {
      currentPath: "Year 1 / Semester B / Mechanics / Physics 2",
    });
    expect(movedThird?.previousPaths).toEqual(["Year 1 / Semester B / Physics 2"]);
  });

  it("returns null when trying to move another user's workspace", async () => {
    const alice = nextUser("alice");
    const bob = nextUser("bob");
    const created = await createWorkspace(alice, { name: "Private workspace" });

    await expect(
      moveWorkspace(bob, created.id, { currentPath: "Year 2 / Other" })
    ).resolves.toBeNull();
  });

  it("keeps session and message linkage readable after workspace move", async () => {
    const alice = nextUser("alice");

    const workspace = await createWorkspace(alice, { name: "Physics 2" });
    const session = await createSession(alice, workspace.id, { title: "Session A" });
    await appendMessage(alice, workspace.id, session.id, {
      role: "user",
      content: "first question",
    });

    const moved = await moveWorkspace(alice, workspace.id, {
      currentPath: "Year 1 / Semester B / Physics 2",
    });
    expect(moved?.id).toBe(workspace.id);

    const loadedSession = await getSession(alice, workspace.id, session.id);
    expect(loadedSession).not.toBeNull();
    expect(loadedSession?.id).toBe(session.id);

    const messages = await listSessionMessages(alice, workspace.id, session.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("first question");
  });
});
