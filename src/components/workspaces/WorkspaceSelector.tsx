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
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreatingWorkspace(true);
    setCreateError(null);
    try {
      await onCreate(trimmed);
      setNewName("");
      setShowCreate(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create.");
    } finally {
      setCreatingWorkspace(false);
    }
  };

  return (
    <div className="flex flex-col py-2" dir="ltr">
      {/* ── Topics ── */}
      <p className="section-nav-label">Topics</p>

      {loadState.status === "loading" && (
        <p className="nav-state-text">Loading...</p>
      )}
      {loadState.status === "error" && (
        <p className="nav-state-text" style={{ color: "#e87070" }}>{loadState.message}</p>
      )}

      {loadState.status === "ready" && (
        <>
          {loadState.workspaces.length === 0 ? (
            <p className="nav-state-text nav-state-empty">No topics yet</p>
          ) : (
            <ul className="space-y-0.5 px-2">
              {loadState.workspaces.map((ws) => {
                const isSelected = selectedWorkspaceId === ws.id;
                return (
                  <li key={ws.id}>
                    <NavItem
                      label={ws.name}
                      active={isSelected}
                      onClick={() => onSelect(ws.id)}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-2 mt-0.5">
            {!showCreate ? (
              <NewAction label="+ New topic" onClick={() => setShowCreate(true)} />
            ) : (
              <form onSubmit={handleCreate} className="px-1 py-2 space-y-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Topic name"
                  autoFocus
                  disabled={creatingWorkspace}
                  className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
                  style={{
                    background: "var(--tutor-surface)",
                    border: "1px solid var(--tutor-border)",
                    color: "var(--tutor-text)",
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creatingWorkspace || !newName.trim()}
                    className="flex-1 rounded-lg py-1.5 text-xs font-medium text-white disabled:opacity-40"
                    style={{ background: "var(--tutor-accent)" }}
                  >
                    {creatingWorkspace ? "Creating..." : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setNewName(""); setCreateError(null); }}
                    className="flex-1 rounded-lg py-1.5 text-xs"
                    style={{
                      border: "1px solid var(--tutor-sidebar-border)",
                      color: "var(--tutor-sidebar-text)",
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {createError && (
                  <p className="text-xs" style={{ color: "#e87070" }}>{createError}</p>
                )}
              </form>
            )}
          </div>
        </>
      )}

      {/* ── Conversations ── */}
      {selectedWorkspaceId && (
        <>
          <p className="section-nav-label" style={{ marginTop: "16px" }}>Conversations</p>

          {sessionState.status === "disabled" && (
            <p className="nav-state-text nav-state-empty">{sessionState.message}</p>
          )}
          {sessionState.status === "loading" && (
            <p className="nav-state-text">Loading...</p>
          )}
          {sessionState.status === "error" && (
            <p className="nav-state-text" style={{ color: "#e87070" }}>{sessionState.message}</p>
          )}

          {sessionState.status === "ready" && (
            <>
              {sessionState.sessions.length === 0 ? (
                <p className="nav-state-text nav-state-empty">No conversations</p>
              ) : (
                <ul className="space-y-0.5 px-2">
                  {sessionState.sessions.map((session, index) => {
                    const isActive = selectedSessionId === session.id;
                    const label = session.title?.trim() || `Conversation ${index + 1}`;
                    return (
                      <li key={session.id}>
                        <NavItem
                          label={label}
                          active={isActive}
                          small
                          onClick={() => onSessionSelect(session.id)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="px-2 mt-0.5">
                <NewAction
                  label={creatingSession ? "Creating..." : "+ New conversation"}
                  disabled={creatingSession}
                  onClick={() => { void onCreateSession(); }}
                />
              </div>

              {createSessionError && (
                <p className="px-4 text-xs" style={{ color: "#e87070" }}>
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

function NavItem({
  label,
  active,
  small = false,
  onClick,
}: {
  label: string;
  active: boolean;
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center px-3 rounded-lg transition-colors"
      style={{
        padding: small ? "5px 10px" : "7px 10px",
        fontSize: small ? "12px" : "13px",
        background: active ? "var(--tutor-sidebar-active)" : "transparent",
        color: active ? "var(--tutor-sidebar-text-active)" : "var(--tutor-sidebar-text)",
        fontWeight: active ? 500 : 400,
        borderLeft: active
          ? "2px solid var(--tutor-accent)"
          : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = "var(--tutor-sidebar-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

function NewAction({
  label,
  disabled = false,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40"
      style={{ color: "var(--tutor-sidebar-text-muted)" }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.color = "var(--tutor-accent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "var(--tutor-sidebar-text-muted)";
      }}
    >
      {label}
    </button>
  );
}
