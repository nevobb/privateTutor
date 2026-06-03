import React, { useState } from "react";
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
  onContinueProcessing?: (fileId: string) => Promise<void>;
  processingStatusByFileId?: Record<string, string | undefined>;
  onDeleteFile?: (fileId: string) => Promise<void>;
}

export default function FilePanel({
  files,
  disabled = false,
  onFileSelected,
  uploadStatus = { state: "idle" },
  onContinueProcessing,
  processingStatusByFileId = {},
  onDeleteFile,
}: FilePanelProps) {
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState<string | null>(null);
  const [deleteFileError, setDeleteFileError] = useState<string | null>(null);

  return renderPanelBody(
    files,
    disabled,
    onFileSelected,
    uploadStatus,
    onContinueProcessing,
    processingStatusByFileId,
    onDeleteFile,
    confirmDeleteFileId,
    setConfirmDeleteFileId,
    deleteFileError,
    setDeleteFileError
  );
}

function renderPanelBody(
  files: UploadedFile[],
  disabled: boolean,
  onFileSelected: FilePanelProps["onFileSelected"],
  uploadStatus: FileUploadStatus,
  onContinueProcessing: FilePanelProps["onContinueProcessing"],
  processingStatusByFileId: Record<string, string | undefined>,
  onDeleteFile: FilePanelProps["onDeleteFile"],
  confirmDeleteFileId: string | null,
  setConfirmDeleteFileId: (id: string | null) => void,
  deleteFileError: string | null,
  setDeleteFileError: (err: string | null) => void
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
          אחרי העלאה: חלץ טקסט, צור צ׳אנקים, ואז Embeddings.
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
        files.map((file) => {
          const extractionStatus = file.extractionStatus ?? "not_started";
          const chunkingStatus = file.chunkingStatus ?? "not_started";
          const embeddingStatus = file.embeddingStatus ?? "not_started";
          const processingStatus = processingStatusByFileId[file.id];
          const isReadyForLearning =
            extractionStatus === "completed" &&
            chunkingStatus === "completed" &&
            embeddingStatus === "completed";

          const action = getPrimaryAction({
            extractionStatus,
            chunkingStatus,
            embeddingStatus,
            processingStatus,
            isReadyForLearning,
            hasPersistedStorage: Boolean(file.storagePath),
            canContinue: !disabled && Boolean(onContinueProcessing),
          });

          return (
            <div
              key={file.id}
              className="px-2 py-2 rounded-lg transition-colors text-xs space-y-2"
              style={{ color: "var(--tutor-text-secondary)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLDivElement).style.background =
                  "var(--tutor-sidebar-hover)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLDivElement).style.background = "transparent")
              }
            >
              <div className="flex items-start gap-2 min-w-0" dir="rtl">
                <span style={{ fontSize: "12px" }} aria-hidden="true">
                  {getFileIcon(file.sourceType)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate" title={file.name}>
                    {file.name}
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px]" style={{ color: "var(--tutor-text-muted)" }}>
                    <span>
                      {file.uploadedAt.toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                    </span>
                    <span>{`E:${extractionStatus}`}</span>
                    <span>{`C:${chunkingStatus}`}</span>
                    <span>{`Emb:${embeddingStatus}`}</span>
                    {isReadyForLearning ? (
                      <span style={{ color: "var(--tutor-accent)" }}>Ready for learning</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5" dir="rtl">
                {action ? (
                  <button
                    type="button"
                    className="px-2 py-1 rounded text-[10px]"
                    style={{
                      background: "var(--tutor-sidebar-hover)",
                      color: "var(--tutor-text-secondary)",
                      opacity: action.disabled ? 0.45 : 1,
                    }}
                    disabled={action.disabled}
                    title={action.hint}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!onContinueProcessing || action.disabled) return;
                      void onContinueProcessing(file.id);
                    }}
                  >
                    {action.label}
                  </button>
                ) : null}
                {onDeleteFile && confirmDeleteFileId !== file.id && (
                  <button
                    type="button"
                    title="מחק קובץ"
                    aria-label={`מחק קובץ: ${file.name}`}
                    className="px-2 py-1 rounded text-[10px]"
                    style={{
                      background: "var(--tutor-sidebar-hover)",
                      color: "var(--tutor-text-muted)",
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setConfirmDeleteFileId(file.id);
                      setDeleteFileError(null);
                    }}
                  >
                    מחק
                  </button>
                )}
                {onDeleteFile && confirmDeleteFileId === file.id && (
                  <div className="space-y-1 w-full" dir="rtl">
                    <p className="text-[10px]" style={{ color: "var(--tutor-text-secondary)" }}>
                      למחוק את &ldquo;{file.name}&rdquo;?
                    </p>
                    {deleteFileError && (
                      <p className="text-[10px]" style={{ color: "#e87070" }}>{deleteFileError}</p>
                    )}
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="flex-1 px-2 py-1 rounded text-[10px] font-medium text-white"
                        style={{ background: "#c0392b" }}
                        onClick={async (event) => {
                          event.stopPropagation();
                          setDeleteFileError(null);
                          try {
                            await onDeleteFile(file.id);
                            setConfirmDeleteFileId(null);
                          } catch (err: unknown) {
                            setDeleteFileError(err instanceof Error ? err.message : "מחיקה נכשלה.");
                          }
                        }}
                      >
                        מחק
                      </button>
                      <button
                        type="button"
                        className="flex-1 px-2 py-1 rounded text-[10px]"
                        style={{ border: "1px solid var(--tutor-border)", color: "var(--tutor-text-muted)" }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmDeleteFileId(null);
                          setDeleteFileError(null);
                        }}
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
      {files.length > 0 ? (
        <div className="space-y-1">
          {files.map((file) =>
            processingStatusByFileId[file.id] ? (
              <p key={`${file.id}-processing`} className="text-[11px]" style={{ color: "var(--tutor-text-muted)" }}>
                {file.name}: {processingStatusByFileId[file.id]}
              </p>
            ) : null
          )}
        </div>
      ) : null}
    </div>
  );
}

function getPrimaryAction(input: {
  extractionStatus: UploadedFile["extractionStatus"];
  chunkingStatus: UploadedFile["chunkingStatus"];
  embeddingStatus: UploadedFile["embeddingStatus"];
  processingStatus: string | undefined;
  isReadyForLearning: boolean;
  hasPersistedStorage: boolean;
  canContinue: boolean;
}): { label: string; hint: string; disabled: boolean } | null {
  const {
    extractionStatus,
    chunkingStatus,
    embeddingStatus,
    processingStatus,
    isReadyForLearning,
    hasPersistedStorage,
    canContinue,
  } = input;

  if (isReadyForLearning) {
    return null;
  }

  const lowerStatus = (processingStatus ?? "").toLowerCase();
  if (
    lowerStatus.includes("extracting") ||
    lowerStatus.includes("chunking") ||
    lowerStatus.includes("embedding") ||
    extractionStatus === "pending" ||
    chunkingStatus === "pending"
  ) {
    return {
      label: "Processing...",
      hint: "File processing is currently running",
      disabled: true,
    };
  }

  if (extractionStatus !== "completed" && !hasPersistedStorage) {
    return {
      label: "Re-upload required",
      hint: "Stored file metadata is incomplete, so extraction cannot continue yet.",
      disabled: true,
    };
  }

  const failed =
    extractionStatus === "failed" ||
    chunkingStatus === "failed" ||
    embeddingStatus === "failed" ||
    lowerStatus.includes("failed") ||
    lowerStatus.includes("error");

  if (failed) {
    return {
      label: "Retry processing",
      hint: "Retry from the first incomplete processing step",
      disabled: !canContinue,
    };
  }

  if (extractionStatus === "completed" && chunkingStatus === "completed") {
    return {
      label: "Continue processing",
      hint: "Create embeddings to complete file readiness",
      disabled: !canContinue,
    };
  }

  return {
    label: "Continue processing",
    hint: "Run the next incomplete step automatically",
    disabled: !canContinue,
  };
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
