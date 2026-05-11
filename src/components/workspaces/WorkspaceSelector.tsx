import React from "react";
import { Workspace } from "../../types";

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  selectedWorkspaceId: string;
}

export default function WorkspaceSelector({ workspaces, selectedWorkspaceId }: WorkspaceSelectorProps) {
  return (
    <div className="flex items-center space-x-4 space-x-reverse">
      <span className="font-semibold font-serif text-xl text-[#041632]">משכן מחקר</span>
      <select
        className="border border-[#c5c6ce] bg-transparent rounded px-3 py-1.5 text-sm outline-none focus:border-[#506354]"
        value={selectedWorkspaceId}
        disabled
      >
        {workspaces.map((ws) => (
          <option key={ws.id} value={ws.id}>{ws.name}</option>
        ))}
      </select>
    </div>
  );
}
