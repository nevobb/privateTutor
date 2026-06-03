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
    <div className="px-3 pb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium transition-colors"
        style={{
          color: "var(--tutor-sidebar-text)",
          borderRadius: "16px",
          background: open ? "rgba(255,255,255,0.06)" : "transparent",
          border: "1px solid transparent",
        }}
        onMouseEnter={(event) => {
          (event.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
          (event.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.05)";
        }}
        onMouseLeave={(event) => {
          (event.currentTarget as HTMLButtonElement).style.background = open
            ? "rgba(255,255,255,0.06)"
            : "transparent";
          (event.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
        }}
      >
        <span className="flex items-center gap-2">
          <span
            className="transition-transform duration-200"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", display: "inline-block" }}
          >
            ▾
          </span>
          {title}
          {itemCount !== undefined && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(123, 143, 212, 0.14)",
                color: "var(--tutor-sidebar-text-active)",
              }}
            >
              {itemCount}
            </span>
          )}
        </span>
      </button>
      {open && (
        <div className="px-1 pt-2 pb-1">
          {children}
        </div>
      )}
    </div>
  );
}
