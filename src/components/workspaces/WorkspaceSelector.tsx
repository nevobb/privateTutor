"use client";

import React, { useState } from "react";
import type { WorkspaceListItem } from "../../lib/workspaces/workspaceApiTypes";
import type { SessionApiSession } from "../../lib/sessions/sessionApiTypes";

export type WorkspaceLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; workspaces: WorkspaceListItem[] };

export type SessionLoadState =
  | { status: "disabled"; message: string }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; sessions: SessionApiSession[] };

interface WorkspaceSelectorProps {
  loadState: WorkspaceLoadState;
  selectedWorkspaceId: string | null;
  onSelect: (workspaceId: string) => void;
  onCreate: (name: string) => Promise<void>;
  sessionState: SessionLoadState;
  selectedSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onCreateSession: () => Promise<void>;
  creatingSession: boolean;
  createSessionError: string | null;
}

export default function WorkspaceSelector({
  loadState,
  selectedWorkspaceId,
  onSelect,
  onCreate,
  sessionState,
  selectedSessionId,
  onSessionSelect,
  onCreateSession,
  creatingSession,
  createSessionError,
}: WorkspaceSelectorProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [createWorkspaceError, setCreateWorkspaceError] = useState<string | null>(null);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreatingWorkspace(true);
    setCreateWorkspaceError(null);
    try {
      await onCreate(trimmed);
      setNewName("");
      setShowCreate(false);
    } catch (err: unknown) {
      setCreateWorkspaceError(err instanceof Error ? err.message : "יצירה נכשלה.");
    } finally {
      setCreatingWorkspace(false);
    }
  };

  return (
    <div className="flex items-center gap-5" dir="rtl">
      <span className="font-semibold font-serif text-xl text-[#041632]">משכן מחקר</span>

      {loadState.status === "loading" && (
        <span className="text-sm text-[#75777e]">טוען מרחבים...</span>
      )}

      {loadState.status === "error" && (
        <span className="text-sm text-red-600">{loadState.message}</span>
      )}

      {loadState.status === "ready" && (
        <>
          {loadState.workspaces.length === 0 ? (
            <span className="text-sm text-[#75777e]">אין מרחבים</span>
          ) : (
            <select
              className="border border-[#c5c6ce] bg-transparent rounded px-3 py-1.5 text-sm outline-none focus:border-[#506354]"
              value={selectedWorkspaceId ?? ""}
              onChange={(e) => onSelect(e.target.value)}
              aria-label="בחירת מרחב"
            >
              {loadState.workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          )}

          {!showCreate && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="text-sm text-[#506354] hover:underline"
            >
              + מרחב חדש
            </button>
          )}

          {showCreate && (
            <form
              onSubmit={handleCreateWorkspace}
              className="flex items-center space-x-2 space-x-reverse"
            >
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="שם המרחב"
                className="border border-[#c5c6ce] rounded px-2 py-1 text-sm outline-none focus:border-[#506354]"
                autoFocus
                disabled={creatingWorkspace}
              />
              <button
                type="submit"
                disabled={creatingWorkspace || !newName.trim()}
                className="text-sm bg-[#041632] text-white px-3 py-1 rounded disabled:opacity-50"
              >
                {creatingWorkspace ? "יוצר..." : "צור"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                  setCreateWorkspaceError(null);
                }}
                className="text-sm text-[#75777e] hover:underline"
              >
                ביטול
              </button>
              {createWorkspaceError && (
                <span className="text-xs text-red-600">{createWorkspaceError}</span>
              )}
            </form>
          )}

          <div className="h-6 w-px bg-[#d8dbe5]" aria-hidden="true" />

          <div className="flex items-center gap-2">
            {sessionState.status === "disabled" && (
              <span className="text-sm text-[#75777e]">{sessionState.message}</span>
            )}

            {sessionState.status === "loading" && (
              <span className="text-sm text-[#75777e]">טוען שיחות...</span>
            )}

            {sessionState.status === "error" && (
              <span className="text-sm text-red-600">{sessionState.message}</span>
            )}

            {sessionState.status === "ready" && (
              <>
                {sessionState.sessions.length === 0 ? (
                  <span className="text-sm text-[#75777e]">אין שיחות פעילות</span>
                ) : (
                  <select
                    className="border border-[#c5c6ce] bg-transparent rounded px-3 py-1.5 text-sm outline-none focus:border-[#506354]"
                    value={selectedSessionId ?? ""}
                    onChange={(e) => onSessionSelect(e.target.value)}
                    aria-label="בחירת שיחה"
                  >
                    {sessionState.sessions.map((session, index) => (
                      <option key={session.id} value={session.id}>
                        {session.title?.trim() || `שיחה ${index + 1}`}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => {
                    void onCreateSession();
                  }}
                  disabled={creatingSession}
                  className="text-sm text-[#506354] hover:underline disabled:opacity-50"
                >
                  {creatingSession ? "יוצר שיחה..." : "+ שיחה חדשה"}
                </button>
              </>
            )}
          </div>

          {createSessionError && (
            <span className="text-xs text-red-600">{createSessionError}</span>
          )}
        </>
      )}
    </div>
  );
}
