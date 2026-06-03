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
  onRenameSession?: (sessionId: string, newTitle: string) => Promise<void>;
  onDeleteSession?: (sessionId: string) => Promise<void>;
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
  onRenameSession,
  onDeleteSession,
}: WorkspaceSelectorProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
                    const isRenaming = renamingSessionId === session.id;

                    if (isRenaming) {
                      return (
                        <li key={session.id}>
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const trimmed = renameValue.trim();
                              if (!trimmed || !onRenameSession) return;
                              setRenameError(null);
                              try {
                                await onRenameSession(session.id, trimmed);
                                setRenamingSessionId(null);
                              } catch (err: unknown) {
                                setRenameError(err instanceof Error ? err.message : "Rename failed.");
                              }
                            }}
                            className="px-1 py-1 space-y-1"
                          >
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              maxLength={120}
                              autoFocus
                              className="w-full rounded px-2 py-1 text-xs outline-none"
                              style={{
                                background: "var(--tutor-surface)",
                                border: "1px solid var(--tutor-border)",
                                color: "var(--tutor-text)",
                              }}
                            />
                            {renameError && (
                              <p className="text-[10px]" style={{ color: "#e87070" }}>{renameError}</p>
                            )}
                            <div className="flex gap-1">
                              <button
                                type="submit"
                                disabled={!renameValue.trim()}
                                className="flex-1 rounded py-1 text-[10px] font-medium text-white disabled:opacity-40"
                                style={{ background: "var(--tutor-accent)" }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => { setRenamingSessionId(null); setRenameError(null); }}
                                className="flex-1 rounded py-1 text-[10px]"
                                style={{ border: "1px solid var(--tutor-sidebar-border)", color: "var(--tutor-sidebar-text)" }}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </li>
                      );
                    }

                    if (confirmDeleteSessionId === session.id) {
                      return (
                        <li key={session.id} className="px-1 py-1 space-y-1">
                          <p className="text-[10px] truncate" style={{ color: "var(--tutor-sidebar-text)" }}>
                            מחק &ldquo;{label}&rdquo;?
                          </p>
                          {deleteError && (
                            <p className="text-[10px]" style={{ color: "#e87070" }}>{deleteError}</p>
                          )}
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!onDeleteSession) return;
                                setDeleteError(null);
                                try {
                                  await onDeleteSession(session.id);
                                  setConfirmDeleteSessionId(null);
                                } catch (err: unknown) {
                                  setDeleteError(err instanceof Error ? err.message : "Delete failed.");
                                }
                              }}
                              className="flex-1 rounded py-1 text-[10px] font-medium text-white"
                              style={{ background: "#c0392b" }}
                            >
                              מחק
                            </button>
                            <button
                              type="button"
                              onClick={() => { setConfirmDeleteSessionId(null); setDeleteError(null); }}
                              className="flex-1 rounded py-1 text-[10px]"
                              style={{ border: "1px solid var(--tutor-sidebar-border)", color: "var(--tutor-sidebar-text)" }}
                            >
                              ביטול
                            </button>
                          </div>
                        </li>
                      );
                    }

                    return (
                      <li key={session.id} className="group flex items-center gap-0.5">
                        <NavItem
                          label={label}
                          active={isActive}
                          small
                          onClick={() => onSessionSelect(session.id)}
                        />
                        <span className="flex-shrink-0 opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                          {onRenameSession && (
                            <button
                              type="button"
                              title="Rename conversation"
                              aria-label={`Rename conversation: ${label}`}
                              onClick={() => {
                                setRenamingSessionId(session.id);
                                setRenameValue(label);
                                setRenameError(null);
                              }}
                              className="p-1 rounded"
                              style={{ color: "var(--tutor-sidebar-text-muted)" }}
                            >
                              <span aria-hidden="true" style={{ fontSize: "10px" }}>✎</span>
                            </button>
                          )}
                          {onDeleteSession && (
                            <button
                              type="button"
                              title="Delete conversation"
                              aria-label={`Delete conversation: ${label}`}
                              onClick={() => {
                                setConfirmDeleteSessionId(session.id);
                                setDeleteError(null);
                              }}
                              className="p-1 rounded"
                              style={{ color: "var(--tutor-sidebar-text-muted)" }}
                            >
                              <span aria-hidden="true" style={{ fontSize: "10px" }}>✕</span>
                            </button>
                          )}
                        </span>
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
