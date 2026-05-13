"use client";

import React, { useState, ReactNode } from "react";

interface CollapsiblePanelProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  itemCount?: number;
}

export default function CollapsiblePanel({
  title,
  children,
  defaultOpen = false,
  itemCount,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderTop: "1px solid var(--tutor-border-subtle)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium transition-colors hover:bg-[var(--tutor-sidebar-hover)]"
        style={{ color: "var(--tutor-text-secondary)" }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="transition-transform duration-200"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", display: "inline-block" }}
          >
            ▾
          </span>
          {title}
          {itemCount !== undefined && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--tutor-border)", color: "var(--tutor-text-muted)" }}
            >
              {itemCount}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}
