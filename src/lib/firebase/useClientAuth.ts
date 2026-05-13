"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getClientAuth } from "./firebaseClientApp";
import type { ClientAuthState } from "./clientAuthTypes";

export interface UseClientAuthResult {
  authState: ClientAuthState;
  getToken: () => Promise<string | null>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useClientAuth(): UseClientAuthResult {
  const [authState, setAuthState] = useState<ClientAuthState>({ status: "loading" });
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      userRef.current = user;
      if (user) {
        setAuthState({
          status: "signed-in",
          user: {
            userId: user.uid,
            displayName: user.displayName ?? undefined,
            email: user.email ?? undefined,
          },
        });
      } else {
        setAuthState({ status: "signed-out" });
      }
    });
    return unsubscribe;
  }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    const user = userRef.current;
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  }, []);

  const signIn = useCallback(async (): Promise<void> => {
    const auth = getClientAuth();
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch {
      setAuthState({ status: "auth-error", errorMessage: "כניסה נכשלה." });
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    const auth = getClientAuth();
    await firebaseSignOut(auth);
  }, []);

  return { authState, getToken, signIn, signOut };
}
