import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getStorage, connectStorageEmulator, type FirebaseStorage } from "firebase/storage";
import { getFirebaseClientMode, isFirebaseClientEmulatorMode } from "./firebaseRuntimeMode";

const CLIENT_APP_NAME = "private-tutor-client";
const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";

let _clientApp: FirebaseApp | null = null;
let _clientAuth: Auth | null = null;
let _clientStorage: FirebaseStorage | null = null;

let _authEmulatorConnected = false;
let _storageEmulatorConnected = false;

function buildClientConfig() {
  if (isFirebaseClientEmulatorMode()) {
    return {
      apiKey: "demo-key",
      projectId: "demo-private-tutor",
      authDomain: "demo-private-tutor.firebaseapp.com",
      storageBucket: "demo-private-tutor.appspot.com",
    };
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();

  if (!apiKey || !authDomain || !projectId || !storageBucket) {
    throw new Error(
      "Missing Firebase public config for NEXT_PUBLIC_FIREBASE_MODE=production. " +
        "Required: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, " +
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET."
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || undefined,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
  };
}

export function getClientFirebaseApp(): FirebaseApp {
  if (_clientApp) return _clientApp;
  const existing = getApps().find((a) => a.name === CLIENT_APP_NAME);
  if (existing) {
    _clientApp = existing;
    return _clientApp;
  }

  _clientApp = initializeApp(buildClientConfig(), CLIENT_APP_NAME);
  return _clientApp;
}

export function getClientAuth(): Auth {
  if (_clientAuth) return _clientAuth;
  const app = getClientFirebaseApp();
  _clientAuth = getAuth(app);

  if (isFirebaseClientEmulatorMode() && !_authEmulatorConnected) {
    connectAuthEmulator(_clientAuth, AUTH_EMULATOR_URL, { disableWarnings: true });
    _authEmulatorConnected = true;
  }

  return _clientAuth;
}

export function getClientStorage(): FirebaseStorage {
  if (_clientStorage) return _clientStorage;
  const app = getClientFirebaseApp();
  _clientStorage = getStorage(app);

  if (isFirebaseClientEmulatorMode() && !_storageEmulatorConnected) {
    connectStorageEmulator(_clientStorage, "127.0.0.1", 9199);
    _storageEmulatorConnected = true;
  }

  return _clientStorage;
}

export function getClientFirebaseModeLabel(): "emulator" | "production" {
  return getFirebaseClientMode();
}
