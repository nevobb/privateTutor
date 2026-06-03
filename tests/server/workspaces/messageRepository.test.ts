import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  assertFirestoreEmulatorRunning,
  createWorkspaceEmulatorTestEnvironment,
  describeFirebaseWorkspaceEmulator,
  type WorkspaceEmulatorFirestore,
} from "../../firebase/firestoreTestUtils";

let testEnv: Awaited<ReturnType<typeof createWorkspaceEmulatorTestEnvironment>> | undefined;
let activeFirestore: WorkspaceEmulatorFirestore | null = null;

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", async () => {
  const actual = await vi.importActual<typeof import("../../../src/server/firebase/firestoreEmulatorClient")>(
    "../../../src/server/firebase/firestoreEmulatorClient"
  );

  return {
    ...(actual as object),
    getFirestoreEmulatorClient: async (_userId?: string) => {
      if (!activeFirestore) {
        throw new Error("Workspace Firestore test harness is not initialized.");
      }
      return {
        app: {} as never,
        db: activeFirestore as never,
        config: {
          projectId: "demo-private-tutor",
          host: "127.0.0.1",
          port: 8080,
          baseUrl: "http://127.0.0.1:8080",
        } as const,
      };
    },
    withFirestoreEmulatorClient: async <T>(
      userIdOrHandler: string | ((client: { db: WorkspaceEmulatorFirestore }) => Promise<T>),
      maybeHandler?: (client: { db: WorkspaceEmulatorFirestore }) => Promise<T>
    ) => {
      if (!activeFirestore) {
        throw new Error("Workspace Firestore test harness is not initialized.");
      }
      const handler =
        typeof userIdOrHandler === "function" ? userIdOrHandler : maybeHandler;
      if (!handler) {
        throw new Error("Workspace Firestore test harness did not receive a handler.");
      }
      return handler({ db: activeFirestore });
    },
  };
});

import { createWorkspace } from "../../../src/server/workspaces/workspaceRepository";
import { createSession } from "../../../src/server/workspaces/sessionRepository";
import { appendMessage, listSessionMessages } from "../../../src/server/workspaces/messageRepository";
import { sessionPath } from "../../../src/server/workspaces/sessionRepository";
import { workspacePath } from "../../../src/server/workspaces/workspaceRepository";

function useFirestoreForUser(userId: string) {
  if (!testEnv) {
    throw new Error("Workspace Firestore test environment is not ready.");
  }

  activeFirestore = testEnv.authenticatedContext(userId).firestore();
}

function snapshotExists(snapshot: unknown): boolean {
  if (snapshot && typeof snapshot === "object" && "exists" in snapshot) {
    const existsValue = (snapshot as { exists: unknown }).exists;
    return typeof existsValue === "function" ? Boolean((existsValue as () => boolean)()) : Boolean(existsValue);
  }
  return false;
}

describeFirebaseWorkspaceEmulator("messageRepository against the Firestore emulator", () => {
  beforeAll(async () => {
    await assertFirestoreEmulatorRunning();
    testEnv = await createWorkspaceEmulatorTestEnvironment();
  });

  afterEach(async () => {
    await testEnv!.clearFirestore();
    activeFirestore = null;
  });

  afterAll(async () => {
    await testEnv!.cleanup();
  });

  it("appends user and tutor messages in sequence order", async () => {
    useFirestoreForUser("alice");

    const workspace = await createWorkspace("alice", { name: "Message ordering workspace" });
    const session = await createSession("alice", workspace.id, { title: "Message ordering session" });

    const userMessage = await appendMessage("alice", workspace.id, session.id, {
      role: "user",
      content: "What comes next?",
    });
    const tutorMessage = await appendMessage("alice", workspace.id, session.id, {
      role: "tutor",
      content: "Next comes the answer.",
    });

    const messages = await listSessionMessages("alice", workspace.id, session.id);
    const sessionSnapshot = await activeFirestore!.doc(sessionPath("alice", workspace.id, session.id).join("/")).get();
    const workspaceSnapshot = await activeFirestore!.doc(workspacePath("alice", workspace.id).join("/")).get();

    expect(userMessage.sequence).toBe(1);
    expect(tutorMessage.sequence).toBe(2);
    expect(messages.map((message) => message.role)).toEqual(["user", "tutor"]);
    expect(messages.map((message) => message.content)).toEqual(["What comes next?", "Next comes the answer."]);
    expect(snapshotExists(sessionSnapshot)).toBe(true);
    expect(sessionSnapshot.data()?.messageCount).toBe(2);
    expect(snapshotExists(workspaceSnapshot)).toBe(true);
    expect(workspaceSnapshot.data()?.lastSessionId).toBe(session.id);
  });

  it("persists attachedFileIds on user messages and leaves tutor messages unset", async () => {
    useFirestoreForUser("alice");

    const workspace = await createWorkspace("alice", { name: "Attachment persistence workspace" });
    const session = await createSession("alice", workspace.id, { title: "Attachment persistence session" });

    const userMessage = await appendMessage("alice", workspace.id, session.id, {
      role: "user",
      content: "Use this file",
      attachedFileIds: ["file-1", "file-2"],
    });
    const tutorMessage = await appendMessage("alice", workspace.id, session.id, {
      role: "tutor",
      content: "I will use it.",
    });

    const messages = await listSessionMessages("alice", workspace.id, session.id);
    expect(userMessage).toMatchObject({ attachedFileIds: ["file-1", "file-2"] });
    expect(tutorMessage).not.toHaveProperty("attachedFileIds");
    expect(messages[0]).toMatchObject({ attachedFileIds: ["file-1", "file-2"] });
    expect(messages[1]).not.toHaveProperty("attachedFileIds");
  });

  it("blocks another user's session from being appended or listed", async () => {
    useFirestoreForUser("alice");
    const workspace = await createWorkspace("alice", { name: "Private messages" });
    const session = await createSession("alice", workspace.id, { title: "Private session" });

    useFirestoreForUser("bob");
    await expect(
      appendMessage("bob", workspace.id, session.id, {
        role: "user",
        content: "This should not land.",
      })
    ).rejects.toThrow("Workspace not found.");
    await expect(listSessionMessages("bob", workspace.id, session.id)).rejects.toThrow("Workspace not found.");
  });
});
