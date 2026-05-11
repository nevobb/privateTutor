import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { createRulesTestEnvironment, describeFirebaseRules, expectAllowed, expectDenied } from "./rulesTestUtils";

let testEnv: RulesTestEnvironment;

function firestoreFor(userId?: string) {
  return userId ? testEnv.authenticatedContext(userId).firestore() : testEnv.unauthenticatedContext().firestore();
}

const VALID_SHAPES: Record<string, Record<string, unknown>> = {
  "users/alice/workspaces/workspace-1": {
    userId: "alice",
    name: "Test workspace",
    status: "active",
    updatedAt: Date.now(),
  },
  "users/alice/decisionLog/entry-1": {
    userId: "alice",
    decisionType: "mock_alignment",
    title: "Test decision",
    decision: "Do X",
    rationale: "Because Y",
    createdAt: new Date().toISOString(),
  },
};

function dataFor(path: string): Record<string, unknown> {
  return VALID_SHAPES[path] ?? { ownerId: "alice", updatedAt: Date.now() };
}

async function expectOwnDocAccess(path: string) {
  const db = firestoreFor("alice");
  const ref = db.doc(path);

  await expectAllowed(ref.set(dataFor(path)));
  await expectAllowed(ref.get());
}

async function expectDeniedReadWrite(userId: string | undefined, path: string) {
  const db = firestoreFor(userId);
  const ref = db.doc(path);

  await expectDenied(ref.set({ attemptedBy: userId ?? "anonymous" }));
  await expectDenied(ref.get());
}

describeFirebaseRules("Firestore user isolation rules", () => {
  beforeAll(async () => {
    testEnv = await createRulesTestEnvironment();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("allows an authenticated user to read and write their own user document", async () => {
    await expectOwnDocAccess("users/alice");
  });

  it("allows an authenticated user to read and write their own workspace document", async () => {
    await expectOwnDocAccess("users/alice/workspaces/workspace-1");
  });

  it("allows an authenticated user to read and write their own uploadedFiles metadata", async () => {
    await expectOwnDocAccess("users/alice/uploadedFiles/file-1");
  });

  it("allows an authenticated user to read and write their own learnerMemory document", async () => {
    await expectOwnDocAccess("users/alice/learnerMemory/memory-1");
  });

  it("allows an authenticated user to read and write their own academicKnowledge document", async () => {
    await expectOwnDocAccess("users/alice/academicKnowledge/knowledge-1");
  });

  it("allows an authenticated user to read and write their own decisionLog document", async () => {
    await expectOwnDocAccess("users/alice/decisionLog/entry-1");
  });

  it("denies cross-user reads and writes to another user's root document", async () => {
    await expectDeniedReadWrite("alice", "users/bob");
  });

  it("denies cross-user reads and writes to another user's workspace document", async () => {
    await expectDeniedReadWrite("alice", "users/bob/workspaces/workspace-1");
  });

  it("denies unauthenticated reads and writes under a user document", async () => {
    await expectDeniedReadWrite(undefined, "users/alice");
  });

  it("denies reads and writes outside the user-owned document tree", async () => {
    await expectDeniedReadWrite("alice", "public/globalDoc");
    await expectDeniedReadWrite("alice", "system/config");
  });

  it("uses the local demo project only", () => {
    expect(testEnv.projectId).toBe("demo-private-tutor");
  });
});
