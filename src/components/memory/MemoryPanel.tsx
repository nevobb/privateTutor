import React, { useMemo, useState } from "react";
import type { LearnerMemoryObservationItem } from "../../lib/memory/learnerMemoryApiTypes";

interface MemoryPanelProps {
  observations: LearnerMemoryObservationItem[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string, content: string) => Promise<void>;
  loading?: boolean;
}

export default function MemoryPanel({
  observations,
  onApprove,
  onReject,
  onDelete,
  onEdit,
  loading = false,
}: MemoryPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const masteryLevel = useMemo(() => {
    if (observations.length === 0) return 0;
    const active = observations.filter((item) => item.state === "active").length;
    return Math.round((active / observations.length) * 100);
  }, [observations]);

  return (
    <div className="space-y-3" dir="rtl">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium" style={{ color: "var(--tutor-text-muted)" }}>
            שליטה
          </span>
          <span className="text-[10px]" style={{ color: "var(--tutor-accent)" }}>
            {masteryLevel}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--tutor-border)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${masteryLevel}%`, background: "var(--tutor-accent)" }} />
        </div>
      </div>

      {loading && <div className="text-[11px]" style={{ color: "var(--tutor-text-muted)" }}>טוען זיכרון...</div>}

      {!loading && observations.length === 0 && (
        <div className="text-[11px]" style={{ color: "var(--tutor-text-muted)" }}>
          אין עדיין תצפיות זיכרון.
        </div>
      )}

      {observations.length > 0 && (
        <ul className="space-y-2">
          {observations.slice(0, 8).map((obs) => (
            <li key={obs.id} className="text-[11px] px-2.5 py-2 rounded-lg" style={{ background: "var(--tutor-sidebar-hover)" }}>
              {editingId === obs.id ? (
                <div className="space-y-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full rounded border px-2 py-1 text-[11px]"
                    rows={2}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      className="px-2 py-1 rounded border text-[10px]"
                      onClick={async () => {
                        await onEdit(obs.id, draft);
                        setEditingId(null);
                      }}
                    >
                      שמור
                    </button>
                    <button type="button" className="px-2 py-1 rounded border text-[10px]" onClick={() => setEditingId(null)}>
                      ביטול
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="leading-relaxed" style={{ color: "var(--tutor-text-secondary)" }}>{obs.content}</div>
                  <div className="mt-2 flex items-center justify-between text-[10px]" style={{ color: "var(--tutor-text-muted)" }}>
                    <span>{obs.type ?? "unknown"} · {obs.state}</span>
                    <span>{Math.round(obs.confidence * 100)}%</span>
                  </div>
                  <div className="mt-2 flex gap-2 justify-end">
                    {obs.requiresApproval && (
                      <>
                        <button type="button" className="px-2 py-1 rounded border text-[10px]" onClick={() => onApprove(obs.id)}>אשר</button>
                        <button type="button" className="px-2 py-1 rounded border text-[10px]" onClick={() => onReject(obs.id)}>דחה</button>
                      </>
                    )}
                    <button
                      type="button"
                      className="px-2 py-1 rounded border text-[10px]"
                      onClick={() => {
                        setEditingId(obs.id);
                        setDraft(obs.content);
                      }}
                    >
                      ערוך
                    </button>
                    <button type="button" className="px-2 py-1 rounded border text-[10px]" onClick={() => onDelete(obs.id)}>מחק</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
