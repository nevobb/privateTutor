"use client";

import React, { useCallback, useEffect, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import WorkspaceSelector, { type WorkspaceLoadState } from "../components/workspaces/WorkspaceSelector";
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
import { mockFiles, mockLearnerMemory, mockTutorMessages } from "../mock/data";

export default function Home() {
  const { authState, getToken, signIn } = useClientAuth();
  const [workspaceState, setWorkspaceState] = useState<WorkspaceLoadState>({
    status: "loading",
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

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
          err instanceof WorkspaceApiError ? err.message : "שגיאה בטעינת המרחבים.";
        setWorkspaceState({ status: "error", message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authState.status, getToken]);

  const handleCreateWorkspace = useCallback(
    async (name: string): Promise<void> => {
      const token = await getToken();
      if (!token) throw new Error("לא מאומת.");
      const workspace: WorkspaceListItem = await createWorkspace(token, { name });
      setWorkspaceState((prev) => {
        const existing = prev.status === "ready" ? prev.workspaces : [];
        return { status: "ready", workspaces: [...existing, workspace] };
      });
      setActiveWorkspaceId(workspace.id);
    },
    [getToken]
  );

  const displayName =
    authState.status === "signed-in"
      ? (authState.user?.displayName ?? authState.user?.email ?? "משתמש")
      : null;

  const avatarLetter =
    authState.status === "signed-in"
      ? (authState.user?.displayName?.[0]?.toUpperCase() ?? "N")
      : "N";

  const header = (
    <div className="flex items-center justify-between w-full">
      <WorkspaceSelector
        loadState={workspaceState}
        selectedWorkspaceId={activeWorkspaceId}
        onSelect={setActiveWorkspaceId}
        onCreate={handleCreateWorkspace}
      />
      <div className="flex items-center space-x-4 space-x-reverse">
        {displayName && (
          <span className="text-sm font-medium text-[#44474d]">{displayName}</span>
        )}
        <div className="w-8 h-8 rounded-full bg-[#dce9ff] flex items-center justify-center text-[#041632] font-bold text-sm">
          {avatarLetter}
        </div>
      </div>
    </div>
  );

  return (
    <AuthShell authState={authState} onSignIn={signIn}>
      <MainLayout
        header={header}
        rightSidebar={<FilePanel files={mockFiles} />}
        leftSidebar={<MemoryPanel memory={mockLearnerMemory} />}
      >
        <TutorConversation initialMessages={mockTutorMessages} />
      </MainLayout>
    </AuthShell>
  );
}
