"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageContent } from "../chat/MessageContent";
import { TutorMessage, WorkMode, CostMode } from "../../types";
import CollapsiblePanel from "../layout/CollapsiblePanel";
import {
  fetchSessionMessages,
  sendSessionMessage,
  SessionMessagesApiError,
} from "../../lib/sessions/sessionMessagesApiClient";
import {
  fetchDecisionLogEntries,
  DecisionLogApiError,
} from "../../lib/diagnostics/decisionLogApiClient";
import type { DecisionLogListItem } from "../../lib/diagnostics/decisionLogApiTypes";
import type { SourceCitation } from "../../types";

const WORK_MODES: WorkMode[] = ["Learning", "Practice", "Research", "Build", "Temporary Chat"];
const COST_MODES: CostMode[] = ["Normal Learning", "Cheap Practice", "Deep Research"];

const SCOPE_MODE_LABELS: Record<WorkMode, string> = {
  Learning: "Learn",
  Practice: "Practice",
  Research: "Research",
  Build: "Build",
  "Temporary Chat": "Temp",
};

const TIMEOUT_RECOVERY_ATTEMPTS = 4;
const TIMEOUT_RECOVERY_INTERVAL_MS = 2000;

interface TutorConversationProps {
  activeSessionId: string | null;
  activeWorkspaceId: string | null;
  developerDiagnosticsEnabled: boolean;
  workMode: WorkMode;
  onWorkModeChange: (mode: WorkMode) => void;
  costMode: CostMode;
  onCostModeChange: (mode: CostMode) => void;
  activeTopicName?: string | null;
  getToken: () => Promise<string | null>;
  uploadedFileCount?: number;
  onFileSelected?: (file: File) => Promise<void>;
}

export function formatSourcesLabel(count: number | undefined): string {
  if (count === undefined || count === 0) return "No files uploaded";
  if (count === 1) return "1 file available";
  return `${count} files available`;
}

