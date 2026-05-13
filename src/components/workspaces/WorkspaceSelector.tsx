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
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
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
      setShowCreateWorkspace(false);
    } catch (err: unknown) {
      setCreateWorkspaceError(err instanceof Error ? err.message : "יצירה נכשלה.");
    } finally {
      setCreatingWorkspace(false);
    }
  };

  return (
    <div className="flex flex-col py-2" dir="rtl">
      {/* Section: Topics / Workspaces */}
      <div className="px-4 pt-1 pb-1.5">
        <p
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--tutor-text-muted)" }}
        >
          נושאים
        </p>
      </div>

      {loadState.status === "loading" && (
        <p className="px-4 py-2 text-xs" style={{ color: "var(--tutor-text-muted)" }}>
          טוען...
        </p>
      )}

      {loadState.status === "error" && (
        <p className="px-4 py-2 text-xs" style={{ color: "#C0392B" }}>
          {loadState.message}
        </p>
      )}

      {loadState.status === "ready" && (
        <>
          {loadState.workspaces.length === 0 ? (
            <p className="px-4 py-2 text-xs italic" style={{ color: "var(--tutor-text-muted)" }}>
              אין נושאים עדיין
            </p>
          ) : (
            <ul className="space-y-0.5 px-2">
              {loadState.workspaces.map((ws) => {
                const isSelected = selectedWorkspaceId === ws.id;
                return (
                  <li key={ws.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(ws.id)}
                      className="w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{
                        background: isSelected
                          ? "var(--tutor-sidebar-active)"
                          : "transparent",
                        color: isSelected ? "var(--tutor-accent-text)" : "var(--tutor-text)",
                        fontWeight: isSelected ? 500 : 400,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "var(--tutor-sidebar-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "transparent";
                      }}
                    >
                      <span
                        className="text-base leading-none flex-shrink-0"
                        aria-hidden="true"
                      >
                        {isSelected ? "📂" : "📁"}
                      </span>
                      <span className="truncate">{ws.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-2 mt-1">
            {!showCreateWorkspace ? (
              <button
                type="button"
                onClick={() => setShowCreateWorkspace(true)}
                className="w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
                style={{ color: "var(--tutor-text-muted)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color =
                    "var(--tutor-accent)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color =
                    "var(--tutor-text-muted)")
                }
              >
                <span>＋</span>
                <span>נושא חדש</span>
              </button>
            ) : (
              <form
                onSubmit={handleCreateWorkspace}
                className="px-1 py-2 space-y-2"
              >
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="שם הנושא"
                  className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
                  style={{
                    border: "1px solid var(--tutor-border)",
                    background: "var(--tutor-surface)",
                    color: "var(--tutor-text)",
                  }}
                  autoFocus
                  disabled={creatingWorkspace}
                  dir="rtl"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creatingWorkspace || !newName.trim()}
                    className="flex-1 rounded-lg py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40"
                    style={{ background: "var(--tutor-accent)" }}
                  >
                    {creatingWorkspace ? "יוצר..." : "צור"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateWorkspace(false);
                      setNewName("");
                      setCreateWorkspaceError(null);
                    }}
                    className="flex-1 rounded-lg py-1.5 text-xs transition-colors"
                    style={{
                      border: "1px solid var(--tutor-border)",
                      color: "var(--tutor-text-secondary)",
                    }}
                  >
                    ביטול
                  </button>
                </div>
                {createWorkspaceError && (
                  <p className="text-xs" style={{ color: "#C0392B" }}>
                    {createWorkspaceError}
                  </p>
                )}
              </form>
            )}
          </div>
        </>
      )}

      {/* Section: Conversations / Sessions */}
      {selectedWorkspaceId && (
        <>
          <div className="px-4 pt-4 pb-1.5">
            <p
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--tutor-text-muted)" }}
            >
              שיחות
            </p>
          </div>

          {sessionState.status === "disabled" && (
            <p className="px-4 py-2 text-xs italic" style={{ color: "var(--tutor-text-muted)" }}>
              {sessionState.message}
            </p>
          )}

          {sessionState.status === "loading" && (
            <p className="px-4 py-2 text-xs" style={{ color: "var(--tutor-text-muted)" }}>
              טוען שיחות...
            </p>
          )}

          {sessionState.status === "error" && (
            <p className="px-4 py-2 text-xs" style={{ color: "#C0392B" }}>
              {sessionState.message}
            </p>
          )}

          {sessionState.status === "ready" && (
            <>
              {sessionState.sessions.length === 0 ? (
                <p className="px-4 py-2 text-xs italic" style={{ color: "var(--tutor-text-muted)" }}>
                  אין שיחות פעילות
                </p>
              ) : (
                <ul className="space-y-0.5 px-2">
                  {sessionState.sessions.map((session, index) => {
                    const isActive = selectedSessionId === session.id;
                    const label = session.title?.trim() || `שיחה ${index + 1}`;
                    return (
                      <li key={session.id}>
                        <button
                          type="button"
                          onClick={() => onSessionSelect(session.id)}
                          className="w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                          style={{
                            background: isActive
                              ? "var(--tutor-accent-light)"
                              : "transparent",
                            color: isActive ? "var(--tutor-accent-text)" : "var(--tutor-text-secondary)",
                            fontWeight: isActive ? 500 : 400,
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive)
                              (e.currentTarget as HTMLButtonElement).style.background =
                                "var(--tutor-sidebar-hover)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive)
                              (e.currentTarget as HTMLButtonElement).style.background =
                                "transparent";
                          }}
                        >
                          <span className="text-sm leading-none flex-shrink-0" aria-hidden="true">
                            💬
                          </span>
                          <span className="truncate text-xs">{label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="px-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    void onCreateSession();
                  }}
                  disabled={creatingSession}
                  className="w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors disabled:opacity-40"
                  style={{ color: "var(--tutor-text-muted)" }}
                  onMouseEnter={(e) => {
                    if (!creatingSession)
                      (e.currentTarget as HTMLButtonElement).style.color =
                        "var(--tutor-accent)";
                  }}
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color =
                      "var(--tutor-text-muted)")
                  }
                >
                  <span>＋</span>
                  <span>{creatingSession ? "יוצר שיחה..." : "שיחה חדשה"}</span>
                </button>
              </div>

              {createSessionError && (
                <p className="px-4 text-xs" style={{ color: "#C0392B" }}>
                  {createSessionError}
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
