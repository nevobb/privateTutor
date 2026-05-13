"use client";

import React, { useState, useRef, useEffect } from "react";
import { WorkMode } from "../../types";

interface WorkModeSelectorProps {
  currentMode: WorkMode;
  onChange: (mode: WorkMode) => void;
}

const modeLabels: Record<WorkMode, string> = {
  Learning: "למידה",
  Practice: "תרגול",
  Research: "מחקר",
  Build: "בנייה",
  "Temporary Chat": "צ'אט זמני",
};

/* Primary modes shown as pill buttons */
const primaryModes: WorkMode[] = ["Learning", "Practice"];
/* Advanced modes hidden under "More" */
const advancedModes: WorkMode[] = ["Research", "Build", "Temporary Chat"];

export default function WorkModeSelector({ currentMode, onChange }: WorkModeSelectorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAdvanced(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isAdvancedActive = advancedModes.includes(currentMode);

  return (
    <div className="flex items-center gap-1" dir="rtl">
      {primaryModes.map((mode) => {
        const isActive = currentMode === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: isActive ? "var(--tutor-accent)" : "var(--tutor-border-subtle)",
              color: isActive ? "#FFFFFF" : "var(--tutor-text-secondary)",
              border: isActive
                ? "1px solid var(--tutor-accent)"
                : "1px solid var(--tutor-border)",
            }}
          >
            {modeLabels[mode]}
          </button>
        );
      })}

      {/* Advanced dropdown trigger */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="px-2.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1"
          style={{
            background: isAdvancedActive
              ? "var(--tutor-accent-light)"
              : "var(--tutor-border-subtle)",
            color: isAdvancedActive ? "var(--tutor-accent-text)" : "var(--tutor-text-muted)",
            border: isAdvancedActive
              ? "1px solid var(--tutor-accent)"
              : "1px solid var(--tutor-border)",
          }}
          title="מצבים נוספים"
          aria-label="מצבים נוספים"
          aria-expanded={showAdvanced}
        >
          {isAdvancedActive ? modeLabels[currentMode] : "עוד"}
          <span style={{ fontSize: "9px", opacity: 0.7 }}>▾</span>
        </button>

        {showAdvanced && (
          <div
            className="absolute top-full mt-1 rounded-xl py-1 z-50 min-w-[100px]"
            style={{
              background: "var(--tutor-surface)",
              border: "1px solid var(--tutor-border)",
              boxShadow: "var(--tutor-shadow)",
              right: 0,
            }}
          >
            {advancedModes.map((mode) => {
              const isActive = currentMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => {
                    onChange(mode);
                    setShowAdvanced(false);
                  }}
                  className="w-full text-right px-3 py-2 text-xs transition-colors"
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
    </div>
  );
}
