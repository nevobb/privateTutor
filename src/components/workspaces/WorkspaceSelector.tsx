"use client";

import React, { useRef, useState, useEffect } from "react";
import type { WorkspaceListItem } from "../../lib/workspaces/workspaceApiTypes";
import type { SessionApiSession } from "../../lib/sessions/sessionApiTypes";
import { ActionMenu, ActionMenuItem, IconButton } from "../ui/TutorUI";

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
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const openMenuRef = useRef<HTMLDivElement | null>(null);

  // Close conversation menu on outside click — uses contains() for reliability
  useEffect(() => {
    if (!openMenuSessionId) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (openMenuRef.current && !openMenuRef.current.contains(e.target as Node)) {
        setOpenMenuSessionId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuSessionId(null);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuSessionId]);

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

  const hasMenuActions = Boolean(onRenameSession || onDeleteSession);

  return (
    <div className="flex flex-col py-2" dir="ltr">
      {/* ── Courses ── */}
      <p className="section-nav-label" data-testid="courses-section-label">Courses</p>

      {loadState.status === "loading" && (
        <p className="nav-state-text">Loading...</p>
      )}
      {loadState.status === "error" && (
        <p className="nav-state-text" style={{ color: "#e87070" }}>{loadState.message}</p>
      )}

      {loadState.status === "ready" && (
        <>
          {loadState.workspaces.length === 0 ? (
            <p className="nav-state-text nav-state-empty">No courses yet</p>
          ) : (
            <ul className="space-y-2 px-3">
              {loadState.workspaces.map((ws) => {
                const isSelected = selectedWorkspaceId === ws.id;
                return (
                  <li key={ws.id}>
                    <CourseNavItem
                      label={ws.name}
                      active={isSelected}
                      onClick={() => onSelect(ws.id)}
                    />

                    {/* ── Sessions nested under selected course ── */}
                    {isSelected && (
                      <div
                        data-testid="sessions-under-course"
                        className="mt-2 mb-3 rounded-[18px] px-1 py-2"
                        style={{
                          marginLeft: "16px",
                          borderLeft: "1px solid rgba(255,255,255,0.08)",
                          paddingLeft: "12px",
                          background: "rgba(255,255,255,0.03)",
                        }}
                      >
                        {sessionState.status === "loading" && (
                          <p className="nav-state-text py-1">Loading...</p>
                        )}
                        {sessionState.status === "error" && (
                          <p className="nav-state-text py-1" style={{ color: "#e87070" }}>
                            {sessionState.message}
                          </p>
                        )}
                        {sessionState.status === "disabled" && (
                          <p className="nav-state-text nav-state-empty py-1">
                            {sessionState.message}
                          </p>
                        )}

                        {sessionState.status === "ready" && (
                          <>
                            {sessionState.sessions.length === 0 ? (
                              <p className="nav-state-text nav-state-empty py-1">No conversations</p>
                            ) : (
                              <ul className="space-y-1.5">
                                {sessionState.sessions.map((session, index) => {
                                  const isActive = selectedSessionId === session.id;
                                  const label =
                                    session.title?.trim() || `Conversation ${index + 1}`;
                                  const isRenaming = renamingSessionId === session.id;
                                  const isConfirmingDelete = confirmDeleteSessionId === session.id;
                                  const isMenuOpen = openMenuSessionId === session.id;

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
                                              setRenameError(
                                                err instanceof Error ? err.message : "Rename failed."
                                              );
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
                                            <p className="text-[10px]" style={{ color: "#e87070" }}>
                                              {renameError}
                                            </p>
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
                                              onClick={() => {
                                                setRenamingSessionId(null);
                                                setRenameError(null);
                                              }}
                                              className="flex-1 rounded py-1 text-[10px]"
                                              style={{
                                                border: "1px solid var(--tutor-sidebar-border)",
                                                color: "var(--tutor-sidebar-text)",
                                              }}
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </form>
                                      </li>
                                    );
                                  }

                                  if (isConfirmingDelete) {
                                    return (
                                      <li key={session.id} className="px-1 py-1 space-y-1">
                                        <p
                                          className="text-[10px] truncate"
                                          style={{ color: "var(--tutor-sidebar-text)" }}
                                        >
                                          מחק &ldquo;{label}&rdquo;?
                                        </p>
                                        {deleteError && (
                                          <p className="text-[10px]" style={{ color: "#e87070" }}>
                                            {deleteError}
                                          </p>
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
                                                setDeleteError(
                                                  err instanceof Error
                                                    ? err.message
                                                    : "Delete failed."
                                                );
                                              }
                                            }}
                                            className="flex-1 rounded py-1 text-[10px] font-medium text-white"
                                            style={{ background: "#c0392b" }}
                                          >
                                            מחק
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setConfirmDeleteSessionId(null);
                                              setDeleteError(null);
                                            }}
                                            className="flex-1 rounded py-1 text-[10px]"
                                            style={{
                                              border: "1px solid var(--tutor-sidebar-border)",
                                              color: "var(--tutor-sidebar-text)",
                                            }}
                                          >
                                            ביטול
                                          </button>
                                        </div>
                                      </li>
                                    );
                                  }

                                  return (
                                    <li key={session.id} className="group relative flex items-center gap-1.5">
                                      <SessionNavItem
                                        label={label}
                                        active={isActive}
                                        onClick={() => onSessionSelect(session.id)}
                                      />
                                      {hasMenuActions && (
                                        <div
                                          ref={isMenuOpen ? openMenuRef : undefined}
                                          className="flex-shrink-0 relative"
                                        >
                                          <IconButton
                                            label={`Conversation options: ${label}`}
                                            testId="conversation-menu-trigger"
                                            active={isMenuOpen}
                                            size={28}
                                            hasPopup={true}
                                            expanded={isMenuOpen}
                                            onClick={() =>
                                              setOpenMenuSessionId(isMenuOpen ? null : session.id)
                                            }
                                            className={`transition-opacity ${
                                              isMenuOpen
                                                ? "opacity-100"
                                                : "opacity-0 group-hover:opacity-100"
                                            }`}
                                          >
                                            <ThreeDots />
                                          </IconButton>
                                          {isMenuOpen && (
                                            <ConversationMenu
                                              label={label}
                                              onRename={
                                                onRenameSession
                                                  ? () => {
                                                      setOpenMenuSessionId(null);
                                                      setRenamingSessionId(session.id);
                                                      setRenameValue(label);
                                                      setRenameError(null);
                                                    }
                                                  : undefined
                                              }
                                              onDelete={
                                                onDeleteSession
                                                  ? () => {
                                                      setOpenMenuSessionId(null);
                                                      setConfirmDeleteSessionId(session.id);
                                                      setDeleteError(null);
                                                    }
                                                  : undefined
                                              }
                                            />
                                          )}
                                        </div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}

                            <div className="mt-1.5">
                              <NewAction
                                label={creatingSession ? "Creating..." : "+ New conversation"}
                                disabled={creatingSession}
                                onClick={() => {
                                  void onCreateSession();
                                }}
                              />
                            </div>

                            {createSessionError && (
                              <p className="px-1 text-xs" style={{ color: "#e87070" }}>
                                {createSessionError}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-3 mt-1">
            {!showCreate ? (
              <NewAction label="+ New course" onClick={() => setShowCreate(true)} />
            ) : (
              <form onSubmit={handleCreate} className="px-1 py-2 space-y-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Course name"
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
                    onClick={() => {
                      setShowCreate(false);
                      setNewName("");
                      setCreateError(null);
                    }}
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
    </div>
  );
}

/* ── Icons ── */

function FolderIcon() {
  return (
    <svg
      width="13"
      height="11"
      viewBox="0 0 13 11"
      fill="currentColor"
      aria-hidden="true"
      data-testid="folder-icon"
    >
      <path d="M1 2.5C1 1.67 1.67 1 2.5 1h2.7l1.3 1.5H10.5C11.33 2.5 12 3.17 12 4v5c0 .83-.67 1.5-1.5 1.5h-9C.67 10.5 1 9.83 1 9V2.5z" />
    </svg>
  );
}

function ThreeDots() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="6" r="1.2" />
      <circle cx="6" cy="6" r="1.2" />
      <circle cx="10" cy="6" r="1.2" />
    </svg>
  );
}

/* ── ConversationMenu ── */

interface ConversationMenuProps {
  label: string;
  onRename?: () => void;
  onDelete?: () => void;
}

export function ConversationMenu({ onRename, onDelete }: ConversationMenuProps) {
  return (
    <ActionMenu align="right" width={160}>
      <div aria-label="Conversation options" data-testid="conversation-menu">
        {onRename ? (
          <ActionMenuItem icon={<RenameIcon />} onClick={onRename}>
            Rename
          </ActionMenuItem>
        ) : null}
        {onDelete ? (
          <ActionMenuItem icon={<DeleteIcon />} onClick={onDelete} destructive>
            Delete
          </ActionMenuItem>
        ) : null}
      </div>
    </ActionMenu>
  );
}

function RenameIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.5 1.5l2 2-6 6H1.5v-2l6-6z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 3h8M4 3V2h3v1M2.5 3l.5 6.5h5l.5-6.5" />
    </svg>
  );
}

/* ── CourseNavItem ── */

function CourseNavItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="course-nav-item"
      className="w-full text-left flex items-center gap-3 rounded-[18px] transition-colors"
      style={{
        padding: "13px 14px",
        fontSize: "13px",
        background: active ? "rgba(255,255,255,0.07)" : "transparent",
        color: active ? "var(--tutor-sidebar-text-active)" : "var(--tutor-sidebar-text)",
        fontWeight: active ? 600 : 400,
        border: active ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
        letterSpacing: active ? "-0.01em" : undefined,
        boxShadow: active ? "var(--tutor-shadow-sm)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <span
        className="flex-shrink-0"
        style={{
          color: active ? "var(--tutor-sidebar-text-active)" : "var(--tutor-sidebar-text-muted)",
        }}
      >
        <FolderIcon />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

/* ── SessionNavItem ── */

function SessionNavItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center rounded-[16px] transition-colors"
      style={{
        padding: "10px 12px",
        fontSize: "12px",
        background: active ? "rgba(255,255,255,0.09)" : "transparent",
        color: active ? "var(--tutor-sidebar-text-active)" : "var(--tutor-sidebar-text)",
        fontWeight: active ? 500 : 400,
        border: active ? "1px solid rgba(255,255,255,0.05)" : "1px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
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

/* ── NewAction ── */

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
      className="w-full text-left flex items-center gap-1 px-3.5 py-2.5 rounded-[16px] text-xs transition-colors disabled:opacity-40"
      style={{
        color: "var(--tutor-sidebar-text-muted)",
        border: "1px dashed rgba(255,255,255,0.08)",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--tutor-sidebar-text-active)";
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "var(--tutor-sidebar-text-muted)";
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      {label}
    </button>
  );
}
