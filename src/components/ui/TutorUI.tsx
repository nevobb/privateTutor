"use client";

import type { CSSProperties, ReactNode } from "react";

export function ActionMenu({
  children,
  width = "min(240px, calc(100vw - 32px))",
  align = "right",
  placement = "bottom",
  className = "",
}: {
  children: ReactNode;
  width?: number | string;
  align?: "left" | "right";
  placement?: "bottom" | "top";
  className?: string;
}) {
  const positionStyle: CSSProperties =
    align === "left" ? { left: 0 } : { right: 0 };
  const verticalStyle: CSSProperties =
    placement === "top" ? { bottom: "100%", marginBottom: 8 } : { top: "100%", marginTop: 8 };

  return (
    <div
      role="menu"
      className={`absolute z-50 overflow-hidden ${className}`.trim()}
      style={{
        ...positionStyle,
        ...verticalStyle,
        width,
        background: "var(--tutor-surface)",
        border: "1px solid var(--tutor-border-subtle)",
        boxShadow: "var(--tutor-menu-shadow)",
        borderRadius: "var(--tutor-radius-menu)",
        backdropFilter: "blur(16px)",
      }}
    >
      {children}
    </div>
  );
}

export function ActionMenuItem({
  children,
  icon,
  onClick,
  disabled = false,
  destructive = false,
  trailing,
  role = "menuitem",
}: {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  trailing?: ReactNode;
  role?: string;
}) {
  return (
    <button
      type="button"
      role={role}
      disabled={disabled}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-left disabled:cursor-not-allowed ${disabled ? "opacity-40" : ""}`.trim()}
      style={{
        color: disabled
          ? "var(--tutor-text-muted)"
          : destructive
            ? "var(--tutor-danger)"
            : "var(--tutor-text)",
        opacity: disabled ? 0.48 : 1,
      }}
      onMouseEnter={(event) => {
        if (disabled) return;
        (event.currentTarget as HTMLButtonElement).style.background = destructive
          ? "var(--tutor-danger-soft)"
          : "var(--tutor-border-subtle)";
      }}
      onMouseLeave={(event) => {
        (event.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      {icon ? <span className="flex-shrink-0">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing ? <span className="flex-shrink-0">{trailing}</span> : null}
    </button>
  );
}

export function IconButton({
  children,
  label,
  active = false,
  disabled = false,
  size = 32,
  onClick,
  testId,
  hasPopup,
  expanded,
  className = "",
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  size?: number;
  onClick?: () => void;
  testId?: string;
  hasPopup?: true | "menu" | "dialog";
  expanded?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup={hasPopup}
      aria-expanded={expanded}
      data-testid={testId}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center ${className}`.trim()}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size / 2.4),
        border: "1px solid var(--tutor-border-subtle)",
        background: active ? "var(--tutor-accent-light)" : "rgba(255,255,255,0.72)",
        color: active ? "var(--tutor-accent-text)" : "var(--tutor-text-muted)",
        boxShadow: active ? "var(--tutor-shadow-sm)" : "none",
        opacity: disabled ? 0.42 : 1,
      }}
      onMouseEnter={(event) => {
        if (disabled || active) return;
        (event.currentTarget as HTMLButtonElement).style.background = "var(--tutor-border-subtle)";
        (event.currentTarget as HTMLButtonElement).style.color = "var(--tutor-text-secondary)";
      }}
      onMouseLeave={(event) => {
        if (active) return;
        (event.currentTarget as HTMLButtonElement).style.background = "transparent";
        (event.currentTarget as HTMLButtonElement).style.color = "var(--tutor-text-muted)";
      }}
    >
      {children}
    </button>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "accent" | "success" | "danger";
}) {
  const stylesByTone: Record<NonNullable<typeof tone>, CSSProperties> = {
    neutral: {
      background: "var(--tutor-border-subtle)",
      color: "var(--tutor-text-muted)",
    },
    accent: {
      background: "var(--tutor-accent-light)",
      color: "var(--tutor-accent-text)",
    },
    success: {
      background: "rgba(77, 126, 98, 0.12)",
      color: "#3a6a50",
    },
    danger: {
      background: "var(--tutor-danger-soft)",
      color: "var(--tutor-danger)",
    },
  };

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.05em]"
      style={stylesByTone[tone]}
    >
      {label}
    </span>
  );
}

export function ChatStatusCard({
  icon,
  title,
  description,
  tone = "neutral",
  dismiss,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tone?: "neutral" | "danger";
  dismiss?: () => void;
}) {
  const isDanger = tone === "danger";

  return (
    <div className="flex justify-start">
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-[18px]"
        style={{
          background: isDanger ? "var(--tutor-danger-soft)" : "var(--tutor-surface)",
          border: isDanger
            ? "1px solid rgba(197,98,79,0.2)"
            : "1px solid var(--tutor-border-subtle)",
          boxShadow: "var(--tutor-shadow-sm)",
          maxWidth: "var(--tutor-chat-max-width)",
          borderBottomLeftRadius: "6px",
        }}
      >
        {icon ? (
          <span
            className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
            style={{
              background: isDanger ? "rgba(197,98,79,0.12)" : "var(--tutor-bg-elevated)",
              color: isDanger ? "var(--tutor-danger)" : "var(--tutor-accent-text)",
            }}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div
            className="text-sm font-medium"
            style={{ color: isDanger ? "var(--tutor-danger)" : "var(--tutor-text-secondary)" }}
          >
            {title}
          </div>
          {description ? (
            <div className="mt-1 text-xs" style={{ color: "var(--tutor-text-muted)" }}>
              {description}
            </div>
          ) : null}
        </div>
        {dismiss ? (
          <IconButton label="Dismiss" size={26} onClick={dismiss}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </IconButton>
        ) : null}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  eyebrow,
}: {
  title: string;
  eyebrow?: string;
}) {
  return (
    <div className="mb-4 border-b pb-2.5" style={{ borderColor: "var(--tutor-border-subtle)" }}>
      {eyebrow ? (
        <p
          className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: "var(--tutor-text-muted)" }}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className="text-xl font-semibold"
        style={{ color: "var(--tutor-text)", fontFamily: "'Lora', Georgia, serif" }}
      >
        {title}
      </h2>
    </div>
  );
}
