import type { FirebaseApp } from "firebase/app";
import type { Firestore } from "firebase/firestore";

import type { FirestoreServerConfig } from "./firebaseServerConfig";

export interface FirestoreEmulatorClient {
  readonly app: FirebaseApp;
  readonly db: Firestore;
  readonly config: FirestoreServerConfig;
}

export interface FirestoreEmulatorUnavailableErrorShape {
  readonly code: "firestore_emulator_unreachable";
  readonly message: string;
  readonly endpoint: string;
  readonly projectId: FirestoreServerConfig["projectId"];
  readonly cause?: unknown;
}

export interface FirestoreRepositoryFailure {
  readonly code: "firestore_emulator_unreachable" | "firestore_operation_failed";
  readonly message: string;
  readonly cause?: unknown;
}

export type FirestoreRepositoryResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: FirestoreRepositoryFailure;
    };

export type FirestorePathSegment = string;
export type FirestoreDocumentPath = readonly [FirestorePathSegment, ...FirestorePathSegment[]];
