import React from "react";
import { CostMode } from "../../types";

interface CostModeSelectorProps {
  currentMode: CostMode;
  onChange: (mode: CostMode) => void;
}

const modes: CostMode[] = ["Cheap Practice", "Normal Learning", "Deep Research"];

export default function CostModeSelector({ currentMode, onChange }: CostModeSelectorProps) {
  return (
    <div className="flex space-x-2 space-x-reverse bg-[#eaf1ff] p-1 rounded-md border border-[#c5c6ce]">
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${
            currentMode === mode
              ? "bg-[#041632] text-white shadow-sm"
              : "text-[#44474d] hover:bg-[#dce9ff]"
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
