import React from "react";
import { UploadedFile } from "../../types";

export type FileUploadStatus =
  | { state: "idle" }
  | { state: "validating" }
  | { state: "uploading" }
  | { state: "saving_metadata" }
  | { state: "done"; message: string }
  | { state: "error"; message: string };

interface FilePanelProps {
  files: UploadedFile[];
  disabled?: boolean;
  onFileSelected?: (file: File) => Promise<void>;
  uploadStatus?: FileUploadStatus;
}

export default function FilePanel({
  files,
  disabled = false,
  onFileSelected,
  uploadStatus = { state: "idle" },
}: FilePanelProps) {
  if (files.length === 0) {
    return renderPanelBody(files, disabled, onFileSelected, uploadStatus);
  }

  return renderPanelBody(files, disabled, onFileSelected, uploadStatus);
}

function renderPanelBody(
  files: UploadedFile[],
  disabled: boolean,
  onFileSelected: FilePanelProps["onFileSelected"],
  uploadStatus: FileUploadStatus
) {
  return (
    <div className="space-y-2" dir="rtl">
      <div className="space-y-1">
        <label
          className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
          style={{
            color: "var(--tutor-text-secondary)",
            background: "var(--tutor-sidebar-hover)",
            opacity: disabled || !onFileSelected ? 0.6 : 1,
          }}
        >
          <span aria-hidden="true">⬆️</span>
          <span>העלה PDF או DOCX</span>
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            disabled={disabled || !onFileSelected}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (!file || !onFileSelected) return;
              void onFileSelected(file);
            }}
          />
        </label>
        <p className="text-[11px]" style={{ color: "var(--tutor-text-muted)" }}>
          העלאה בלבד בשלב זה. חילוץ תוכן עדיין לא ממומש.
        </p>
        <p className="text-[11px]" style={{ color: statusColor(uploadStatus) }}>
          {statusText(uploadStatus)}
        </p>
      </div>
      {files.length === 0 ? (
        <p className="text-xs italic py-1" style={{ color: "var(--tutor-text-muted)" }}>
          אין חומרים עדיין
        </p>
      ) : (
        files.map((file) => (
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
        ))
      )}
    </div>
  );
}

function statusText(status: FileUploadStatus): string {
  switch (status.state) {
    case "validating":
      return "בודק תקינות קובץ...";
    case "uploading":
      return "מעלה קובץ ל-Storage...";
    case "saving_metadata":
      return "שומר מטא-דאטה...";
    case "done":
      return status.message;
    case "error":
      return status.message;
    default:
      return "מוכן להעלאה.";
  }
}

function statusColor(status: FileUploadStatus): string {
  if (status.state === "error") return "#d66a6a";
  if (status.state === "done") return "var(--tutor-accent)";
  return "var(--tutor-text-muted)";
}

function getFileIcon(sourceType: UploadedFile["sourceType"]) {
  switch (sourceType) {
    case "pdf": return "📄";
    case "docx": return "📝";
    case "note": return "🗒️";
    default: return "📎";
  }
}