export default function TutorConversation({
  activeSessionId,
  activeWorkspaceId,
  developerDiagnosticsEnabled,
  workMode,
  onWorkModeChange,
  costMode,
  onCostModeChange,
  activeTopicName,
  getToken,
  uploadedFileCount,
  onFileSelected,
}: TutorConversationProps) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [decisionLogState, setDecisionLogState] = useState<
    | { status: "disabled"; message: string }
    | { status: "loading" }
    | { status: "ready"; entries: DecisionLogListItem[] }
    | { status: "empty"; message: string }
    | { status: "error"; message: string }
  >({ status: "disabled", message: "Select a workspace and session to view diagnostics." });
  const [decisionLogRefreshKey, setDecisionLogRefreshKey] = useState(0);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [workModeMenuOpen, setWorkModeMenuOpen] = useState(false);
  const [costModeMenuOpen, setCostModeMenuOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const plusMenuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!activeSessionId || !activeWorkspaceId) {
        if (!cancelled) {
          setMessages([]);
          setLoadingMessages(false);
        }
        return;
      }
      if (!cancelled) setLoadingMessages(true);
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const loaded = await fetchSessionMessages(token, activeWorkspaceId, activeSessionId);
        if (!cancelled) setMessages(loaded);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeSessionId, activeWorkspaceId, getToken]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!developerDiagnosticsEnabled) {
        if (!cancelled) {
          setDecisionLogState({ status: "disabled", message: "Developer diagnostics are turned off." });
        }
        return;
      }
      if (!activeWorkspaceId || !activeSessionId) {
        if (!cancelled) {
          setDecisionLogState({ status: "disabled", message: "Select a workspace and session to load diagnostics." });
        }
        return;
      }
      if (!cancelled) setDecisionLogState({ status: "loading" });
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const entries = await fetchDecisionLogEntries(token, {
          workspaceId: activeWorkspaceId,
          sessionId: activeSessionId,
          limit: 20,
        });
        if (cancelled) return;
        if (entries.length === 0) {
          setDecisionLogState({ status: "empty", message: "No diagnostic events yet for this session." });
          return;
        }
        setDecisionLogState({ status: "ready", entries });
      } catch (error: unknown) {
        if (cancelled) return;
        const message =
          error instanceof DecisionLogApiError ? error.message : "Could not load diagnostics right now.";
        setDecisionLogState({ status: "error", message });
      }
    })();
    return () => { cancelled = true; };
  }, [activeSessionId, activeWorkspaceId, decisionLogRefreshKey, developerDiagnosticsEnabled, getToken]);

  // Close plus menu on outside click or Escape.
  // Uses contains() check — reliable inside <form> where stopPropagation is not.
  useEffect(() => {
    if (!plusMenuOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        plusMenuContainerRef.current &&
        !plusMenuContainerRef.current.contains(e.target as Node)
      ) {
        setPlusMenuOpen(false);
        setWorkModeMenuOpen(false);
        setCostModeMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPlusMenuOpen(false);
        setWorkModeMenuOpen(false);
        setCostModeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [plusMenuOpen]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed || !activeSessionId || !activeWorkspaceId || isTyping) return;

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMsg: TutorMessage = { id: optimisticId, role: "user", content: trimmed };

      setMessages((prev) => [...prev, optimisticMsg]);
      setInputValue("");
      if (inputRef.current) {
        inputRef.current.style.height = "60px";
      }
      setIsTyping(true);

      try {
        const token = await getToken();
        if (!token) throw new SessionMessagesApiError("Unauthorized.", 401);

        const result = await sendSessionMessage(token, {
          workspaceId: activeWorkspaceId,
          sessionId: activeSessionId,
          userMessage: trimmed,
          workMode,
          costMode,
        });

        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticId),
          result.userMessage,
          result.assistantMessage,
        ]);
        setComposerNotice(null);
        if (developerDiagnosticsEnabled) {
          setDecisionLogRefreshKey((prev) => prev + 1);
        }
      } catch (error: unknown) {
        console.error(error);
        if (isTimeoutError(error)) {
          setComposerNotice("המורה עדיין מעבד את התשובה...");
          const recovered = await recoverAfterTimeout({
            getToken,
            activeWorkspaceId,
            activeSessionId,
            baselineMessageIds: new Set(messages.map((message) => message.id)),
          });
          if (recovered) {
            setMessages(recovered.messages);
            setComposerNotice(null);
            if (developerDiagnosticsEnabled) {
              setDecisionLogRefreshKey((prev) => prev + 1);
            }
          } else {
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            setComposerNotice("שירות ההודעות לא הגיב בזמן. נסה שוב.");
          }
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          setComposerNotice("שליחת ההודעה נכשלה. נסה שוב.");
        }
      } finally {
        setIsTyping(false);
      }
    },
    [
      activeSessionId,
      activeWorkspaceId,
      costMode,
      developerDiagnosticsEnabled,
      getToken,
      inputValue,
      isTyping,
      messages,
      workMode,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (shouldSubmitOnKeyDown(e.key, e.shiftKey)) {
      e.preventDefault();
      void handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const scopeTopicLabel = activeTopicName ?? "No topic";

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--tutor-bg)" }}
      dir="ltr"
    >
      {/* Slim context strip */}
      <div
        className="px-6 py-2 flex-shrink-0 flex items-center gap-2 text-xs"
        style={{
          color: "var(--tutor-text-secondary)",
          background: "var(--tutor-surface)",
          borderBottom: "1px solid var(--tutor-border-subtle)",
        }}
        dir="ltr"
      >
        <span
          className="px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
          style={{
            fontSize: "10px",
            background: "var(--tutor-border-subtle)",
            color: "var(--tutor-text-muted)",
            letterSpacing: "0.04em",
          }}
        >
          {SCOPE_MODE_LABELS[workMode]}
        </span>
        <span className="truncate">
          <bdi>{scopeTopicLabel}</bdi>
        </span>
        <span style={{ color: "var(--tutor-border)" }} aria-hidden="true">·</span>
        <span className="flex-shrink-0">{formatSourcesLabel(uploadedFileCount)}</span>
      </div>

      {/* No-session notice */}
      {!activeSessionId && (
        <div
          className="mx-auto mt-4 px-4 py-2.5 rounded-full text-xs"
          style={{
            background: "var(--tutor-border-subtle)",
            color: "var(--tutor-text-muted)",
          }}
          dir="rtl"
        >
          אין שיחה פעילה — צור שיחה חדשה בסרגל הצד
        </div>
      )}

      {/* Messages loading indicator */}
      {loadingMessages && (
        <div
          className="mx-auto mt-4 px-4 py-2.5 rounded-full text-xs"
          style={{
            background: "var(--tutor-border-subtle)",
            color: "var(--tutor-text-muted)",
          }}
          dir="rtl"
        >
          טוען שיחה...
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div
              className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm"
              style={{
                background: "var(--tutor-surface)",
                border: "1px solid var(--tutor-border-subtle)",
                maxWidth: "200px",
              }}
            >
              <TypingDot delay={0} />
              <TypingDot delay={160} />
              <TypingDot delay={320} />
            </div>
          </div>
        )}

        {!isTyping && composerNotice && (
          <div className="flex justify-start">
            <div
              className="px-4 py-2.5 rounded-2xl rounded-tl-sm text-xs"
              style={{
                background: "var(--tutor-surface)",
                border: "1px solid var(--tutor-border-subtle)",
                color: "var(--tutor-text-muted)",
              }}
              dir="rtl"
            >
              {composerNotice}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Diagnostics panel */}
      {developerDiagnosticsEnabled && (
        <div className="px-6 pb-3 flex-shrink-0" dir="ltr">
          <div
            className="rounded-xl overflow-hidden"
            style={{
              border: "1px solid var(--tutor-border-subtle)",
              background: "var(--tutor-surface-raised)",
            }}
          >
            <CollapsiblePanel title="Diagnostics" defaultOpen={false}>
              <DecisionLogPanelBody state={decisionLogState} />
            </CollapsiblePanel>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div
        className="px-6 pb-5 pt-3 flex-shrink-0"
        style={{ borderTop: "1px solid var(--tutor-border-subtle)" }}
      >
        <form onSubmit={handleSubmit} className="flex items-end gap-2.5">
          {/* Plus button + menu */}
          <div ref={plusMenuContainerRef} className="relative flex-shrink-0">
            <button
              type="button"
              data-testid="plus-menu-button"
              aria-label="More options"
              aria-expanded={plusMenuOpen}
              aria-haspopup="true"
              disabled={!activeSessionId}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setPlusMenuOpen(!plusMenuOpen)}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
              style={{
                background: plusMenuOpen ? "var(--tutor-accent)" : "var(--tutor-border-subtle)",
                color: plusMenuOpen ? "#FFFFFF" : "var(--tutor-text-muted)",
                border: "1px solid var(--tutor-border)",
              }}
            >
              <PlusIcon />
            </button>
            {plusMenuOpen && (
              <PlusMenu
                workMode={workMode}
                onWorkModeChange={(mode) => {
                  onWorkModeChange(mode);
                  setWorkModeMenuOpen(false);
                  setPlusMenuOpen(false);
                }}
                costMode={costMode}
                onCostModeChange={(mode) => {
                  onCostModeChange(mode);
                  setCostModeMenuOpen(false);
                  setPlusMenuOpen(false);
                }}
                workModeMenuOpen={workModeMenuOpen}
                setWorkModeMenuOpen={setWorkModeMenuOpen}
                costModeMenuOpen={costModeMenuOpen}
                setCostModeMenuOpen={setCostModeMenuOpen}
                onUploadFile={onFileSelected}
                onMenuClose={() => setPlusMenuOpen(false)}
              />
            )}
          </div>

          {/* Textarea */}
          <textarea
            ref={inputRef}
            rows={1}
            placeholder={activeSessionId ? "Type a message..." : "Create or select a conversation first..."}
            className="flex-1 resize-none rounded-2xl px-5 py-3.5 outline-none transition-all"
            style={{
              background: "var(--tutor-surface)",
              border: "1px solid var(--tutor-border)",
              color: "var(--tutor-text)",
              boxShadow: "var(--tutor-shadow-sm)",
              fontSize: "var(--tutor-chat-font-size)",
              minHeight: "60px",
              maxHeight: "160px",
            }}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={isTyping || !activeSessionId}
            dir="auto"
            data-testid="message-textarea"
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={isTyping || !inputValue.trim() || !activeSessionId}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 flex-shrink-0"
            style={{
              background:
                inputValue.trim() && activeSessionId
                  ? "var(--tutor-accent)"
                  : "var(--tutor-border)",
              color: "#FFFFFF",
            }}
            aria-label="Send"
            data-testid="send-button"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Icons ── */

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

/* ── PlusMenu ── */

export interface PlusMenuProps {
  workMode: WorkMode;
  onWorkModeChange: (mode: WorkMode) => void;
  costMode: CostMode;
  onCostModeChange: (mode: CostMode) => void;
  workModeMenuOpen: boolean;
  setWorkModeMenuOpen: (open: boolean) => void;
  costModeMenuOpen: boolean;
  setCostModeMenuOpen: (open: boolean) => void;
  onUploadFile?: (file: File) => Promise<void>;
  onMenuClose?: () => void;
}

export function PlusMenu({
  workMode,
  onWorkModeChange,
  costMode,
  onCostModeChange,
  workModeMenuOpen,
  setWorkModeMenuOpen,
  costModeMenuOpen,
  setCostModeMenuOpen,
  onUploadFile,
  onMenuClose,
}: PlusMenuProps) {
  return (
    <div
      role="menu"
      aria-label="Composer options"
      data-testid="plus-menu"
      className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-xl overflow-hidden"
      style={{
        background: "var(--tutor-surface)",
        border: "1px solid var(--tutor-border-subtle)",
        boxShadow: "var(--tutor-shadow)",
      }}
    >
      {/* Upload file */}
      <label
        data-testid="plus-upload-file"
        className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer transition-colors"
        style={{
          color: onUploadFile ? "var(--tutor-text)" : "var(--tutor-text-muted)",
          opacity: onUploadFile ? 1 : 0.45,
          cursor: onUploadFile ? "pointer" : "not-allowed",
        }}
        onMouseEnter={(e) => {
          if (onUploadFile) (e.currentTarget as HTMLLabelElement).style.background = "var(--tutor-border-subtle)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLLabelElement).style.background = "transparent";
        }}
      >
        <UploadFileIcon />
        <span>Upload file</span>
        <input
          type="file"
          className="hidden"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={!onUploadFile}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.currentTarget.value = "";
            if (!file || !onUploadFile) return;
            void onUploadFile(file);
            onMenuClose?.();
          }}
          data-testid="plus-upload-file-input"
        />
      </label>

      {/* Upload image — future */}
      <div
        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm opacity-40 cursor-not-allowed"
        style={{ color: "var(--tutor-text-muted)" }}
      >
        <div className="flex items-center gap-3">
          <UploadImageIcon />
          <span>Upload image</span>
        </div>
        <span
          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: "var(--tutor-border-subtle)", color: "var(--tutor-text-muted)" }}
        >
          Soon
        </span>
      </div>

      <div style={{ borderTop: "1px solid var(--tutor-border-subtle)", margin: "2px 0" }} />

      {/* Work Mode */}
      <div>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setWorkModeMenuOpen(!workModeMenuOpen);
            setCostModeMenuOpen(false);
          }}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors"
          style={{ color: "var(--tutor-text)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--tutor-border-subtle)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <div className="flex items-center gap-3">
            <WorkModeIcon />
            <span>Mode: <strong>{workMode}</strong></span>
          </div>
          <ChevronIcon open={workModeMenuOpen} />
        </button>
        {workModeMenuOpen && (
          <div className="pb-1">
            {WORK_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onWorkModeChange(mode)}
                className="w-full text-left px-10 py-1.5 text-xs transition-colors"
                style={{
                  color: mode === workMode ? "var(--tutor-accent)" : "var(--tutor-text-secondary)",
                  fontWeight: mode === workMode ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--tutor-border-subtle)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cost Mode */}
      <div>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setCostModeMenuOpen(!costModeMenuOpen);
            setWorkModeMenuOpen(false);
          }}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors"
          style={{ color: "var(--tutor-text)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--tutor-border-subtle)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <div className="flex items-center gap-3">
            <CostModeIcon />
            <span>Cost: <strong>{costMode.split(" ")[0]}</strong></span>
          </div>
          <ChevronIcon open={costModeMenuOpen} />
        </button>
        {costModeMenuOpen && (
          <div className="pb-1">
            {COST_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onCostModeChange(mode)}
                className="w-full text-left px-10 py-1.5 text-xs transition-colors"
                style={{
                  color: mode === costMode ? "var(--tutor-accent)" : "var(--tutor-text-secondary)",
                  fontWeight: mode === costMode ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--tutor-border-subtle)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── PlusMenu icons ── */

function UploadFileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 1v8M4 4l3-3 3 3" />
      <path d="M2 10v2h10v-2" />
    </svg>
  );
}

function UploadImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" />
      <circle cx="5" cy="5.5" r="1" />
      <path d="M1.5 9.5l2.5-2.5 2 2 2-2.5 3 3.5" />
    </svg>
  );
}

function WorkModeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="7" r="5" />
      <path d="M7 4v3l2 1.5" />
    </svg>
  );
}

function CostModeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 1v2M7 11v2M1 7h2M11 7h2" />
      <circle cx="7" cy="7" r="3" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
    >
      <path d="M2 4l4 4 4-4" />
    </svg>
  );
}

