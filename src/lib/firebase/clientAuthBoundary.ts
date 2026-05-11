import { AuthShellLabels, ClientAuthState } from "./clientAuthTypes";

export const defaultAuthShellLabels: AuthShellLabels = {
  loading: "בודק חיבור לחשבון...",
  signedOutTitle: "כניסה למרחב הלמידה",
  signedOutBody: "כדי לשמור מרחבים, זיכרון למידה וקבצים בהמשך, נדרש חשבון מאומת.",
  signInAction: "כניסה עם Google",
  temporaryChatNote: "צ'אט זמני יישאר זמני ולא יישמר לזיכרון קבוע.",
  authErrorTitle: "לא הצלחנו לאמת את החשבון",
  retryAction: "נסו שוב",
};

export const loadingAuthState: ClientAuthState = {
  status: "loading",
};

export const signedOutAuthState: ClientAuthState = {
  status: "signed-out",
};

export function isSignedInAuthState(state: ClientAuthState): boolean {
  return state.status === "signed-in" && typeof state.user?.userId === "string" && state.user.userId.length > 0;
}

export function getAuthenticatedUserId(state: ClientAuthState): string | undefined {
  return isSignedInAuthState(state) ? state.user?.userId : undefined;
}
