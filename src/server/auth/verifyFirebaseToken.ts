import type { VerifiedFirebaseToken } from "./authTypes";
import { isFirebaseServerEmulatorMode } from "../firebase/firebaseServerRuntimeMode";
import { verifyFirebaseTokenEmulator } from "./verifyFirebaseTokenEmulator";
import { verifyFirebaseTokenProduction } from "./verifyFirebaseTokenProduction";

export async function verifyFirebaseToken(token: string): Promise<VerifiedFirebaseToken | null> {
  if (isFirebaseServerEmulatorMode()) {
    return verifyFirebaseTokenEmulator(token);
  }

  return verifyFirebaseTokenProduction(token);
}
