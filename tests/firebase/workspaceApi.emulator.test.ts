/**
 * Workspace API emulator integration tests.
 *
 * Requires the Firestore emulator to be running.
 * Run via: FIREBASE_WORKSPACE_API_EMULATOR_TEST=1 vitest run tests/firebase/workspaceApi.emulator.test.ts
 * Or:      npm run test:firebase:workspace-api:emulators (if added to package.json scripts)
 *
 * Default `npx vitest run` skips this suite entirely.
 */

import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { describe } from "vitest";
import {
  assertFirestoreEmulatorRunning,
  createWorkspaceEmulatorTestEnvironment,
  type WorkspaceEmulatorFirestore,
} from "./firestoreTestUtils";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  createWorkspacesGetHandler,
  createWorkspacesPostHandler,
} from "../../src/app/api/workspaces/route";
import { createWorkspaceByIdGetHandler } from "../../src/app/api/workspaces/[workspaceId]/route";
import type { AuthResult } from "../../src/server/auth/authTypes";

const WORKSPACE_API_EMULATOR_TEST_ENABLED = process.env.FIREBASE_WORKSPACE_API_EMULATOR_TEST === "1";
const describeWorkspaceApiEmulator = WORKSPACE_API_EMULATOR_TEST_ENABLED ? describe : describe.skip;

// The Firestore emulator client is mocked to use the test environment's Firestore instance.
let activeFirestore: WorkspaceEmulatorFirestore | null = null;

vi.mock("../../src/server/firebase/firestoreEmulatorClient", async () => {
  const actual = await vi.importActual<typeof import("../../src/server/firebase/firestoreEmulatorClient")>(
    "../../src/server/firebase/firestoreEmulatorClient"
  );

  return {
    ...(actual as object),
    getFirestoreEmulatorClient: async (_userId?: string) => {
      if (!activeFirestore) throw new Error("Workspace API Firestore test harness is not initialized.");
      return {
        app: {} as never,
        db: activeFirestore as never,
        config: { projectId: "demo-private-tutor", host: "127.0.0.1", port: 8080, baseUrl: "http://127.0.0.1:8080" },
      };
    },
    withFirestoreEmulatorClient: async <T>(
      userIdOrHandler: string | ((client: { db: WorkspaceEmulatorFirestore }) => Promise<T>),
      maybeHandler?: (client: { db: WorkspaceEmulatorFirestore }) => Promise<T>
    ) => {
      if (!activeFirestore) throw new Error("Workspace API Firestore test harness is not initialized.");
      const handler =
        typeof userIdOrHandler === "function" ? userIdOrHandler : maybeHandler;
      if (!handler) {
        throw new Error("Workspace API Firestore test harness did not receive a handler.");
      }
      return handler({ db: activeFirestore });
    },
    isFirestoreEmulatorUnavailableError: (error: unknown) =>
      (actual as { isFirestoreEmulatorUnavailableError: (e: unknown) => boolean }).isFirestoreEmulatorUnavailableError(error),
  };
});

let testEnv: RulesTestEnvironment | undefined;

function makeAuthResolver(userId: string): (req: Request) => Promise<AuthResult> {
  return async (_req) => ({ ok: true, user: { userId, email: `${userId}@test.example` } });
}

function makeFailingAuthResolver(): (req: Request) => Promise<AuthResult> {
  return async (_req) => ({ ok: false, status: 401, error: { error: "Unauthorized." } });
}

function makeByIdContext(workspaceId: string) {
  return { params: Promise.resolve({ workspaceId }) };
}

describeWorkspaceApiEmulator("workspace API emulator integration tests", () => {
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

  function useFirestoreForUser(userId: string) {
    activeFirestore = testEnv!.authenticatedContext(userId).firestore();
  }

  it("POST creates a workspace and returns 201 with correct shape", async () => {
    useFirestoreForUser("alice");

    const handler = createWorkspacesPostHandler(makeAuthResolver("alice"));
    const response = await handler(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "API Test Workspace", description: "from API" }),
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBeTruthy();
    expect(body.userId).toBe("alice");
    expect(body.name).toBe("API Test Workspace");
    expect(body.status).toBe("active");
    expect(typeof body.createdAt).toBe("string");
  });

  it("GET list returns created workspace for owner", async () => {
    useFirestoreForUser("alice");

    const postHandler = createWorkspacesPostHandler(makeAuthResolver("alice"));
    await postHandler(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Listed Workspace" }),
      })
    );

    const getHandler = createWorkspacesGetHandler(makeAuthResolver("alice"));
    const response = await getHandler(new Request("http://localhost/api/workspaces"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.workspaces)).toBe(true);
    const found = body.workspaces.find((w: { name: string }) => w.name === "Listed Workspace");
    expect(found).toBeTruthy();
    expect(found.userId).toBe("alice");
  });

  it("GET list returns empty for user with no workspaces", async () => {
    useFirestoreForUser("alice");

    const getHandler = createWorkspacesGetHandler(makeAuthResolver("alice"));
    const response = await getHandler(new Request("http://localhost/api/workspaces"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workspaces).toHaveLength(0);
  });

  it("GET by ID returns workspace when owner accesses it", async () => {
    useFirestoreForUser("alice");

    const postHandler = createWorkspacesPostHandler(makeAuthResolver("alice"));
    const createResponse = await postHandler(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Fetchable Workspace" }),
      })
    );
    const created = await createResponse.json();

    const getHandler = createWorkspaceByIdGetHandler(makeAuthResolver("alice"));
    const response = await getHandler(
      new Request(`http://localhost/api/workspaces/${created.id}`),
      makeByIdContext(created.id)
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(created.id);
    expect(body.name).toBe("Fetchable Workspace");
  });

  it("GET by ID returns 404 for non-existent workspace", async () => {
    useFirestoreForUser("alice");

    const getHandler = createWorkspaceByIdGetHandler(makeAuthResolver("alice"));
    const response = await getHandler(
      new Request("http://localhost/api/workspaces/does-not-exist"),
      makeByIdContext("does-not-exist")
    );

    expect(response.status).toBe(404);
  });

  it("GET list returns 401 for missing auth", async () => {
    useFirestoreForUser("alice");

    const getHandler = createWorkspacesGetHandler(makeFailingAuthResolver());
    const response = await getHandler(new Request("http://localhost/api/workspaces"));
    expect(response.status).toBe(401);
  });

  it("POST returns 400 for missing name", async () => {
    useFirestoreForUser("alice");

    const handler = createWorkspacesPostHandler(makeAuthResolver("alice"));
    const response = await handler(
      new Request("http://localhost/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: "no name here" }),
      })
    );
    expect(response.status).toBe(400);
  });
});
