import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  assertFirestoreEmulatorRunning,
  createWorkspaceEmulatorTestEnvironment,
  describeFirebaseWorkspaceEmulator,
  type WorkspaceEmulatorFirestore,
} from "./firestoreTestUtils";
import { createTutorPostHandler } from "../../src/app/api/tutor/route";
import { createWorkspaceWithId } from "../../src/server/workspaces/workspaceRepository";
import { listSessionMessages } from "../../src/server/workspaces/messageRepository";
import { withFirestoreEmulatorClient } from "../../src/server/firebase/firestoreEmulatorClient";

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

function useFirestoreForUser(userId: string) {
  if (!testEnv) {
    throw new Error("Workspace Firestore test environment is not ready.");
  }
  activeFirestore = testEnv.authenticatedContext(userId).firestore();
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/tutor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describeFirebaseWorkspaceEmulator("workspace persistence through POST /api/tutor", () => {
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

  it("persists user and tutor messages in sequence for the authenticated user", async () => {
    useFirestoreForUser("alice");
    const workspaceId = "workspace-route-alice";
    await createWorkspaceWithId("alice", workspaceId, { name: "Route Workspace" });

    const postTutor = createTutorPostHandler(async () => ({
      ok: true,
      user: {
        userId: "alice",
        email: "alice@example.test",
        authProvider: "password",
      },
    }));

    const response = await postTutor(
      makeRequest({
        userId: "alice",
        workspaceId,
        message: "Persist this turn.",
        workMode: "Learning",
        costMode: "Normal Learning",
        activeFileIds: [],
      })
    );

    expect(response.status).toBe(200);

    let sessionIds: string[] = [];
    await withFirestoreEmulatorClient("alice", async ({ db }) => {
      const sessionsSnapshot = await db.collection(`users/alice/workspaces/${workspaceId}/sessions`).get();
      sessionIds = sessionsSnapshot.docs.map((entry: { id: string }) => entry.id);
    });

    expect(sessionIds).toHaveLength(1);
    const messages = await listSessionMessages("alice", workspaceId, sessionIds[0]);
    expect(messages.map((m) => m.role)).toEqual(["user", "tutor"]);
    expect(messages[0].content).toBe("Persist this turn.");
  });
});
