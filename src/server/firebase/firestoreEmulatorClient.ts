import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore/lite";

import { firestoreServerConfig } from "./firebaseServerConfig";
import type { FirestoreEmulatorClient } from "./firestoreTypes";

const FIRESTORE_EMULATOR_APP_NAME = "demo-private-tutor-firestore-emulator";
const FIRESTORE_EMULATOR_TIMEOUT_MS = 1500;
const FIRESTORE_EMULATOR_CONNECTED_APPS_KEY = "__privateTutorFirestoreEmulatorConnectedApps";
const FIRESTORE_EMULATOR_ENV_READY_KEY = "__privateTutorFirestoreEmulatorEnvReady";

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

const firestoreEmulatorClientPromisesByUser = new Map<string, Promise<FirestoreEmulatorClient>>();

export async function getFirestoreEmulatorClient(userId: string): Promise<FirestoreEmulatorClient> {
  const normalizedUserId = normalizeUserId(userId);
  const existingPromise = firestoreEmulatorClientPromisesByUser.get(normalizedUserId);

  if (existingPromise) {
    return existingPromise;
  }

  const clientPromise = createFirestoreEmulatorClient(normalizedUserId).catch((error: unknown) => {
    firestoreEmulatorClientPromisesByUser.delete(normalizedUserId);
    throw error;
  });

  firestoreEmulatorClientPromisesByUser.set(normalizedUserId, clientPromise);
  return clientPromise;
}

export async function withFirestoreEmulatorClient<T>(
  userId: string,
  handler: (client: FirestoreEmulatorClient) => Promise<T>
): Promise<T> {
  const client = await getFirestoreEmulatorClient(userId);
  return handler(client);
}

export function isFirestoreEmulatorUnavailableError(error: unknown): error is FirestoreEmulatorUnavailableError {
  return error instanceof FirestoreEmulatorUnavailableError;
}

async function createFirestoreEmulatorClient(userId: string): Promise<FirestoreEmulatorClient> {
  ensureFirestoreEmulatorEnvironment();
  await assertFirestoreEmulatorReachable();

  const app = getOrCreateFirestoreAppForUser(userId);
  const db = getFirestore(app);

  const connectedApps = getConnectedFirestoreEmulatorApps();
  if (!connectedApps.has(app.name)) {
    connectFirestoreEmulator(
      db,
      firestoreServerConfig.host,
      firestoreServerConfig.port,
      {
        mockUserToken: {
          sub: userId,
          user_id: userId,
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

function getOrCreateFirestoreAppForUser(userId: string): FirebaseApp {
  const appName = `${FIRESTORE_EMULATOR_APP_NAME}-${encodeUserIdForAppName(userId)}`;
  const existingApp = getApps().find((app) => app.name === appName);

  if (existingApp) {
    return existingApp;
  }

  return initializeApp(
    {
      projectId: firestoreServerConfig.projectId,
    },
    appName
  );
}

function normalizeUserId(userId: string): string {
  const trimmed = typeof userId === "string" ? userId.trim() : "";
  if (!trimmed) {
    throw new Error("trusted userId is required for Firestore emulator client.");
  }
  return trimmed;
}

function encodeUserIdForAppName(userId: string): string {
  return Buffer.from(userId, "utf8").toString("base64url");
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
