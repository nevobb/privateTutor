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

import { createWorkspace, getWorkspace } from "../../../src/server/workspaces/workspaceRepository";
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

describeFirebaseWorkspaceEmulator("workspaceRepository against the Firestore emulator", () => {
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

  it("creates and reads back an owned workspace document", async () => {
    useFirestoreForUser("alice");

    const created = await createWorkspace("alice", {
      name: "Alice workspace",
      description: "Workspace repository test",
      path: ["root", "algebra"],
      stableIdentityNote: "Keep this workspace stable.",
    });

    const rawSnapshot = await activeFirestore!.doc(workspacePath("alice", created.id).join("/")).get();
    const loaded = await getWorkspace("alice", created.id);

    expect(snapshotExists(rawSnapshot)).toBe(true);
    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject({
      id: created.id,
      userId: "alice",
      name: "Alice workspace",
      description: "Workspace repository test",
      path: ["root", "algebra"],
      stableIdentityNote: "Keep this workspace stable.",
      status: "active",
    });
  });

  it("keeps another user's workspace out of reach", async () => {
    useFirestoreForUser("alice");
    const created = await createWorkspace("alice", {
      name: "Private workspace",
    });

    useFirestoreForUser("bob");
    await expect(getWorkspace("bob", created.id)).resolves.toBeNull();
  });
});
