export type FirebaseServerMode = "emulator" | "production";

function normalizeMode(value: string | undefined): FirebaseServerMode {
  const normalized = (value ?? "emulator").trim().toLowerCase();
  if (normalized === "emulator" || normalized === "production") {
    return normalized;
  }
  throw new Error(
    `Invalid FIREBASE_MODE value: "${value ?? ""}". Expected "emulator" or "production".`
  );
}

export function getFirebaseServerMode(): FirebaseServerMode {
  return normalizeMode(process.env.FIREBASE_MODE);
}

export function isFirebaseServerEmulatorMode(): boolean {
  return getFirebaseServerMode() === "emulator";
}

export function getRequiredServerProjectId(): string {
  if (isFirebaseServerEmulatorMode()) {
    return "demo-private-tutor";
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error("Missing FIREBASE_PROJECT_ID for FIREBASE_MODE=production.");
  }

  return projectId;
}
