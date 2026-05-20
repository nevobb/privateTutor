export type FirebaseClientMode = "emulator" | "production";

function normalizeMode(value: string | undefined): FirebaseClientMode {
  const normalized = (value ?? "emulator").trim().toLowerCase();
  if (normalized === "emulator" || normalized === "production") {
    return normalized;
  }
  throw new Error(
    `Invalid NEXT_PUBLIC_FIREBASE_MODE value: "${value ?? ""}". Expected "emulator" or "production".`
  );
}

export function getFirebaseClientMode(): FirebaseClientMode {
  return normalizeMode(process.env.NEXT_PUBLIC_FIREBASE_MODE);
}

export function isFirebaseClientEmulatorMode(): boolean {
  return getFirebaseClientMode() === "emulator";
}
