import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";

const CLIENT_APP_NAME = "demo-private-tutor-client";
const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";

let _clientApp: FirebaseApp | null = null;
let _clientAuth: Auth | null = null;

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
