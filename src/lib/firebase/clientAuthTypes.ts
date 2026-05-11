export type ClientAuthStatus = "loading" | "signed-out" | "signed-in" | "auth-error";

export interface ClientAuthUser {
  userId: string;
  displayName?: string;
  email?: string;
  authProvider?: string;
}

export interface ClientAuthState {
  status: ClientAuthStatus;
  user?: ClientAuthUser;
  errorMessage?: string;
}

export interface AuthShellLabels {
  loading: string;
  signedOutTitle: string;
  signedOutBody: string;
  signInAction: string;
  temporaryChatNote: string;
  authErrorTitle: string;
  retryAction: string;
}
