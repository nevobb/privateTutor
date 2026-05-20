import { firestoreServerConfig } from "./firebaseServerConfig";
import { getFirebaseAdminFirestore } from "./firebaseAdminApp";
import { getFirebaseServerMode, getRequiredServerProjectId } from "./firebaseServerRuntimeMode";
import type { FirestoreEmulatorClient } from "./firestoreTypes";

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

const firestoreClientPromisesByUser = new Map<string, Promise<FirestoreEmulatorClient>>();

export async function getFirestoreEmulatorClient(userId: string): Promise<FirestoreEmulatorClient> {
  const normalizedUserId = normalizeUserId(userId);
  const existingPromise = firestoreClientPromisesByUser.get(normalizedUserId);

  if (existingPromise) {
    return existingPromise;
  }

  const clientPromise = createFirestoreClient(normalizedUserId).catch((error: unknown) => {
    firestoreClientPromisesByUser.delete(normalizedUserId);
    throw error;
  });

  firestoreClientPromisesByUser.set(normalizedUserId, clientPromise);
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

async function createFirestoreClient(userId: string): Promise<FirestoreEmulatorClient> {
  const mode = getFirebaseServerMode();
  const projectId = getRequiredServerProjectId();

  if (mode === "emulator") {
    ensureFirestoreEmulatorEnvironment(projectId);
    await assertFirestoreEmulatorReachable(projectId);
  }

  const db = getFirebaseAdminFirestore();

  return Object.freeze({
    db,
    config: {
      projectId,
      host: firestoreServerConfig.host,
      port: firestoreServerConfig.port,
      baseUrl: firestoreServerConfig.baseUrl,
    },
  });
}

function ensureFirestoreEmulatorEnvironment(projectId: string): void {
  process.env.FIRESTORE_EMULATOR_HOST = `${firestoreServerConfig.host}:${firestoreServerConfig.port}`;
  process.env.GCLOUD_PROJECT = projectId;
}

function normalizeUserId(userId: string): string {
  const trimmed = typeof userId === "string" ? userId.trim() : "";
  if (!trimmed) {
    throw new Error("trusted userId is required for Firestore server client.");
  }
  return trimmed;
}

async function assertFirestoreEmulatorReachable(projectId: string): Promise<void> {
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
        `Expected a local emulator at ${firestoreServerConfig.baseUrl} for project ${projectId}.`,
        "Start the emulator and retry.",
      ].join(" "),
      firestoreServerConfig.baseUrl,
      projectId,
      cause
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
