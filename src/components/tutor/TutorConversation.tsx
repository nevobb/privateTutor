"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageContent } from "../chat/MessageContent";
import { TutorMessage, WorkMode, CostMode, UploadedFile } from "../../types";
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
import {
  ActionMenu,
  ActionMenuItem,
  ChatStatusCard,
  IconButton,
  StatusPill,
} from "../ui/TutorUI";

const WORK_MODES: WorkMode[] = ["Learning", "Practice", "Research", "Build", "Temporary Chat"];
const COST_MODES: CostMode[] = ["Normal Learning", "Cheap Practice", "Deep Research"];

export const MAX_STAGED_ATTACHMENTS = 10;

export interface StagedAttachment {
  localId: string;
  fileId: string;
  fileName: string;
}

export function buildStagedAttachment(
  input: { fileId: string; fileName: string },
  localId?: string
): StagedAttachment {
  return {
    localId: localId ?? `staged-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fileId: input.fileId,
    fileName: input.fileName,
  };
}

export function removeStagedAttachment(
  attachments: StagedAttachment[],
  localId: string
): StagedAttachment[] {
  return attachments.filter((a) => a.localId !== localId);
}

export function canAddMoreAttachments(count: number): boolean {
  return count < MAX_STAGED_ATTACHMENTS;
}

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
  /** Externally managed staged context files selected from Study Materials. */
  stagedContextFiles?: StagedAttachment[];
  onRemoveStagedContext?: (localId: string) => void;
  onClearStagedContext?: () => void;
  files?: UploadedFile[];
  onToggleFileContext?: (fileId: string, fileName: string) => void;
}

export type ChatUploadFeedback = {
  state: "uploading" | "processing" | "error";
  fileName: string;
  errorMessage?: string;
};

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
  stagedContextFiles,
  onRemoveStagedContext,
  onClearStagedContext,
  files = [],
  onToggleFileContext,
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
  const [chatUploadFeedback, setChatUploadFeedback] = useState<ChatUploadFeedback | null>(null);
  const contextFiles = stagedContextFiles ?? [];
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const plusMenuContainerRef = useRef<HTMLDivElement>(null);
  const uploadDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

        // Use IDs of already-processed course files selected as context. No upload needed.
        const attachedFileIds = contextFiles.length > 0
          ? contextFiles.map((f) => f.fileId)
          : undefined;

        const result = await sendSessionMessage(token, {
          workspaceId: activeWorkspaceId,
          sessionId: activeSessionId,
          userMessage: trimmed,
          workMode,
          costMode,
          attachedFileIds,
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
        // Context chips are intentionally NOT cleared on any error path.
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
      contextFiles,
      costMode,
      developerDiagnosticsEnabled,
      getToken,
      inputValue,
      isTyping,
      messages,
      onClearStagedContext,
      workMode,
    ]
  );

  const handleUploadWithFeedback = useCallback(
    async (file: File) => {
      if (!onFileSelected) return;
      if (uploadDismissTimerRef.current) clearTimeout(uploadDismissTimerRef.current);
      setChatUploadFeedback({ state: "uploading", fileName: file.name });
      try {
        await onFileSelected(file);
        setChatUploadFeedback({ state: "processing", fileName: file.name });
        uploadDismissTimerRef.current = setTimeout(() => {
          setChatUploadFeedback(null);
        }, 6000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        setChatUploadFeedback({ state: "error", fileName: file.name, errorMessage: msg });
      }
    },
    [onFileSelected]
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
      <div
        className="px-8 py-4 flex-shrink-0 flex items-center gap-2 text-xs"
        style={{
          color: "var(--tutor-text-secondary)",
          background: "rgba(255,255,255,0.56)",
          borderBottom: "1px solid var(--tutor-border-subtle)",
          backdropFilter: "blur(14px)",
        }}
        dir="ltr"
      >
        <StatusPill label={SCOPE_MODE_LABELS[workMode]} tone="neutral" />
        <span className="truncate text-sm" style={{ color: "var(--tutor-text-secondary)" }}>
          <bdi>{scopeTopicLabel}</bdi>
        </span>
        <span style={{ color: "var(--tutor-border)" }} aria-hidden="true">·</span>
        <span className="flex-shrink-0 text-sm" style={{ color: "var(--tutor-text-muted)" }}>
          {formatSourcesLabel(uploadedFileCount)}
        </span>
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
      <div
        className="flex-1 overflow-y-auto px-8 py-8"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(255,255,255,0.62), transparent 22%), transparent",
        }}
      >
        <div className="mx-auto w-full max-w-[1100px] space-y-6">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {chatUploadFeedback && (
            <ChatUploadCard
              feedback={chatUploadFeedback}
              onDismiss={() => {
                if (uploadDismissTimerRef.current) clearTimeout(uploadDismissTimerRef.current);
                setChatUploadFeedback(null);
              }}
            />
          )}

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
      </div>

      {/* Diagnostics panel */}
      {developerDiagnosticsEnabled && (
        <div className="px-7 pb-3 flex-shrink-0" dir="ltr">
          <div
            className="rounded-[18px] overflow-hidden"
            style={{
              border: "1px solid var(--tutor-border-subtle)",
              background: "var(--tutor-surface-raised)",
              boxShadow: "var(--tutor-card-shadow)",
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
        className="px-8 pb-7 pt-5 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(236,228,215,0.8)" }}
      >
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-[1100px] items-end gap-3 rounded-[30px] p-3.5"
          style={{
            background: "var(--tutor-surface-tint)",
            border: "1px solid var(--tutor-border)",
            boxShadow: "var(--tutor-card-shadow)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div ref={plusMenuContainerRef} className="relative flex-shrink-0">
            <IconButton
              testId="plus-menu-button"
              label="More options"
              disabled={!activeSessionId}
              active={plusMenuOpen}
              size={46}
              onClick={() => setPlusMenuOpen(!plusMenuOpen)}
            >
              <PlusIcon />
            </IconButton>
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
                onUploadFile={onFileSelected ? handleUploadWithFeedback : undefined}
                onMenuClose={() => setPlusMenuOpen(false)}
                files={files}
                stagedContextFiles={contextFiles}
                onToggleFileContext={onToggleFileContext}
              />
            )}
          </div>

          <div
            className="flex-1 rounded-[24px] px-2"
            style={{
              background: "var(--tutor-surface)",
              border: "1px solid var(--tutor-border-subtle)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
            }}
          >
            {contextFiles.length > 0 && (
              <div
                className="flex flex-wrap items-center gap-1.5 px-3 pt-3 pb-1"
                data-testid="staged-attachments"
                dir="rtl"
              >
                {contextFiles.map((att) => (
                  <StagedAttachmentChip
                    key={att.localId}
                    fileName={att.fileName}
                    onRemove={() => onRemoveStagedContext?.(att.localId)}
                  />
                ))}
                <button
                  type="button"
                  onClick={onClearStagedContext}
                  className="px-2 py-1 rounded text-[10px] font-medium transition-colors"
                  style={{
                    background: "transparent",
                    color: "var(--tutor-text-muted)",
                    border: "1px dashed var(--tutor-border)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "#c0392b";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#c0392b";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--tutor-text-muted)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--tutor-border)";
                  }}
                >
                  נקה קונטקסט
                </button>
              </div>
            )}
            <textarea
              ref={inputRef}
              rows={1}
              placeholder={activeSessionId ? "Type a message..." : "Create or select a conversation first..."}
              className="flex-1 w-full resize-none outline-none transition-all"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--tutor-text)",
                fontSize: "var(--tutor-chat-font-size)",
                lineHeight: "1.65",
                padding: "17px 16px",
                minHeight: "66px",
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
          </div>

          <button
            type="submit"
            disabled={isTyping || !inputValue.trim() || !activeSessionId}
            className="w-12 h-12 rounded-[18px] flex items-center justify-center transition-all disabled:opacity-40 flex-shrink-0"
            style={{
              background:
                inputValue.trim() && activeSessionId
                  ? "var(--tutor-text)"
                  : "rgba(216, 207, 191, 0.85)",
              color: "#FFFFFF",
              boxShadow: inputValue.trim() && activeSessionId ? "0 16px 28px rgba(44,34,24,0.14)" : "none",
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
  files?: UploadedFile[];
  stagedContextFiles?: StagedAttachment[];
  onToggleFileContext?: (fileId: string, fileName: string) => void;
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
  files = [],
  stagedContextFiles = [],
  onToggleFileContext,
}: PlusMenuProps) {
  const [filesMenuOpen, setFilesMenuOpen] = useState(false);
  return (
    <ActionMenu
      align="left"
      width={272}
      placement="top"
    >
      <div aria-label="Composer options" data-testid="plus-menu">
      <label
        data-testid="plus-upload-file"
        className="flex items-center gap-3 px-3.5 py-3 text-sm cursor-pointer transition-colors"
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
          <span>העלה חומר לקורס</span>
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

      <ActionMenuItem
        icon={<UploadImageIcon />}
        disabled
        trailing={<StatusPill label="Soon" tone="neutral" />}
      >
        Upload image
      </ActionMenuItem>

      <div style={{ borderTop: "1px solid var(--tutor-border-subtle)", margin: "2px 0" }} />

      <div>
        <ActionMenuItem
          icon={<WorkModeIcon />}
          onClick={() => {
            setWorkModeMenuOpen(!workModeMenuOpen);
            setCostModeMenuOpen(false);
          }}
          trailing={<ChevronIcon open={workModeMenuOpen} />}
        >
          Mode: <strong>{workMode}</strong>
        </ActionMenuItem>
        {workModeMenuOpen && (
          <div className="px-2 pb-2">
            {WORK_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onWorkModeChange(mode)}
                className="w-full text-left px-9 py-2 text-xs rounded-xl transition-colors"
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

      <div>
        <ActionMenuItem
          icon={<CostModeIcon />}
          onClick={() => {
            setCostModeMenuOpen(!costModeMenuOpen);
            setWorkModeMenuOpen(false);
          }}
          trailing={<ChevronIcon open={costModeMenuOpen} />}
        >
          Cost: <strong>{costMode.split(" ")[0]}</strong>
        </ActionMenuItem>
        {costModeMenuOpen && (
          <div className="px-2 pb-2">
            {COST_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onCostModeChange(mode)}
                className="w-full text-left px-9 py-2 text-xs rounded-xl transition-colors"
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
      <div>
        <ActionMenuItem
          icon={<FolderIcon />}
          onClick={() => {
            setFilesMenuOpen(!filesMenuOpen);
            setWorkModeMenuOpen(false);
            setCostModeMenuOpen(false);
          }}
          trailing={<ChevronIcon open={filesMenuOpen} />}
        >
          בחר חומר מהקורס
        </ActionMenuItem>
        {filesMenuOpen && (
          <div className="px-2 pb-2 max-h-[200px] overflow-y-auto space-y-1" dir="rtl">
            {files.length === 0 ? (
              <div className="px-4 py-2 text-xs text-center text-muted-foreground" style={{ color: "var(--tutor-text-muted)" }}>
                אין חומרים בקורס זה
              </div>
            ) : (
              files.map((file) => {
                const isReady =
                  file.extractionStatus === "completed" &&
                  file.chunkingStatus === "completed" &&
                  file.embeddingStatus === "completed";
                const isSelected = stagedContextFiles.some((x) => x.fileId === file.id);
                const statusLabel =
                  file.extractionStatus === "failed" ||
                  file.chunkingStatus === "failed" ||
                  file.embeddingStatus === "failed"
                    ? "(נכשל)"
                    : "(בעיבוד...)";

                return (
                  <button
                    key={file.id}
                    type="button"
                    disabled={!isReady}
                    onClick={() => {
                      if (onToggleFileContext) {
                        onToggleFileContext(file.id, file.originalFileName ?? file.name);
                      }
                    }}
                    className="w-full text-right px-4 py-2 text-xs rounded-xl transition-colors flex items-center justify-between gap-2"
                    style={{
                      color: isSelected ? "var(--tutor-accent)" : "var(--tutor-text-secondary)",
                      fontWeight: isSelected ? 600 : 400,
                      opacity: isReady ? 1 : 0.5,
                      cursor: isReady ? "pointer" : "not-allowed",
                    }}
                    onMouseEnter={(e) => {
                      if (isReady) (e.currentTarget as HTMLButtonElement).style.background = "var(--tutor-border-subtle)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }}
                  >
                    <span className="truncate flex-1 text-right bdi">
                      {file.name} {!isReady && <span className="text-[10px] opacity-75">{statusLabel}</span>}
                    </span>
                    {isReady && (
                      <span className="text-[14px] flex-shrink-0">
                        {isSelected ? "✓" : "☐"}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      </div>
      </div>
    </ActionMenu>
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

function ErrorTriangleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 2l5 9H2l5-9z" />
      <path d="M7 5.1v2.8M7 10h.01" />
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
        className="rounded-[22px] px-5 py-4 leading-relaxed"
        style={
          isUser
            ? {
                maxWidth: "var(--tutor-chat-max-width)",
                fontSize: "var(--tutor-chat-font-size)",
                background: "var(--tutor-user-bubble)",
                border: "1px solid var(--tutor-user-border)",
                color: "var(--tutor-text)",
                borderBottomRightRadius: "8px",
                boxShadow: "0 10px 22px rgba(64,84,126,0.08)",
              }
            : {
                maxWidth: "var(--tutor-chat-max-width)",
                fontSize: "var(--tutor-chat-font-size)",
                background: "rgba(255,255,255,0.9)",
                border: "1px solid var(--tutor-border-subtle)",
                color: "var(--tutor-text)",
                borderBottomLeftRadius: "8px",
                boxShadow: "var(--tutor-card-shadow)",
              }
        }
      >
        <MessageContent
          content={msg.content}
          dir={isUser ? "auto" : "rtl"}
          lang={isUser ? undefined : "he"}
          style={{
            fontFamily: isUser ? undefined : "'Lora', Georgia, serif",
            lineHeight: 1.8,
          }}
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
        className="cursor-pointer select-none text-[11px] font-semibold tracking-wide"
        style={{ color: "var(--tutor-text-muted)" }}
        dir="ltr"
      >
        Sources ({citations.length})
      </summary>
      <div className="mt-2 space-y-2">
        {citations.map((cite) => (
          <div
            key={cite.renderKey}
            className="text-[11px] px-3 py-2.5 rounded-xl space-y-1"
            style={{
              background: "var(--tutor-bg-elevated)",
              border: "1px solid var(--tutor-border-subtle)",
              color: "var(--tutor-text-secondary)",
            }}
            dir="auto"
          >
            <div className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--tutor-text-muted)" }} dir="ltr">
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
  if (citation.originalFileName?.trim()) return citation.originalFileName.trim();
  return `Source ${index + 1}`;
}

/* ── ChatUploadCard ── */

export function ChatUploadCard({
  feedback,
  onDismiss,
}: {
  feedback: ChatUploadFeedback;
  onDismiss?: () => void;
}) {
  const isError = feedback.state === "error";

  return (
    <div data-testid="chat-upload-card" data-upload-state={feedback.state}>
      <div data-testid={`chat-upload-${feedback.state}`}>
        <ChatStatusCard
          icon={
            feedback.state === "uploading" ? <UploadFileIcon /> :
            feedback.state === "processing" ? <CostModeIcon /> :
            <ErrorTriangleIcon />
          }
          title={
            feedback.state === "uploading"
              ? <>מעלה את &ldquo;{feedback.fileName}&rdquo;...</>
              : feedback.state === "processing"
                ? <>מכין את הקובץ לעבודה...</>
                : <>ההעלאה נכשלה</>
          }
          description={feedback.state === "error" ? feedback.errorMessage : undefined}
          tone={isError ? "danger" : "neutral"}
          dismiss={onDismiss}
        />
      </div>
    </div>
  );
}

/* ── StagedAttachmentChip ── */

export function StagedAttachmentChip({
  fileName,
  onRemove,
}: {
  fileName: string;
  onRemove?: () => void;
}) {
  return (
    <div
      data-testid="staged-attachment-chip"
      className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[11px]"
      style={{
        background: "var(--tutor-user-bubble)",
        border: "1px solid var(--tutor-user-border)",
        color: "var(--tutor-text)",
        maxWidth: "180px",
      }}
    >
      <PaperclipIcon />
      <span className="truncate" title={fileName}>{fileName}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 ml-0.5 rounded-full"
          aria-label={`Remove ${fileName}`}
          data-testid="staged-attachment-remove"
          style={{ color: "var(--tutor-text-muted)" }}
        >
          <XSmallIcon />
        </button>
      )}
    </div>
  );
}

function PaperclipIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M10.5 5.5L5.5 10.5a3 3 0 01-4.24-4.24L6.76 1.76a2 2 0 012.83 2.83L4.06 10.1a1 1 0 01-1.41-1.41L7.5 3.83" />
    </svg>
  );
}

function XSmallIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <line x1="2" y1="2" x2="8" y2="8" />
      <line x1="8" y1="2" x2="2" y2="8" />
    </svg>
  );
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

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 2.5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 .7.3l1.2 1.2a1 1 0 0 0 .7.3h3.7a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1z" />
    </svg>
  );
}
