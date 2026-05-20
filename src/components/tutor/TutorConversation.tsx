"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageContent } from "../chat/MessageContent";
import { TutorMessage, WorkMode, CostMode } from "../../types";
import WorkModeSelector from "../workModes/WorkModeSelector";
import CostModeSelector from "../costModes/CostModeSelector";
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

const SCOPE_MODE_LABELS: Record<WorkMode, string> = {
  Learning: "Learn",
  Practice: "Practice",
  Research: "Research",
  Build: "Build",
  "Temporary Chat": "Temp Chat",
};

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
}: TutorConversationProps) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [decisionLogState, setDecisionLogState] = useState<
    | { status: "disabled"; message: string }
    | { status: "loading" }
    | { status: "ready"; entries: DecisionLogListItem[] }
    | { status: "empty"; message: string }
    | { status: "error"; message: string }
  >({ status: "disabled", message: "Select a workspace and session to view diagnostics." });
  const [decisionLogRefreshKey, setDecisionLogRefreshKey] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, activeWorkspaceId, getToken]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!developerDiagnosticsEnabled) {
        if (!cancelled) {
          setDecisionLogState({
            status: "disabled",
            message: "Developer diagnostics are turned off.",
          });
        }
        return;
      }

      if (!activeWorkspaceId || !activeSessionId) {
        if (!cancelled) {
          setDecisionLogState({
            status: "disabled",
            message: "Select a workspace and session to load diagnostics.",
          });
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

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, activeWorkspaceId, decisionLogRefreshKey, developerDiagnosticsEnabled, getToken]);

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
        inputRef.current.style.height = "52px";
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
        if (developerDiagnosticsEnabled) {
          setDecisionLogRefreshKey((prev) => prev + 1);
        }
      } catch (error) {
        console.error(error);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
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
      workMode,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (shouldSubmitOnKeyDown(e.key, e.shiftKey)) {
      e.preventDefault();
      void handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const scopeModeLabel = SCOPE_MODE_LABELS[workMode];
  const scopeTopicLabel = activeTopicName ?? "No topic";

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--tutor-bg)" }}
      dir="ltr"
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-6 py-2.5 flex-shrink-0"
        style={{
          borderBottom: "1px solid var(--tutor-border-subtle)",
          background: "var(--tutor-surface)",
        }}
      >
        <WorkModeSelector currentMode={workMode} onChange={onWorkModeChange} />
        <CostModeSelector currentMode={costMode} onChange={onCostModeChange} />
      </div>

      {/* Context strip */}
      <div
        className="px-6 py-2.5 flex-shrink-0 flex items-center gap-2 text-xs"
        style={{
          color: "var(--tutor-text-secondary)",
          background: "var(--tutor-surface-raised)",
          borderBottom: "1px solid var(--tutor-border)",
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
          Context
        </span>
        <span>
          Topic: <bdi>{scopeTopicLabel}</bdi> · Mode: {scopeModeLabel} · Sources: not connected yet
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            placeholder={activeSessionId ? "Type a message..." : "Create or select a conversation first..."}
            className="flex-1 resize-none rounded-2xl px-5 py-3.5 text-sm outline-none transition-all"
            style={{
              background: "var(--tutor-surface)",
              border: "1px solid var(--tutor-border)",
              color: "var(--tutor-text)",
              boxShadow: "var(--tutor-shadow-sm)",
              minHeight: "52px",
              maxHeight: "140px",
            }}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={isTyping || !activeSessionId}
            dir="auto"
            data-testid="message-textarea"
          />
        </form>
      </div>
    </div>
  );
}

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

export function shouldSubmitOnKeyDown(key: string, shiftKey: boolean): boolean {
  return key === "Enter" && !shiftKey;
}

function MessageBubble({ msg }: { msg: TutorMessage }) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
        style={
          isUser
            ? {
                background: "var(--tutor-user-bubble)",
                border: "1px solid var(--tutor-user-border)",
                color: "var(--tutor-text)",
                borderBottomRightRadius: "4px",
              }
            : {
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

        {msg.citations && msg.citations.length > 0 && (
          <div
            className="mt-3 pt-2.5 space-y-1"
            style={{ borderTop: "1px solid var(--tutor-border-subtle)" }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--tutor-text-muted)" }}
              dir="rtl"
            >
              מקורות
            </p>
            {msg.citations.map((cite) => (
              <div
                key={cite.id}
                className="text-[11px] px-2.5 py-1.5 rounded-lg"
                style={{
                  background: "var(--tutor-border-subtle)",
                  color: "var(--tutor-text-secondary)",
                }}
                dir="rtl"
              >
                &ldquo;{cite.referenceText}&rdquo;
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
