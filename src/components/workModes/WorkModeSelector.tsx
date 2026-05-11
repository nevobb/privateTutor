import React from "react";
import { WorkMode } from "../../types";

interface WorkModeSelectorProps {
  currentMode: WorkMode;
  onChange: (mode: WorkMode) => void;
}

const modeLabels: Record<WorkMode, string> = {
  "Learning": "למידה",
  "Practice": "תרגול",
  "Research": "מחקר",
  "Build": "בנייה",
  "Temporary Chat": "צ'אט זמני"
};

const modes: WorkMode[] = ["Learning", "Practice", "Research", "Build", "Temporary Chat"];

export default function WorkModeSelector({ currentMode, onChange }: WorkModeSelectorProps) {
  return (
    <div className="flex border-b border-[#c5c6ce] mb-6 overflow-x-auto hide-scrollbar">
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            currentMode === mode
              ? "border-[#506354] text-[#041632]"
              : "border-transparent text-[#75777e] hover:text-[#44474d] hover:border-[#c5c6ce]"
          }`}
        >
          {modeLabels[mode]}
        </button>
      ))}
    </div>
  );
}
