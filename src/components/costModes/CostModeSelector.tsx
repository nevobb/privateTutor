"use client";

import React, { useState, useRef, useEffect } from "react";
import { CostMode } from "../../types";

interface CostModeSelectorProps {
  currentMode: CostMode;
  onChange: (mode: CostMode) => void;
}

const modeLabels: Record<CostMode, string> = {
  "Normal Learning": "Normal",
  "Cheap Practice": "Cheap",
  "Deep Research": "Deep",
};

/* Only "Normal Learning" is the visible default; others behind advanced */
const advancedModes: CostMode[] = ["Cheap Practice", "Deep Research"];

export default function CostModeSelector({ currentMode, onChange }: CostModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isAdvanced = advancedModes.includes(currentMode);

  return (
    <div ref={ref} className="relative" dir="ltr">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
        style={{
          background: isAdvanced ? "var(--tutor-accent-light)" : "var(--tutor-border-subtle)",
          color: isAdvanced ? "var(--tutor-accent-text)" : "var(--tutor-text-muted)",
          border: `1px solid ${isAdvanced ? "var(--tutor-accent)" : "var(--tutor-border)"}`,
        }}
        title="Response quality"
        aria-label="Select response quality"
        aria-expanded={open}
      >
        <span style={{ fontSize: "11px" }}>⚙</span>
        <span>{modeLabels[currentMode]}</span>
        <span style={{ fontSize: "9px", opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 rounded-xl py-1 z-50 min-w-[130px]"
          style={{
            background: "var(--tutor-surface)",
            border: "1px solid var(--tutor-border)",
            boxShadow: "var(--tutor-shadow)",
            left: 0,
          }}
        >
          {(["Normal Learning", "Cheap Practice", "Deep Research"] as CostMode[]).map((mode) => {
            const isActive = currentMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  onChange(mode);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs transition-colors"
                style={{
                  background: isActive ? "var(--tutor-accent-light)" : "transparent",
                  color: isActive ? "var(--tutor-accent-text)" : "var(--tutor-text-secondary)",
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {modeLabels[mode]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
