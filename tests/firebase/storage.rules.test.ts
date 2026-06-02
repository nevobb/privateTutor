import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { createRulesTestEnvironment, describeFirebaseRules, expectAllowed, expectDenied } from "./rulesTestUtils";

let testEnv: RulesTestEnvironment;

function storageFor(userId?: string) {
  return userId ? testEnv.authenticatedContext(userId).storage() : testEnv.unauthenticatedContext().storage();
}

async function expectOwnFileAccess(path: string) {
  const ref = storageFor("alice").ref(path);

  await expectAllowed(ref.putString("sample file content", "raw").then(() => undefined));
  await expectAllowed(ref.getMetadata());
}

async function expectDeniedFileReadWrite(userId: string | undefined, path: string) {
  const ref = storageFor(userId).ref(path);

  await expectDenied(ref.putString("sample file content", "raw").then(() => undefined));
  await expectDenied(ref.getMetadata());
}

describeFirebaseRules("Storage user isolation rules", () => {
  beforeAll(async () => {
    testEnv = await createRulesTestEnvironment();
  });

  afterEach(async () => {
    await testEnv.clearStorage();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("allows an authenticated user to write and read their own PDF-like file path", async () => {
    await expectOwnFileAccess("users/alice/files/sample.pdf");
  });

  it("allows an authenticated user to write and read their own DOCX-like file path", async () => {
    await expectOwnFileAccess("users/alice/files/sample.docx");
  });

  it("denies cross-user reads and writes to another user's file", async () => {
    await expectDeniedFileReadWrite("alice", "users/bob/files/sample.pdf");
  });

  it("denies unauthenticated reads and writes to a user's file", async () => {
    await expectDeniedFileReadWrite(undefined, "users/alice/files/sample.pdf");
  });

  it("denies reads and writes outside the user-owned storage path", async () => {
    await expectDeniedFileReadWrite("alice", "public/sample.pdf");
    await expectDeniedFileReadWrite("alice", "system/config.json");
  });

  it("uses the local demo project only", () => {
    expect(testEnv.projectId).toBe("demo-private-tutor");
  });
});
