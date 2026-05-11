import { VerifiedFirebaseToken } from "./authTypes";

export async function verifyFirebaseToken(token: string): Promise<VerifiedFirebaseToken | null> {
  void token;
  throw new Error("Firebase token verification is not configured.");
}
