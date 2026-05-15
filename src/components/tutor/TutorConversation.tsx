"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { TutorMessage, WorkMode, CostMode } from "../../types";
import WorkModeSelector from "../workModes/WorkModeSelector";
import CostModeSelector from "../costModes/CostModeSelector";
import {
  fetchSessionMessages,
  sendSessionMessage,
  SessionMessagesApiError,
} from "../../lib/sessions/sessionMessagesApiClient";

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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed || !activeSessionId || !activeWorkspaceId || isTyping) return;

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMsg: TutorMessage = { id: optimisticId, role: "user", content: trimmed };

      setMessages((prev) => [...prev, optimisticMsg]);
      setInputValue("");
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
      } catch (error) {
        console.error(error);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } finally {
        setIsTyping(false);
      }
    },
    [activeSessionId, activeWorkspaceId, costMode, getToken, inputValue, isTyping, workMode]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
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

      {/* Input bar */}
      <div
        className="px-6 pb-5 pt-3 flex-shrink-0"
        style={{ borderTop: "1px solid var(--tutor-border-subtle)" }}
      >
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            rows={1}
            placeholder={activeSessionId ? "Type a message..." : "Create or select a conversation first..."}
            className="w-full resize-none rounded-2xl px-5 py-3.5 pr-14 text-sm outline-none transition-all"
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
          />
          <button
            type="submit"
            disabled={isTyping || !inputValue.trim() || !activeSessionId}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
            style={{
              background:
                inputValue.trim() && activeSessionId
                  ? "var(--tutor-accent)"
                  : "var(--tutor-border)",
              color: "#FFFFFF",
            }}
            aria-label="Send"
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
        </form>
      </div>
    </div>
  );
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
        <p
          className="whitespace-pre-wrap"
          dir="auto"
          lang={isUser ? undefined : "he"}
          style={{ fontFamily: isUser ? undefined : "'Lora', Georgia, serif" }}
        >
          {msg.content}
        </p>

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
