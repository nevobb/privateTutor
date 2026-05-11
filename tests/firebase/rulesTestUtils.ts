import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe } from "vitest";
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";

export const RULES_TEST_ENABLED = process.env.FIREBASE_RULES_TEST === "1";

export const describeFirebaseRules = RULES_TEST_ENABLED ? describe : describe.skip;

const projectId = "demo-private-tutor";

export async function createRulesTestEnvironment(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync(resolve("firestore.rules"), "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: readFileSync(resolve("storage.rules"), "utf8"),
    },
  });
}

export async function expectAllowed(promise: Promise<unknown>) {
  await assertSucceeds(promise);
}

export async function expectDenied(promise: Promise<unknown>) {
  await assertFails(promise);
}
