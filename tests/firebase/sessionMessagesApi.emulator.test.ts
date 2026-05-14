/**
 * Session messages API emulator integration tests.
 *
 * Requires the Firestore emulator and explicit opt-in:
 * FIREBASE_SESSION_MESSAGES_EMULATOR_TEST=1 vitest run tests/firebase/sessionMessagesApi.emulator.test.ts
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

const ENABLED = process.env.FIREBASE_SESSION_MESSAGES_EMULATOR_TEST === "1";
const describeEmulator = ENABLED ? describe : describe.skip;

let activeFirestore: WorkspaceEmulatorFirestore | null = null;

vi.mock("../../src/server/firebase/firestoreEmulatorClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/server/firebase/firestoreEmulatorClient")
  >("../../src/server/firebase/firestoreEmulatorClient");

  return {
    ...(actual as object),
    getFirestoreEmulatorClient: async () => {
      if (!activeFirestore) throw new Error("Firestore test harness not initialized.");
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
    withFirestoreEmulatorClient: async <T>(
      handler: (client: { db: WorkspaceEmulatorFirestore }) => Promise<T>
    ) => {
      if (!activeFirestore) throw new Error("Firestore test harness not initialized.");
      return handler({ db: activeFirestore });
    },
    isFirestoreEmulatorUnavailableError: (
      actual as { isFirestoreEmulatorUnavailableError: (e: unknown) => boolean }
    ).isFirestoreEmulatorUnavailableError,
  };
});

let testEnv: RulesTestEnvironment | undefined;
let createWorkspaceFn: (userId: string, input: { name: string }) => Promise<{ id: string }>;
let createSessionFn: (userId: string, workspaceId: string) => Promise<{ id: string }>;
let createMessagesPostHandler: (
  auth?: (req: Request) => Promise<AuthResult>
) => (
  req: Request,
  ctx: { params: Promise<{ sessionId: string }> }
) => Promise<Response>;
let createMessagesGetHandler: (
  auth?: (req: Request) => Promise<AuthResult>
) => (
  req: Request,
  ctx: { params: Promise<{ sessionId: string }> }
) => Promise<Response>;

function makeAuth(userId: string) {
  return async (_req: Request): Promise<AuthResult> => ({
    ok: true,
    user: { userId, email: `${userId}@test.example` },
  });
}

describeEmulator("sessionMessagesApi emulator", () => {
  beforeAll(async () => {
    assertFirestoreEmulatorRunning();
    const env = await createWorkspaceEmulatorTestEnvironment("session-messages-api");
    testEnv = env.testEnv;
    activeFirestore = env.firestore;

    const workspaceRepo = await import("../../src/server/workspaces/workspaceRepository");
    const sessionRepo = await import("../../src/server/workspaces/sessionRepository");
    const route = await import(
      "../../src/app/api/sessions/[sessionId]/messages/route"
    );

    createWorkspaceFn = (userId, input) =>
      workspaceRepo.createWorkspace(userId, input).then((w) => ({ id: w.id }));
    createSessionFn = (userId, workspaceId) =>
      sessionRepo
        .createSession(userId, workspaceId, { title: "Test Session" })
        .then((s) => ({ id: s.id }));
    createMessagesPostHandler = route.createMessagesPostHandler;
    createMessagesGetHandler = route.createMessagesGetHandler;
  });

  afterEach(async () => {
    await testEnv?.clearFirestore();
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it("POST persists user message and tutor response; GET returns both", async () => {
    const { id: workspaceId } = await createWorkspaceFn("alice", { name: "Algebra" });
    const { id: sessionId } = await createSessionFn("alice", workspaceId);

    const postHandler = createMessagesPostHandler(makeAuth("alice"));
    const postReq = new Request(
      `http://test/api/sessions/${sessionId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          userMessage: "What is a derivative?",
          workMode: "Learning",
          costMode: "Normal Learning",
        }),
      }
    );
    const postRes = await postHandler(postReq, {
      params: Promise.resolve({ sessionId }),
    });
    expect(postRes.status).toBe(201);

    const postBody = (await postRes.json()) as {
      userMessage: { role: string };
      assistantMessage: { role: string };
    };
    expect(postBody.userMessage.role).toBe("user");
    expect(postBody.assistantMessage.role).toBe("tutor");

    const getHandler = createMessagesGetHandler(makeAuth("alice"));
    const getReq = new Request(
      `http://test/api/sessions/${sessionId}/messages?workspaceId=${workspaceId}`
    );
    const getRes = await getHandler(getReq, {
      params: Promise.resolve({ sessionId }),
    });
    expect(getRes.status).toBe(200);

    const getBody = (await getRes.json()) as { messages: { role: string }[] };
    expect(getBody.messages).toHaveLength(2);
    expect(getBody.messages[0].role).toBe("user");
    expect(getBody.messages[1].role).toBe("tutor");
  });

  it("GET returns 404 for cross-user access", async () => {
    const { id: workspaceId } = await createWorkspaceFn("alice", { name: "Physics" });
    const { id: sessionId } = await createSessionFn("alice", workspaceId);

    const getHandler = createMessagesGetHandler(makeAuth("bob"));
    const getReq = new Request(
      `http://test/api/sessions/${sessionId}/messages?workspaceId=${workspaceId}`
    );
    const getRes = await getHandler(getReq, {
      params: Promise.resolve({ sessionId }),
    });
    expect(getRes.status).toBe(404);
  });

  it("POST returns 404 for cross-user access", async () => {
    const { id: workspaceId } = await createWorkspaceFn("alice", { name: "Chemistry" });
    const { id: sessionId } = await createSessionFn("alice", workspaceId);

    const postHandler = createMessagesPostHandler(makeAuth("bob"));
    const postReq = new Request(
      `http://test/api/sessions/${sessionId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          userMessage: "hello",
          workMode: "Learning",
          costMode: "Normal Learning",
        }),
      }
    );
    const postRes = await postHandler(postReq, {
      params: Promise.resolve({ sessionId }),
    });
    expect(postRes.status).toBe(404);
  });
});
