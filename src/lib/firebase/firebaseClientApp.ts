import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getStorage, connectStorageEmulator, type FirebaseStorage } from "firebase/storage";

const CLIENT_APP_NAME = "demo-private-tutor-client";
const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";

let _clientApp: FirebaseApp | null = null;
let _clientAuth: Auth | null = null;
let _clientStorage: FirebaseStorage | null = null;

export function getClientFirebaseApp(): FirebaseApp {
  if (_clientApp) return _clientApp;
  const existing = getApps().find((a) => a.name === CLIENT_APP_NAME);
  if (existing) {
    _clientApp = existing;
    return _clientApp;
  }
  _clientApp = initializeApp(
    {
      apiKey: "demo-key",
      projectId: "demo-private-tutor",
      authDomain: "demo-private-tutor.firebaseapp.com",
      storageBucket:
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
        "demo-private-tutor.appspot.com",
    },
    CLIENT_APP_NAME
  );
  return _clientApp;
}

export function getClientAuth(): Auth {
  if (_clientAuth) return _clientAuth;
  const app = getClientFirebaseApp();
  _clientAuth = getAuth(app);
  connectAuthEmulator(_clientAuth, AUTH_EMULATOR_URL, { disableWarnings: true });
  return _clientAuth;
}

export function getClientStorage(): FirebaseStorage {
  if (_clientStorage) return _clientStorage;
  const app = getClientFirebaseApp();
  _clientStorage = getStorage(app);
  connectStorageEmulator(_clientStorage, "127.0.0.1", 9199);
  return _clientStorage;
}
