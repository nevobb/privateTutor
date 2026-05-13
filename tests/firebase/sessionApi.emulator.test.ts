/**
 * Session API emulator integration tests.
 *
 * Requires the Firestore emulator and explicit opt-in:
 * FIREBASE_SESSION_API_EMULATOR_TEST=1 vitest run tests/firebase/sessionApi.emulator.test.ts
 *
 * Default `npx vitest run` skips this suite.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  assertFirestoreEmulatorRunning,
  createWorkspaceEmulatorTestEnvironment,
  type WorkspaceEmulatorFirestore,
} from "./firestoreTestUtils";
import type { AuthResult } from "../../src/server/auth/authTypes";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const SESSION_API_EMULATOR_TEST_ENABLED = process.env.FIREBASE_SESSION_API_EMULATOR_TEST === "1";
const SESSION_API_ROUTE_FILE = resolve(process.cwd(), "src/app/api/sessions/route.ts");
const hasSessionApiRoute = existsSync(SESSION_API_ROUTE_FILE);
const describeSessionApiEmulator = SESSION_API_EMULATOR_TEST_ENABLED && hasSessionApiRoute ? describe : describe.skip;

let activeFirestore: WorkspaceEmulatorFirestore | null = null;

vi.mock("../../src/server/firebase/firestoreEmulatorClient", async () => {
  const actual = await vi.importActual<typeof import("../../src/server/firebase/firestoreEmulatorClient")>(
    "../../src/server/firebase/firestoreEmulatorClient"
  );

  return {
    ...(actual as object),
    getFirestoreEmulatorClient: async () => {
      if (!activeFirestore) throw new Error("Session API Firestore test harness is not initialized.");
      return {
        app: {} as never,
        db: activeFirestore as never,
        config: {
          projectId: "demo-private-tutor",
          host: "127.0.0.1",
          port: 8080,
          baseUrl: "http://127.0.0.1:8080",
        },
      };
    },
    withFirestoreEmulatorClient: async <T>(handler: (client: { db: WorkspaceEmulatorFirestore }) => Promise<T>) => {
      if (!activeFirestore) throw new Error("Session API Firestore test harness is not initialized.");
      return handler({ db: activeFirestore });
    },
    isFirestoreEmulatorUnavailableError: (error: unknown) =>
      (actual as { isFirestoreEmulatorUnavailableError: (e: unknown) => boolean }).isFirestoreEmulatorUnavailableError(error),
  };
});

let testEnv: RulesTestEnvironment | undefined;
let createWorkspace: (userId: string, input: { name: string; description?: string }) => Promise<{ id: string }>;
let createSessionsPostHandler: (
  authResolver?: (req: Request) => Promise<AuthResult>
) => (request: Request) => Promise<Response>;
let createSessionsGetHandler: (
  authResolver?: (req: Request) => Promise<AuthResult>
) => (request: Request) => Promise<Response>;

function makeAuthResolver(userId: string): (req: Request) => Promise<AuthResult> {
  return async (_req) => ({ ok: true, user: { userId, email: `${userId}@test.example` } });
}

function makeFailingAuthResolver(status: 401 | 403 = 401): (req: Request) => Promise<AuthResult> {
  return async (_req) => ({ ok: false, status, error: { error: "Unauthorized." } });
}

function useFirestoreForUser(userId: string) {
  activeFirestore = testEnv!.authenticatedContext(userId).firestore();
}

describeSessionApiEmulator("session API emulator integration tests", () => {
  beforeAll(async () => {
    await assertFirestoreEmulatorRunning();
    testEnv = await createWorkspaceEmulatorTestEnvironment();

    ({ createWorkspace } = (await import("../../src/server/workspaces/workspaceRepository")) as {
      createWorkspace: typeof createWorkspace;
    });

    ({ createSessionsPostHandler, createSessionsGetHandler } = (await import("../../src/app/api/sessions/route")) as {
      createSessionsPostHandler: typeof createSessionsPostHandler;
      createSessionsGetHandler: typeof createSessionsGetHandler;
    });
  });

  afterEach(async () => {
    await testEnv!.clearFirestore();
    activeFirestore = null;
  });

  afterAll(async () => {
    await testEnv!.cleanup();
  });

  it("POST /api/sessions returns 201 for authenticated owner with existing workspace", async () => {
    useFirestoreForUser("alice");
    const workspace = await createWorkspace("alice", { name: "Session API workspace" });

    const handler = createSessionsPostHandler(makeAuthResolver("alice"));
    const response = await handler(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          title: "Limits session",
          workMode: "Learning",
          costMode: "Normal Learning",
          activeTopic: "Limits",
        }),
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.session).toBeTruthy();
    expect(body.session.workspaceId).toBe(workspace.id);
    expect(body.session.status).toBe("active");
    expect(typeof body.session.startedAt).toBe("string");
    expect(typeof body.session.lastActiveAt).toBe("string");
  });

  it("GET /api/sessions returns created sessions for owned workspace", async () => {
    useFirestoreForUser("alice");
    const workspace = await createWorkspace("alice", { name: "Session listing workspace" });

    const postHandler = createSessionsPostHandler(makeAuthResolver("alice"));
    await postHandler(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, title: "Listed session" }),
      })
    );

    const getHandler = createSessionsGetHandler(makeAuthResolver("alice"));
    const response = await getHandler(
      new Request(`http://localhost/api/sessions?workspaceId=${encodeURIComponent(workspace.id)}`)
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(body.sessions.length).toBeGreaterThan(0);
    expect(body.sessions[0].workspaceId).toBe(workspace.id);
  });

  it("cross-user GET cannot list another user's workspace sessions", async () => {
    useFirestoreForUser("alice");
    const workspace = await createWorkspace("alice", { name: "Alice private workspace" });

    const postHandler = createSessionsPostHandler(makeAuthResolver("alice"));
    await postHandler(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, title: "Private session" }),
      })
    );

    useFirestoreForUser("bob");
    const bobGetHandler = createSessionsGetHandler(makeAuthResolver("bob"));
    const response = await bobGetHandler(
      new Request(`http://localhost/api/sessions?workspaceId=${encodeURIComponent(workspace.id)}`)
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Workspace not found." });
  });

  it("missing workspace returns 404 for create and list", async () => {
    useFirestoreForUser("alice");

    const postHandler = createSessionsPostHandler(makeAuthResolver("alice"));
    const createResponse = await postHandler(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: "does-not-exist", title: "No workspace" }),
      })
    );
    expect(createResponse.status).toBe(404);

    const getHandler = createSessionsGetHandler(makeAuthResolver("alice"));
    const listResponse = await getHandler(
      new Request("http://localhost/api/sessions?workspaceId=does-not-exist")
    );
    expect(listResponse.status).toBe(404);
  });

  it("GET /api/sessions returns 401 when auth fails", async () => {
    useFirestoreForUser("alice");

    const getHandler = createSessionsGetHandler(makeFailingAuthResolver());
    const response = await getHandler(new Request("http://localhost/api/sessions?workspaceId=ws-1"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized." });
  });
});
