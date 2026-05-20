import { cert, getApps, initializeApp, type App, applicationDefault } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

import { getFirebaseServerMode, getRequiredServerProjectId } from "./firebaseServerRuntimeMode";

const ADMIN_APP_NAME = "private-tutor-admin";

let _adminApp: App | null = null;
let _adminDb: Firestore | null = null;
let _adminAuth: Auth | null = null;

function getProductionCredential() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKeyRaw) {
    return cert({
      projectId: getRequiredServerProjectId(),
      clientEmail,
      privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
    });
  }

  return applicationDefault();
}

export function getFirebaseAdminApp(): App {
  if (_adminApp) return _adminApp;

  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) {
    _adminApp = existing;
    return _adminApp;
  }

  const mode = getFirebaseServerMode();
  const projectId = getRequiredServerProjectId();

  _adminApp =
    mode === "emulator"
      ? initializeApp({ projectId }, ADMIN_APP_NAME)
      : initializeApp(
          {
            projectId,
            credential: getProductionCredential(),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET?.trim() || undefined,
          },
          ADMIN_APP_NAME
        );

  return _adminApp;
}

export function getFirebaseAdminFirestore(): Firestore {
  if (_adminDb) return _adminDb;
  _adminDb = getFirestore(getFirebaseAdminApp());
  return _adminDb;
}

export function getFirebaseAdminAuth(): Auth {
  if (_adminAuth) return _adminAuth;
  _adminAuth = getAuth(getFirebaseAdminApp());
  return _adminAuth;
}
