import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore/lite";

import { firestoreServerConfig } from "./firebaseServerConfig";
import type { FirestoreEmulatorClient } from "./firestoreTypes";

const FIRESTORE_EMULATOR_APP_NAME = "demo-private-tutor-firestore-emulator";
const FIRESTORE_EMULATOR_TIMEOUT_MS = 1500;
const FIRESTORE_EMULATOR_CONNECTED_APPS_KEY = "__privateTutorFirestoreEmulatorConnectedApps";
const FIRESTORE_EMULATOR_ENV_READY_KEY = "__privateTutorFirestoreEmulatorEnvReady";
const FIRESTORE_SERVER_EMULATOR_UID = "server-emulator";

export class FirestoreEmulatorUnavailableError extends Error {
  public readonly code = "firestore_emulator_unreachable" as const;
  public readonly endpoint: string;
  public readonly projectId: string;
  public readonly cause?: unknown;

  constructor(message: string, endpoint: string, projectId: string, cause?: unknown) {
    super(message);
    this.name = "FirestoreEmulatorUnavailableError";
    this.endpoint = endpoint;
    this.projectId = projectId;
    this.cause = cause;
  }
}

let firestoreEmulatorClientPromise: Promise<FirestoreEmulatorClient> | null = null;

export async function getFirestoreEmulatorClient(): Promise<FirestoreEmulatorClient> {
  if (!firestoreEmulatorClientPromise) {
    firestoreEmulatorClientPromise = createFirestoreEmulatorClient().catch((error: unknown) => {
      firestoreEmulatorClientPromise = null;
      throw error;
    });
  }

  return firestoreEmulatorClientPromise;
}

export async function withFirestoreEmulatorClient<T>(
  handler: (client: FirestoreEmulatorClient) => Promise<T>
): Promise<T> {
  const client = await getFirestoreEmulatorClient();
  return handler(client);
}

export function isFirestoreEmulatorUnavailableError(error: unknown): error is FirestoreEmulatorUnavailableError {
  return error instanceof FirestoreEmulatorUnavailableError;
}

async function createFirestoreEmulatorClient(): Promise<FirestoreEmulatorClient> {
  ensureFirestoreEmulatorEnvironment();
  await assertFirestoreEmulatorReachable();

  const app = getOrCreateFirestoreApp();
  const db = getFirestore(app);

  const connectedApps = getConnectedFirestoreEmulatorApps();
  if (!connectedApps.has(app.name)) {
    connectFirestoreEmulator(
      db,
      firestoreServerConfig.host,
      firestoreServerConfig.port,
      {
        mockUserToken: {
          sub: FIRESTORE_SERVER_EMULATOR_UID,
          user_id: FIRESTORE_SERVER_EMULATOR_UID,
        },
      }
    );
    connectedApps.add(app.name);
  }

  return Object.freeze({
    app,
    db,
    config: firestoreServerConfig,
  });
}

function ensureFirestoreEmulatorEnvironment(): void {
  const globalState = globalThis as typeof globalThis & {
    [FIRESTORE_EMULATOR_ENV_READY_KEY]?: boolean;
  };

  if (globalState[FIRESTORE_EMULATOR_ENV_READY_KEY]) {
    return;
  }

  process.env.FIRESTORE_EMULATOR_HOST = `${firestoreServerConfig.host}:${firestoreServerConfig.port}`;
  process.env.GCLOUD_PROJECT = firestoreServerConfig.projectId;
  globalState[FIRESTORE_EMULATOR_ENV_READY_KEY] = true;
}

function getOrCreateFirestoreApp(): FirebaseApp {
  const existingApp = getApps().find((app) => app.name === FIRESTORE_EMULATOR_APP_NAME);

  if (existingApp) {
    return existingApp;
  }

  return initializeApp(
    {
      projectId: firestoreServerConfig.projectId,
    },
    FIRESTORE_EMULATOR_APP_NAME
  );
}

function getConnectedFirestoreEmulatorApps(): Set<string> {
  const globalState = globalThis as typeof globalThis & {
    [FIRESTORE_EMULATOR_CONNECTED_APPS_KEY]?: Set<string>;
  };

  if (!globalState[FIRESTORE_EMULATOR_CONNECTED_APPS_KEY]) {
    globalState[FIRESTORE_EMULATOR_CONNECTED_APPS_KEY] = new Set<string>();
  }

  return globalState[FIRESTORE_EMULATOR_CONNECTED_APPS_KEY];
}

async function assertFirestoreEmulatorReachable(): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, FIRESTORE_EMULATOR_TIMEOUT_MS);

  try {
    await fetch(firestoreServerConfig.baseUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (cause: unknown) {
    throw new FirestoreEmulatorUnavailableError(
      [
        "Firestore emulator is unreachable.",
        `Expected a local emulator at ${firestoreServerConfig.baseUrl} for project ${firestoreServerConfig.projectId}.`,
        "Start the emulator and retry.",
      ].join(" "),
      firestoreServerConfig.baseUrl,
      firestoreServerConfig.projectId,
      cause
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
