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
      <main
        dir="rtl"
        lang="he"
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: "var(--tutor-bg)", color: "var(--tutor-text)" }}
      >
        <p className="text-sm" style={{ color: "var(--tutor-text-muted)" }}>
          {copy.loading}
        </p>
      </main>
    );
  }

  if (authState.status === "auth-error") {
    return (
      <main
        dir="rtl"
        lang="he"
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: "var(--tutor-bg)", color: "var(--tutor-text)" }}
      >
        <section className="w-full max-w-md space-y-5 text-center">
          <h1 className="text-lg font-semibold">{copy.authErrorTitle}</h1>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
              style={{
                border: "1px solid var(--tutor-border)",
                color: "var(--tutor-text-secondary)",
              }}
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
      <main
        dir="rtl"
        lang="he"
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: "var(--tutor-bg)", color: "var(--tutor-text)" }}
      >
        <section className="w-full max-w-sm space-y-8 text-center">
          {/* Wordmark */}
          <div className="space-y-2">
            <h1
              className="font-display text-3xl"
              style={{ color: "var(--tutor-text)", fontFamily: "'Lora', Georgia, serif" }}
            >
              מורה פרטי
            </h1>
            <p className="text-sm leading-6" style={{ color: "var(--tutor-text-secondary)" }}>
              {copy.signedOutBody}
            </p>
          </div>

          {onSignIn ? (
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-xl px-8 py-3 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "var(--tutor-accent)" }}
            >
              {copy.signInAction}
            </button>
          ) : null}

          {copy.temporaryChatNote && (
            <p className="text-xs" style={{ color: "var(--tutor-text-muted)" }}>
              {copy.temporaryChatNote}
            </p>
          )}
          {temporaryChatEntry}
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
