import { getFirebaseAdminAuth } from "../firebase/firebaseAdminApp";
import type { VerifiedFirebaseToken } from "./authTypes";

export async function verifyFirebaseTokenProduction(
  token: string
): Promise<VerifiedFirebaseToken | null> {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(trimmed, true);
    return {
      uid: decoded.uid,
      email: decoded.email,
      firebase: {
        sign_in_provider:
          typeof decoded.firebase?.sign_in_provider === "string"
            ? decoded.firebase.sign_in_provider
            : undefined,
      },
    };
  } catch {
    return null;
  }
}
