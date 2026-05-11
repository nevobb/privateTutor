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
    getFirestoreEmulatorClient: async () => {
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
    withFirestoreEmulatorClient: async <T>(handler: (client: { db: WorkspaceEmulatorFirestore }) => Promise<T>) => {
      if (!activeFirestore) {
        throw new Error("Workspace Firestore test harness is not initialized.");
      }
      return handler({ db: activeFirestore });
    },
  };
});

import { writeDecisionLogEntry } from "../../../src/server/workspaces/decisionLogRepository";
import { decisionLogPath } from "../../../src/server/workspaces/decisionLogRepository";

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

describeFirebaseWorkspaceEmulator("decisionLogRepository against the Firestore emulator", () => {
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

  it("writes decision log entries under the authenticated user's path", async () => {
    useFirestoreForUser("alice");

    const entry = await writeDecisionLogEntry("alice", {
      decisionType: "mock_alignment",
      title: "Local mock alignment",
      decision: "Keep the tutor response mock-backed.",
      rationale: "The emulator test suite is still local-only.",
      workspaceId: "workspace-1",
      sessionId: "session-1",
    });

    const snapshot = await activeFirestore!.doc(decisionLogPath("alice", entry.id).join("/")).get();

    expect(entry.userId).toBe("alice");
    expect(entry.workspaceId).toBe("workspace-1");
    expect(entry.sessionId).toBe("session-1");
    expect(snapshotExists(snapshot)).toBe(true);
    expect(snapshot.data()).toMatchObject({
      userId: "alice",
      workspaceId: "workspace-1",
      sessionId: "session-1",
      title: "Local mock alignment",
      decision: "Keep the tutor response mock-backed.",
      rationale: "The emulator test suite is still local-only.",
    });
  });
});
