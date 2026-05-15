import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  assertFirestoreEmulatorRunning,
  createWorkspaceEmulatorTestEnvironment,
  describeFirebaseWorkspaceEmulator,
  type WorkspaceEmulatorFirestore,
} from "./firestoreTestUtils";

let testEnv: Awaited<ReturnType<typeof createWorkspaceEmulatorTestEnvironment>> | undefined;
let activeFirestore: WorkspaceEmulatorFirestore | null = null;

vi.mock("../../src/server/firebase/firestoreEmulatorClient", async () => {
  const actual = await vi.importActual<typeof import("../../src/server/firebase/firestoreEmulatorClient")>(
    "../../src/server/firebase/firestoreEmulatorClient"
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

import { createWorkspace, getWorkspace } from "../../src/server/workspaces/workspaceRepository";
import { createSession } from "../../src/server/workspaces/sessionRepository";
import { appendMessage, listSessionMessages } from "../../src/server/workspaces/messageRepository";
import { writeDecisionLogEntry } from "../../src/server/workspaces/decisionLogRepository";
import { decisionLogPath } from "../../src/server/workspaces/decisionLogRepository";
import { sessionPath } from "../../src/server/workspaces/sessionRepository";
import { workspacePath } from "../../src/server/workspaces/workspaceRepository";

function useFirestoreForUser(userId: string) {
  if (!testEnv) {
    throw new Error("Workspace Firestore test environment is not ready.");
  }

  activeFirestore = testEnv.authenticatedContext(userId).firestore();
}

function snapshotExists(snapshot: unknown): boolean {
  if (snapshot && typeof snapshot === "object" && "exists" in snapshot) {
    const existsValue = (snapshot as { exists: unknown }).exists;
    return typeof existsValue === "function"
      ? Boolean((existsValue as () => boolean)())
      : Boolean(existsValue);
  }
  return false;
}

describeFirebaseWorkspaceEmulator("workspace persistence against the Firestore emulator", () => {
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

  it("creates a workspace, opens a session, appends messages, and writes a decision log entry", async () => {
    useFirestoreForUser("alice");

    const workspace = await createWorkspace("alice", {
      name: "Persistence workspace",
      description: "End-to-end emulator coverage",
      path: ["root", "math"],
      stableIdentityNote: "Keep stable across tutor turns.",
    });

    const session = await createSession("alice", workspace.id, {
      title: "Persistence session",
      summary: "Session created for emulator coverage.",
    });

    const userMessage = await appendMessage("alice", workspace.id, session.id, {
      role: "user",
      content: "Can we keep this workspace private?",
    });
    const tutorMessage = await appendMessage("alice", workspace.id, session.id, {
      role: "tutor",
      content: "Yes, it stays under your user tree.",
    });

    const messages = await listSessionMessages("alice", workspace.id, session.id);
    const sessionSnapshot = await activeFirestore!.doc(sessionPath("alice", workspace.id, session.id).join("/")).get();
    const workspaceSnapshot = await activeFirestore!.doc(workspacePath("alice", workspace.id).join("/")).get();

    const decisionLog = await writeDecisionLogEntry("alice", {
      decisionType: "mock_alignment",
      title: "Persistence write path",
      decision: "Persist workspace, session, messages, and decision log locally.",
      rationale: "The emulator suite should cover the full write path.",
      workspaceId: workspace.id,
      sessionId: session.id,
    });
    const decisionLogSnapshot = await activeFirestore!.doc(decisionLogPath("alice", decisionLog.id).join("/")).get();

    expect(userMessage.sequence).toBe(1);
    expect(tutorMessage.sequence).toBe(2);
    expect(messages.map((message) => message.role)).toEqual(["user", "tutor"]);
    expect(snapshotExists(sessionSnapshot)).toBe(true);
    expect(sessionSnapshot.data()?.messageCount).toBe(2);
    expect(snapshotExists(workspaceSnapshot)).toBe(true);
    expect(workspaceSnapshot.data()?.lastSessionId).toBe(session.id);
    expect(snapshotExists(decisionLogSnapshot)).toBe(true);
    expect(decisionLogSnapshot.data()).toMatchObject({
      userId: "alice",
      workspaceId: workspace.id,
      sessionId: session.id,
      title: "Persistence write path",
    });
  });

  it("prevents another user from reading or extending an owned workspace", async () => {
    useFirestoreForUser("alice");
    const workspace = await createWorkspace("alice", { name: "Private workspace" });
    const session = await createSession("alice", workspace.id, { title: "Private session" });

    useFirestoreForUser("bob");
    await expect(getWorkspace("bob", workspace.id)).resolves.toBeNull();
    await expect(createSession("bob", workspace.id, { title: "Cross-user session" })).rejects.toThrow("Workspace not found.");
    await expect(
      appendMessage("bob", workspace.id, session.id, {
        role: "user",
        content: "This should fail.",
      })
    ).rejects.toThrow("Workspace not found.");
  });
});
