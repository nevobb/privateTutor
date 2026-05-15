"use client";

import React, { useCallback, useEffect, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import CollapsiblePanel from "../components/layout/CollapsiblePanel";
import ThemePicker from "../components/settings/ThemePicker";
import WorkspaceSelector, {
  type SessionLoadState,
  type WorkspaceLoadState,
} from "../components/workspaces/WorkspaceSelector";
import FilePanel from "../components/files/FilePanel";
import MemoryPanel from "../components/memory/MemoryPanel";
import TutorConversation from "../components/tutor/TutorConversation";
import { AuthShell } from "../components/auth/AuthShell";
import { useClientAuth } from "../lib/firebase/useClientAuth";
import {
  fetchWorkspaces,
  createWorkspace,
  WorkspaceApiError,
} from "../lib/workspaces/workspaceApiClient";
import type { WorkspaceListItem } from "../lib/workspaces/workspaceApiTypes";
import {
  createSession,
  fetchSessions,
  SessionApiError,
} from "../lib/sessions/sessionApiClient";
import type { SessionApiSession } from "../lib/sessions/sessionApiTypes";
import type { CostMode, WorkMode } from "../types";
import { mockFiles, mockLearnerMemory } from "../mock/data";

function sortSessionsByRecent(sessions: SessionApiSession[]): SessionApiSession[] {
  return [...sessions].sort((a, b) => {
    const aTime = Date.parse(a.lastActiveAt || a.startedAt || "");
    const bTime = Date.parse(b.lastActiveAt || b.startedAt || "");
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
    return bTime - aTime;
  });
}

function getSafeSessionErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof SessionApiError)) {
    return fallback;
  }

  if (error.status === 401) {
    return "פג תוקף ההתחברות. יש להתחבר מחדש.";
  }

  if (error.status === 404) {
    return "המרחב שנבחר לא נמצא.";
  }

  if (error.status === 503) {
    return "שירות השיחות אינו זמין כרגע.";
  }

  return fallback;
}

