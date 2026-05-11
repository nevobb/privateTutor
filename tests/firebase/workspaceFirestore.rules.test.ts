import { afterAll, afterEach, beforeAll, it } from "vitest";
import { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { createRulesTestEnvironment, describeFirebaseRules, expectAllowed, expectDenied } from "./rulesTestUtils";

// Field shapes that match what src/server/workspaces repositories actually write.
// These must stay in sync with the repository field shapes — not production rules.

const VALID_WORKSPACE = {
  id: "ws-1",
  userId: "alice",
  name: "Test Workspace",
  description: "desc",
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
};

const VALID_SESSION = {
  id: "sess-1",
  userId: "alice",
  workspaceId: "ws-1",
  title: "Test Session",
  status: "active",
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messageCount: 0,
};

const VALID_MESSAGE = {
  id: "msg-1",
  userId: "alice",
  workspaceId: "ws-1",
  sessionId: "sess-1",
  role: "user",
  content: "Hello",
  sequence: 1,
  createdAt: new Date().toISOString(),
  status: "sent",
};

const VALID_DECISION_LOG = {
  id: "dl-1",
  userId: "alice",
  decisionType: "mock_alignment",
  title: "Test decision",
  decision: "Do X",
  rationale: "Because Y",
  createdAt: new Date().toISOString(),
};

let testEnv: RulesTestEnvironment;

function dbFor(userId?: string) {
  return userId
    ? testEnv.authenticatedContext(userId).firestore()
    : testEnv.unauthenticatedContext().firestore();
}

describeFirebaseRules("Firestore workspace rules", () => {
  beforeAll(async () => {
    testEnv = await createRulesTestEnvironment();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  // ── workspace ──────────────────────────────────────────────────────────────

  it("denies unauthenticated create on workspace", async () => {
    const ref = dbFor(undefined).doc("users/alice/workspaces/ws-1");
    await expectDenied(ref.set(VALID_WORKSPACE));
  });

  it("denies unauthenticated read on workspace", async () => {
    const ref = dbFor(undefined).doc("users/alice/workspaces/ws-1");
    await expectDenied(ref.get());
  });

  it("allows owner to create workspace with valid shape", async () => {
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1");
    await expectAllowed(ref.set(VALID_WORKSPACE));
  });

  it("allows owner to read own workspace", async () => {
    await dbFor("alice").doc("users/alice/workspaces/ws-1").set(VALID_WORKSPACE);
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1");
    await expectAllowed(ref.get());
  });

  it("denies cross-user create on another user's workspace", async () => {
    const ref = dbFor("bob").doc("users/alice/workspaces/ws-1");
    await expectDenied(ref.set({ ...VALID_WORKSPACE, userId: "bob" }));
  });

  it("denies cross-user read on another user's workspace", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("users/alice/workspaces/ws-1").set(VALID_WORKSPACE);
    });
    const ref = dbFor("bob").doc("users/alice/workspaces/ws-1");
    await expectDenied(ref.get());
  });

  it("denies workspace create when userId field mismatches path", async () => {
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1");
    await expectDenied(ref.set({ ...VALID_WORKSPACE, userId: "bob" }));
  });

  it("denies workspace create when required fields are missing", async () => {
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1");
    // Missing 'name' and 'status'
    await expectDenied(ref.set({ userId: "alice" }));
  });

  // ── session ────────────────────────────────────────────────────────────────

  it("denies unauthenticated create on session", async () => {
    const ref = dbFor(undefined).doc("users/alice/workspaces/ws-1/sessions/sess-1");
    await expectDenied(ref.set(VALID_SESSION));
  });

  it("denies unauthenticated read on session", async () => {
    const ref = dbFor(undefined).doc("users/alice/workspaces/ws-1/sessions/sess-1");
    await expectDenied(ref.get());
  });

  it("allows owner to create session with valid shape", async () => {
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1");
    await expectAllowed(ref.set(VALID_SESSION));
  });

  it("allows owner to read own session", async () => {
    await dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1").set(VALID_SESSION);
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1");
    await expectAllowed(ref.get());
  });

  it("denies cross-user create on another user's session", async () => {
    const ref = dbFor("bob").doc("users/alice/workspaces/ws-1/sessions/sess-1");
    await expectDenied(ref.set({ ...VALID_SESSION, userId: "bob" }));
  });

  it("denies cross-user read on another user's session", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("users/alice/workspaces/ws-1/sessions/sess-1").set(VALID_SESSION);
    });
    const ref = dbFor("bob").doc("users/alice/workspaces/ws-1/sessions/sess-1");
    await expectDenied(ref.get());
  });

  it("denies session create when userId field mismatches path", async () => {
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1");
    await expectDenied(ref.set({ ...VALID_SESSION, userId: "bob" }));
  });

  it("denies session create when workspaceId field mismatches path", async () => {
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1");
    await expectDenied(ref.set({ ...VALID_SESSION, workspaceId: "other-ws" }));
  });

  it("denies session create when required fields are missing", async () => {
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1");
    // Missing 'title' and 'status'
    await expectDenied(ref.set({ userId: "alice", workspaceId: "ws-1" }));
  });

  // ── message ────────────────────────────────────────────────────────────────

  it("denies unauthenticated create on message", async () => {
    const ref = dbFor(undefined).doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1");
    await expectDenied(ref.set(VALID_MESSAGE));
  });

  it("denies unauthenticated read on message", async () => {
    const ref = dbFor(undefined).doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1");
    await expectDenied(ref.get());
  });

  it("allows owner to create message with valid shape", async () => {
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1");
    await expectAllowed(ref.set(VALID_MESSAGE));
  });

  it("allows owner to read own message", async () => {
    await dbFor("alice")
      .doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1")
      .set(VALID_MESSAGE);
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1");
    await expectAllowed(ref.get());
  });

  it("denies cross-user create on another user's message", async () => {
    const ref = dbFor("bob").doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1");
    await expectDenied(ref.set({ ...VALID_MESSAGE, userId: "bob" }));
  });

  it("denies cross-user read on another user's message", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1")
        .set(VALID_MESSAGE);
    });
    const ref = dbFor("bob").doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1");
    await expectDenied(ref.get());
  });

  it("denies message create when userId field mismatches path", async () => {
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1");
    await expectDenied(ref.set({ ...VALID_MESSAGE, userId: "bob" }));
  });

  it("denies message create when workspaceId field mismatches path", async () => {
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1");
    await expectDenied(ref.set({ ...VALID_MESSAGE, workspaceId: "other-ws" }));
  });

  it("denies message create when sessionId field mismatches path", async () => {
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1");
    await expectDenied(ref.set({ ...VALID_MESSAGE, sessionId: "other-sess" }));
  });

  it("denies message create when required fields are missing", async () => {
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1");
    // Missing 'role' and 'content'
    await expectDenied(ref.set({ userId: "alice", workspaceId: "ws-1", sessionId: "sess-1" }));
  });

  it("denies owner update on message (append-only enforcement)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1")
        .set(VALID_MESSAGE);
    });
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1");
    await expectDenied(ref.update({ content: "tampered" }));
  });

  it("denies owner delete on message (append-only enforcement)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1")
        .set(VALID_MESSAGE);
    });
    const ref = dbFor("alice").doc("users/alice/workspaces/ws-1/sessions/sess-1/messages/msg-1");
    await expectDenied(ref.delete());
  });

  // ── decision log ───────────────────────────────────────────────────────────
  // Policy: owner create+read allowed in emulator phase (Web SDK, no Admin).
  // Production hardening (deny all client writes) requires Firebase Admin SDK.

  it("denies unauthenticated create on decisionLog", async () => {
    const ref = dbFor(undefined).doc("users/alice/decisionLog/dl-1");
    await expectDenied(ref.set(VALID_DECISION_LOG));
  });

  it("denies unauthenticated read on decisionLog", async () => {
    const ref = dbFor(undefined).doc("users/alice/decisionLog/dl-1");
    await expectDenied(ref.get());
  });

  it("allows owner to create decisionLog entry with valid shape", async () => {
    const ref = dbFor("alice").doc("users/alice/decisionLog/dl-1");
    await expectAllowed(ref.set(VALID_DECISION_LOG));
  });

  it("allows owner to read own decisionLog entry", async () => {
    await dbFor("alice").doc("users/alice/decisionLog/dl-1").set(VALID_DECISION_LOG);
    const ref = dbFor("alice").doc("users/alice/decisionLog/dl-1");
    await expectAllowed(ref.get());
  });

  it("denies cross-user create on another user's decisionLog", async () => {
    const ref = dbFor("bob").doc("users/alice/decisionLog/dl-1");
    await expectDenied(ref.set({ ...VALID_DECISION_LOG, userId: "bob" }));
  });

  it("denies cross-user read on another user's decisionLog", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("users/alice/decisionLog/dl-1").set(VALID_DECISION_LOG);
    });
    const ref = dbFor("bob").doc("users/alice/decisionLog/dl-1");
    await expectDenied(ref.get());
  });

  it("denies decisionLog create when userId field mismatches path", async () => {
    const ref = dbFor("alice").doc("users/alice/decisionLog/dl-1");
    await expectDenied(ref.set({ ...VALID_DECISION_LOG, userId: "bob" }));
  });

  it("denies decisionLog create when required fields are missing", async () => {
    const ref = dbFor("alice").doc("users/alice/decisionLog/dl-1");
    // Missing 'decisionType' and 'title'
    await expectDenied(ref.set({ userId: "alice" }));
  });

  it("denies owner update on decisionLog (append-only enforcement)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("users/alice/decisionLog/dl-1").set(VALID_DECISION_LOG);
    });
    const ref = dbFor("alice").doc("users/alice/decisionLog/dl-1");
    await expectDenied(ref.update({ title: "tampered" }));
  });

  it("denies owner delete on decisionLog (append-only enforcement)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc("users/alice/decisionLog/dl-1").set(VALID_DECISION_LOG);
    });
    const ref = dbFor("alice").doc("users/alice/decisionLog/dl-1");
    await expectDenied(ref.delete());
  });

  // ── root / outside users ──────────────────────────────────────────────────

  it("denies authenticated write to root collection outside users", async () => {
    const ref = dbFor("alice").doc("public/globalDoc");
    await expectDenied(ref.set({ data: "leak" }));
  });

  it("denies authenticated read from root collection outside users", async () => {
    const ref = dbFor("alice").doc("system/config");
    await expectDenied(ref.get());
  });

  it("denies unauthenticated access to root collection", async () => {
    const ref = dbFor(undefined).doc("public/anything");
    await expectDenied(ref.get());
  });
});
