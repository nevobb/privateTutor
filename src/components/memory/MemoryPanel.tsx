import React from "react";
import { LearnerMemory } from "../../types";

interface MemoryPanelProps {
  memory: LearnerMemory;
}

export default function MemoryPanel({ memory }: MemoryPanelProps) {
  return (
    <div className="space-y-3" dir="rtl">
      {/* Mastery bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium" style={{ color: "var(--tutor-text-muted)" }}>
            שליטה
          </span>
          <span className="text-[10px]" style={{ color: "var(--tutor-accent)" }}>
            {memory.masteryLevel}%
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "var(--tutor-border)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${memory.masteryLevel}%`,
              background: "var(--tutor-accent)",
            }}
          />
        </div>
      </div>

      {/* Observations */}
      {memory.observations.length > 0 && (
        <ul className="space-y-1.5">
          {memory.observations.slice(0, 4).map((obs) => (
            <li
              key={obs.id}
              className="text-[11px] px-2.5 py-2 rounded-lg leading-relaxed"
              style={{
                background: "var(--tutor-sidebar-hover)",
                color: "var(--tutor-text-secondary)",
              }}
            >
              {obs.observation}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