export default function Home() {
  const { authState, getToken, signIn } = useClientAuth();
  const [workspaceState, setWorkspaceState] = useState<WorkspaceLoadState>({
    status: "loading",
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  const [sessionState, setSessionState] = useState<SessionLoadState>({
    status: "disabled",
    message: "בחר נושא כדי לטעון שיחות.",
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [createSessionError, setCreateSessionError] = useState<string | null>(null);

  const [workMode, setWorkMode] = useState<WorkMode>("Learning");
  const [costMode, setCostMode] = useState<CostMode>("Normal Learning");

  const handleWorkspaceSelect = useCallback((workspaceId: string): void => {
    setActiveSessionId(null);
    setCreateSessionError(null);
    setActiveWorkspaceId(workspaceId);
  }, []);

  useEffect(() => {
    if (authState.status !== "signed-in") return;

    let cancelled = false;

    void (async () => {
      setWorkspaceState({ status: "loading" });
      try {
        const token = await getToken();
        if (!token) {
          setWorkspaceState({ status: "error", message: "לא ניתן לאמת את המשתמש." });
          return;
        }
        const workspaces = await fetchWorkspaces(token);
        if (cancelled) return;
        setWorkspaceState({ status: "ready", workspaces });
        setActiveWorkspaceId((prev) =>
          prev !== null ? prev : workspaces.length > 0 ? workspaces[0].id : null
        );
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          err instanceof WorkspaceApiError ? err.message : "שגיאה בטעינת הנושאים.";
        setWorkspaceState({ status: "error", message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authState.status, getToken]);

  useEffect(() => {
    let cancelled = false;

    const syncSessions = async (): Promise<void> => {
      if (authState.status !== "signed-in") {
        if (!cancelled) {
          setActiveSessionId(null);
          setSessionState({ status: "disabled", message: "התחבר כדי לראות שיחות." });
        }
        return;
      }

      if (!activeWorkspaceId) {
        if (!cancelled) {
          setActiveSessionId(null);
          setSessionState({ status: "disabled", message: "בחר נושא כדי לטעון שיחות." });
        }
        return;
      }

      setSessionState({ status: "loading" });
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) {
            setSessionState({ status: "error", message: "לא ניתן לאמת את המשתמש." });
          }
          return;
        }

        const sessions = sortSessionsByRecent(
          await fetchSessions(token, activeWorkspaceId)
        );
        if (cancelled) return;

        setSessionState({ status: "ready", sessions });
        setActiveSessionId(sessions.length > 0 ? sessions[0].id : null);
      } catch (err: unknown) {
        if (cancelled) return;
        setSessionState({
          status: "error",
          message: getSafeSessionErrorMessage(err, "שגיאה בטעינת השיחות."),
        });
      }
    };

    void syncSessions();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, authState.status, getToken]);

  const handleCreateWorkspace = useCallback(
    async (name: string): Promise<void> => {
      const token = await getToken();
      if (!token) throw new Error("לא מאומת.");
      const workspace: WorkspaceListItem = await createWorkspace(token, { name });
      setWorkspaceState((prev) => {
        const existing = prev.status === "ready" ? prev.workspaces : [];
        return { status: "ready", workspaces: [...existing, workspace] };
      });
      setActiveSessionId(null);
      setCreateSessionError(null);
      setActiveWorkspaceId(workspace.id);
    },
    [getToken]
  );

  const handleCreateSession = useCallback(async (): Promise<void> => {
    if (!activeWorkspaceId) {
      setCreateSessionError("בחר נושא לפני יצירת שיחה חדשה.");
      return;
    }

    setCreatingSession(true);
    setCreateSessionError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("לא ניתן לאמת את המשתמש.");
      }

      const created = await createSession(token, {
        workspaceId: activeWorkspaceId,
        workMode,
        costMode,
      });

      setSessionState((prev) => {
        const existing = prev.status === "ready" ? prev.sessions : [];
        const merged = [created, ...existing.filter((entry) => entry.id !== created.id)];
        return {
          status: "ready",
          sessions: sortSessionsByRecent(merged),
        };
      });
      setActiveSessionId(created.id);
    } catch (err: unknown) {
      setCreateSessionError(getSafeSessionErrorMessage(err, "יצירת שיחה נכשלה."));
    } finally {
      setCreatingSession(false);
    }
  }, [activeWorkspaceId, costMode, getToken, workMode]);

  const displayName =
    authState.status === "signed-in"
      ? (authState.user?.displayName ?? authState.user?.email ?? "משתמש")
      : null;

  const avatarLetter =
    authState.status === "signed-in"
      ? (authState.user?.displayName?.[0]?.toUpperCase() ?? "N")
      : "N";

  const activeTopicName: string | null =
    workspaceState.status === "ready" && activeWorkspaceId !== null
      ? (workspaceState.workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null)
      : null;

  const sidebar = (
    <div className="flex flex-col h-full" dir="ltr">
      {/* Sidebar header: app name + user */}
      <div
        className="flex items-center justify-between px-4 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--tutor-sidebar-border)" }}
      >
        <span
          className="text-lg font-semibold"
          style={{
            fontFamily: "'Lora', Georgia, serif",
            color: "var(--tutor-sidebar-text-active)",
            letterSpacing: "-0.01em",
          }}
        >
          Private Tutor
        </span>
        {authState.status === "signed-in" && (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: "var(--tutor-accent)" }}
              title={displayName ?? undefined}
              aria-label={displayName ?? "משתמש"}
            >
              {avatarLetter}
            </div>
          </div>
        )}
      </div>

      {/* Navigation: workspaces + sessions */}
      <div className="flex-1 overflow-y-auto py-1">
        <WorkspaceSelector
          loadState={workspaceState}
          selectedWorkspaceId={activeWorkspaceId}
          onSelect={handleWorkspaceSelect}
          onCreate={handleCreateWorkspace}
          sessionState={sessionState}
          selectedSessionId={activeSessionId}
          onSessionSelect={setActiveSessionId}
          onCreateSession={handleCreateSession}
          creatingSession={creatingSession}
          createSessionError={createSessionError}
        />
      </div>

      {/* Collapsible support panels */}
      <div className="flex-shrink-0">
        <CollapsiblePanel
          title="Study materials"
          itemCount={mockFiles.length}
          defaultOpen={false}
        >
          <FilePanel files={mockFiles} />
        </CollapsiblePanel>
        <CollapsiblePanel
          title="Tutor memory"
          defaultOpen={false}
        >
          <MemoryPanel memory={mockLearnerMemory} />
        </CollapsiblePanel>
        <ThemePicker />
      </div>
    </div>
  );

  return (
    <AuthShell authState={authState} onSignIn={signIn}>
      <MainLayout sidebar={sidebar} activeTopicName={activeTopicName}>
        <TutorConversation
          activeSessionId={activeSessionId}
          activeWorkspaceId={activeWorkspaceId}
          workMode={workMode}
          onWorkModeChange={setWorkMode}
          costMode={costMode}
          onCostModeChange={setCostMode}
          activeTopicName={activeTopicName}
          getToken={getToken}
        />
      </MainLayout>
    </AuthShell>
  );
}
