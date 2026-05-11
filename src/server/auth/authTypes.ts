export interface AuthenticatedUser {
  userId: string;
  authProvider?: string;
  email?: string;
}

export interface VerifiedFirebaseToken {
  uid?: string;
  email?: string;
  firebase?: {
    sign_in_provider?: string;
  };
}

export interface AuthFailure {
  status: 401 | 403;
  error: {
    error: string;
  };
}

export type AuthResult = { ok: true; user: AuthenticatedUser } | ({ ok: false } & AuthFailure);

export type BearerTokenResult = { ok: true; token: string } | ({ ok: false } & AuthFailure);

export type UserIdMatchResult = { ok: true } | ({ ok: false } & AuthFailure);

export type FirebaseTokenVerifier = (token: string) => Promise<VerifiedFirebaseToken | null>;
