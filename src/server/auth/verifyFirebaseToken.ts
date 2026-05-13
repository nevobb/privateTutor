import type { VerifiedFirebaseToken } from "./authTypes";
import { verifyFirebaseTokenEmulator } from "./verifyFirebaseTokenEmulator";

export async function verifyFirebaseToken(token: string): Promise<VerifiedFirebaseToken | null> {
  return verifyFirebaseTokenEmulator(token);
}
