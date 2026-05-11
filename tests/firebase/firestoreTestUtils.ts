import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";

export const FIREBASE_WORKSPACE_EMULATOR_TEST_ENABLED = process.env.FIREBASE_WORKSPACE_EMULATOR_TEST === "1";
export const describeFirebaseWorkspaceEmulator = FIREBASE_WORKSPACE_EMULATOR_TEST_ENABLED ? describe : describe.skip;
export type WorkspaceEmulatorFirestore = ReturnType<ReturnType<RulesTestEnvironment["authenticatedContext"]>["firestore"]>;

const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const FIREBASE_PROJECT_ID = "demo-private-tutor";

function parseEmulatorHost(host: string): { host: string; port: number } {
  const [emulatorHost, portText] = host.split(":");
  const parsedPort = Number.parseInt(portText ?? "", 10);

  return {
    host: emulatorHost || "127.0.0.1",
    port: Number.isFinite(parsedPort) ? parsedPort : 8080,
  };
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cancel() {
      clearTimeout(timeoutId);
    },
  };
}

export async function assertFirestoreEmulatorRunning(): Promise<void> {
  const { host, port } = parseEmulatorHost(FIRESTORE_EMULATOR_HOST);
  const { signal, cancel } = createTimeoutSignal(1500);

  try {
    await fetch(`http://${host}:${port}/`, { signal });
  } catch {
    throw new Error(
      [
        "FIREBASE_WORKSPACE_EMULATOR_TEST=1 is set, but the Firebase Firestore emulator is not reachable.",
        `Expected a local Firestore emulator at http://${host}:${port} for project ${FIREBASE_PROJECT_ID}.`,
        "Start the emulator and rerun the test.",
      ].join(" "),
    );
  } finally {
    cancel();
  }
}

export async function createWorkspaceEmulatorTestEnvironment(): Promise<RulesTestEnvironment> {
  const { host, port } = parseEmulatorHost(FIRESTORE_EMULATOR_HOST);

  return initializeTestEnvironment({
    projectId: FIREBASE_PROJECT_ID,
    firestore: {
      host,
      port,
      rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
    },
  });
}
