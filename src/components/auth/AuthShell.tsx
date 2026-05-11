"use client";

import { ReactNode } from "react";
import { defaultAuthShellLabels } from "../../lib/firebase/clientAuthBoundary";
import { AuthShellLabels, ClientAuthState } from "../../lib/firebase/clientAuthTypes";

interface AuthShellProps {
  authState: ClientAuthState;
  children: ReactNode;
  labels?: Partial<AuthShellLabels>;
  onSignIn?: () => void;
  onRetry?: () => void;
  temporaryChatEntry?: ReactNode;
}

export function AuthShell({ authState, children, labels, onSignIn, onRetry, temporaryChatEntry }: AuthShellProps) {
  const copy = { ...defaultAuthShellLabels, ...labels };

  if (authState.status === "loading") {
    return (
      <main dir="rtl" lang="he" className="flex min-h-screen items-center justify-center bg-[#f7f3ea] px-6 text-[#1e1b16]">
        <p className="text-sm font-medium">{copy.loading}</p>
      </main>
    );
  }

  if (authState.status === "auth-error") {
    return (
      <main dir="rtl" lang="he" className="flex min-h-screen items-center justify-center bg-[#f7f3ea] px-6 text-[#1e1b16]">
        <section className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">{copy.authErrorTitle}</h1>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-[#c8bca9] px-4 py-2 text-sm font-medium hover:bg-[#efe6d7]"
            >
              {copy.retryAction}
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  if (authState.status === "signed-out") {
    return (
      <main dir="rtl" lang="he" className="flex min-h-screen items-center justify-center bg-[#f7f3ea] px-6 text-[#1e1b16]">
        <section className="w-full max-w-md space-y-5 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">{copy.signedOutTitle}</h1>
            <p className="text-sm leading-6 text-[#6f675c]">{copy.signedOutBody}</p>
          </div>
          {onSignIn ? (
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-md bg-[#1f5f5b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#164946]"
            >
              {copy.signInAction}
            </button>
          ) : null}
          <p className="text-xs leading-5 text-[#7a7165]">{copy.temporaryChatNote}</p>
          {temporaryChatEntry}
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