/* ── MessageBubble ── */

function MessageBubble({ msg }: { msg: TutorMessage }) {
  const isUser = msg.role === "user";
  const normalizedSources = normalizeCitations(msg.citations);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="rounded-2xl px-4 py-3 leading-relaxed"
        style={
          isUser
            ? {
                maxWidth: "var(--tutor-chat-max-width)",
                fontSize: "var(--tutor-chat-font-size)",
                background: "var(--tutor-user-bubble)",
                border: "1px solid var(--tutor-user-border)",
                color: "var(--tutor-text)",
                borderBottomRightRadius: "4px",
              }
            : {
                maxWidth: "var(--tutor-chat-max-width)",
                fontSize: "var(--tutor-chat-font-size)",
                background: "var(--tutor-surface)",
                border: "1px solid var(--tutor-border-subtle)",
                color: "var(--tutor-text)",
                borderBottomLeftRadius: "4px",
                boxShadow: "var(--tutor-shadow-sm)",
              }
        }
      >
        <MessageContent
          content={msg.content}
          dir={isUser ? "auto" : "rtl"}
          lang={isUser ? undefined : "he"}
          style={{ fontFamily: isUser ? undefined : "'Lora', Georgia, serif" }}
        />

        {normalizedSources.length > 0 && (
          <div
            className="mt-3 pt-2.5 space-y-1"
            style={{ borderTop: "1px solid var(--tutor-border-subtle)" }}
          >
            <SourcesSection citations={normalizedSources} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sources ── */

interface NormalizedCitation extends SourceCitation {
  renderKey: string;
  sourceLabel: string;
}

export function SourcesSection({ citations }: { citations: NormalizedCitation[] }) {
  return (
    <details className="group">
      <summary
        className="cursor-pointer select-none text-[10px] font-semibold tracking-wide"
        style={{ color: "var(--tutor-text-muted)" }}
        dir="ltr"
      >
        Sources ({citations.length})
      </summary>
      <div className="mt-2 space-y-1.5">
        {citations.map((cite) => (
          <div
            key={cite.renderKey}
            className="text-[11px] px-2.5 py-1.5 rounded-lg space-y-0.5"
            style={{
              background: "var(--tutor-border-subtle)",
              color: "var(--tutor-text-secondary)",
            }}
            dir="auto"
          >
            <div className="text-[10px]" style={{ color: "var(--tutor-text-muted)" }} dir="ltr">
              {cite.sourceLabel}
            </div>
            <div
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              &ldquo;{cite.referenceText}&rdquo;
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

export function normalizeCitations(citations: SourceCitation[] | undefined): NormalizedCitation[] {
  if (!citations || citations.length === 0) return [];

  const deduped = new Map<string, SourceCitation>();
  for (const cite of citations) {
    const dedupeKey = `${cite.sourceId}::${cite.referenceText}`;
    if (!deduped.has(dedupeKey)) {
      deduped.set(dedupeKey, cite);
    }
  }

  return Array.from(deduped.values()).map((cite, index) => {
    const sourceLabel = formatSourceLabel(cite, index);
    return {
      ...cite,
      sourceLabel,
      renderKey: `${cite.sourceId || "unknown-source"}:${cite.id || "unknown-id"}:${index}`,
    };
  });
}

function formatSourceLabel(citation: SourceCitation, index: number): string {
  if (citation.originalFileName) return citation.originalFileName;
  return `Source ${index + 1}`;
}

/* ── DecisionLog ── */

export function DecisionLogPanelBody({
  state,
}: {
  state:
    | { status: "disabled"; message: string }
    | { status: "loading" }
    | { status: "ready"; entries: DecisionLogListItem[] }
    | { status: "empty"; message: string }
    | { status: "error"; message: string };
}) {
  if (state.status === "loading") {
    return <p className="text-xs" style={{ color: "var(--tutor-text-muted)" }}>Loading diagnostic events...</p>;
  }

  if (state.status === "disabled" || state.status === "empty" || state.status === "error") {
    return <p className="text-xs" style={{ color: "var(--tutor-text-muted)" }}>{state.message}</p>;
  }

  return (
    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
      {state.entries.map((entry) => (
        <div
          key={entry.id}
          className="rounded-lg px-2.5 py-2 text-[11px]"
          style={{
            background: "var(--tutor-surface)",
            border: "1px solid var(--tutor-border-subtle)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span style={{ color: "var(--tutor-text-secondary)" }}>
              {formatDecisionTypeLabel(entry.decisionType)}
            </span>
            <span style={{ color: "var(--tutor-text-muted)" }}>
              {formatDiagnosticsTimestamp(entry.createdAt)}
            </span>
          </div>
          <p className="mt-1" style={{ color: "var(--tutor-text)" }}>{entry.title}</p>
          <p
            className="mt-1"
            style={{
              color: "var(--tutor-text-secondary)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {entry.decision}
          </p>
        </div>
      ))}
    </div>
  );
}

function formatDecisionTypeLabel(decisionType: string): string {
  if (decisionType === "model_provider") return "Model";
  if (decisionType === "memory_not_written") return "Memory";
  return decisionType;
}

function formatDiagnosticsTimestamp(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/* ── Misc exports ── */

export function shouldSubmitOnKeyDown(key: string, shiftKey: boolean): boolean {
  return key === "Enter" && !shiftKey;
}

function TypingDot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full animate-bounce"
      style={{
        background: "var(--tutor-text-muted)",
        animationDelay: `${delay}ms`,
      }}
    />
  );
}

async function recoverAfterTimeout(input: {
  getToken: () => Promise<string | null>;
  activeWorkspaceId: string;
  activeSessionId: string;
  baselineMessageIds: Set<string>;
}): Promise<{ messages: TutorMessage[] } | null> {
  for (let attempt = 0; attempt < TIMEOUT_RECOVERY_ATTEMPTS; attempt += 1) {
    await wait(TIMEOUT_RECOVERY_INTERVAL_MS);
    const token = await input.getToken();
    if (!token) return null;
    try {
      const loaded = await fetchSessionMessages(token, input.activeWorkspaceId, input.activeSessionId);
      if (hasNewAssistantMessage(loaded, input.baselineMessageIds)) {
        return { messages: loaded };
      }
    } catch {
      // ignore temporary poll errors
    }
  }
  return null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hasNewAssistantMessage(messages: TutorMessage[], baselineMessageIds: Set<string>): boolean {
  return messages.some((message) => message.role === "tutor" && !baselineMessageIds.has(message.id));
}

export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof SessionMessagesApiError &&
    error.status === 503 &&
    error.message.includes("לא הגיב בזמן")
  );
}
