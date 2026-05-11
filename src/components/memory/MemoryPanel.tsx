import React from "react";
import { LearnerMemory } from "../../types";

interface MemoryPanelProps {
  memory: LearnerMemory;
}

export default function MemoryPanel({ memory }: MemoryPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-serif font-bold text-[#041632] mb-4">סטטוס למידה</h2>
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-2">רמת שליטה (Mastery)</h3>
        <div className="w-full bg-[#c5c6ce] rounded-full h-2">
          <div
            className="bg-[#506354] h-2 rounded-full"
            style={{ width: `${memory.masteryLevel}%` }}
          />
        </div>
        <p className="text-xs mt-1 text-left" dir="ltr">{memory.masteryLevel}%</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">תובנות אחרונות</h3>
        <ul className="space-y-3">
          {memory.observations.map((obs) => (
            <li key={obs.id} className="text-sm bg-white p-3 rounded border border-[#e5eeff] text-[#44474d] shadow-sm">
              {obs.observation}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
