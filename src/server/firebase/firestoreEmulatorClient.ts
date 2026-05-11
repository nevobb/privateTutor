import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

import { firestoreServerConfig } from "./firebaseServerConfig";
import type { FirestoreEmulatorClient } from "./firestoreTypes";

const FIRESTORE_EMULATOR_APP_NAME = "demo-private-tutor-firestore-emulator";
const FIRESTORE_EMULATOR_TIMEOUT_MS = 1500;

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
  await assertFirestoreEmulatorReachable();

  const { app, isNewApp } = getOrCreateFirestoreApp();
  const db = getFirestore(app);

  if (isNewApp) {
    connectFirestoreEmulator(db, firestoreServerConfig.host, firestoreServerConfig.port);
  }

  return Object.freeze({
    app,
    db,
    config: firestoreServerConfig,
  });
}

function getOrCreateFirestoreApp(): {
  readonly app: FirebaseApp;
  readonly isNewApp: boolean;
} {
  const existingApp = getApps().find((app) => app.name === FIRESTORE_EMULATOR_APP_NAME);

  if (existingApp) {
    return {
      app: existingApp,
      isNewApp: false,
    };
  }

  return {
    app: initializeApp(
      {
        projectId: firestoreServerConfig.projectId,
      },
      FIRESTORE_EMULATOR_APP_NAME
    ),
    isNewApp: true,
  };
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
