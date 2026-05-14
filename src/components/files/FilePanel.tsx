import React from "react";
import { UploadedFile } from "../../types";

interface FilePanelProps {
  files: UploadedFile[];
}

export default function FilePanel({ files }: FilePanelProps) {
  if (files.length === 0) {
    return (
      <p className="text-xs italic py-1" style={{ color: "var(--tutor-text-muted)" }}>
        אין חומרים עדיין
      </p>
    );
  }

  return (
    <div className="space-y-1" dir="rtl">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs"
          style={{ color: "var(--tutor-text-secondary)" }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLDivElement).style.background =
              "var(--tutor-sidebar-hover)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLDivElement).style.background = "transparent")
          }
        >
          <span style={{ fontSize: "12px" }} aria-hidden="true">
            {getFileIcon(file.sourceType)}
          </span>
          <span className="truncate flex-1">{file.name}</span>
          <span style={{ color: "var(--tutor-text-muted)", flexShrink: 0 }}>
            {file.uploadedAt.toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
          </span>
        </div>
      ))}
    </div>
  );
}

function getFileIcon(sourceType: UploadedFile["sourceType"]) {
  switch (sourceType) {
    case "pdf": return "📄";
    case "docx": return "📝";
    case "note": return "🗒️";
    default: return "📎";
  }
}
