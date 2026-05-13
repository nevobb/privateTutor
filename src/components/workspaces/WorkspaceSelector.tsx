"use client";

import React, { useState } from "react";
import type { WorkspaceListItem } from "../../lib/workspaces/workspaceApiTypes";

export type WorkspaceLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; workspaces: WorkspaceListItem[] };

interface WorkspaceSelectorProps {
  loadState: WorkspaceLoadState;
  selectedWorkspaceId: string | null;
  onSelect: (workspaceId: string) => void;
  onCreate: (name: string) => Promise<void>;
}

export default function WorkspaceSelector({
  loadState,
  selectedWorkspaceId,
  onSelect,
  onCreate,
}: WorkspaceSelectorProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);
    try {
      await onCreate(trimmed);
      setNewName("");
      setShowCreate(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "יצירה נכשלה.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex items-center space-x-4 space-x-reverse" dir="rtl">
      <span className="font-semibold font-serif text-xl text-[#041632]">משכן מחקר</span>

      {loadState.status === "loading" && (
        <span className="text-sm text-[#75777e]">טוען מרחבים...</span>
      )}

      {loadState.status === "error" && (
        <span className="text-sm text-red-600">{loadState.message}</span>
      )}

      {loadState.status === "ready" && (
        <>
          {loadState.workspaces.length === 0 ? (
            <span className="text-sm text-[#75777e]">אין מרחבים</span>
          ) : (
            <select
              className="border border-[#c5c6ce] bg-transparent rounded px-3 py-1.5 text-sm outline-none focus:border-[#506354]"
              value={selectedWorkspaceId ?? ""}
              onChange={(e) => onSelect(e.target.value)}
            >
              {loadState.workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          )}

          {!showCreate && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="text-sm text-[#506354] hover:underline"
            >
              + מרחב חדש
            </button>
          )}

          {showCreate && (
            <form
              onSubmit={handleCreate}
              className="flex items-center space-x-2 space-x-reverse"
            >
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="שם המרחב"
                className="border border-[#c5c6ce] rounded px-2 py-1 text-sm outline-none focus:border-[#506354]"
                autoFocus
                disabled={creating}
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="text-sm bg-[#041632] text-white px-3 py-1 rounded disabled:opacity-50"
              >
                {creating ? "יוצר..." : "צור"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                  setCreateError(null);
                }}
                className="text-sm text-[#75777e] hover:underline"
              >
                ביטול
              </button>
              {createError && (
                <span className="text-xs text-red-600">{createError}</span>
              )}
            </form>
          )}
        </>
      )}
    </div>
  );
}
