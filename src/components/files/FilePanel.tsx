import React, { useRef, useState, useEffect } from "react";
import { UploadedFile } from "../../types";
import { ActionMenu, ActionMenuItem, IconButton, StatusPill } from "../ui/TutorUI";
import { StagedAttachment } from "../tutor/TutorConversation";

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
  /** Called when the user selects a ready file to use as active chat context. */
  onUseInChat?: (fileId: string, fileName: string) => void;
  stagedContextFiles?: StagedAttachment[];
}

export default function FilePanel({
  files,
  disabled = false,
  onFileSelected,
  uploadStatus = { state: "idle" },
  onContinueProcessing,
  processingStatusByFileId = {},
  onDeleteFile,
  onUseInChat,
  stagedContextFiles = [],
}: FilePanelProps) {
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState<string | null>(null);
  const [deleteFileError, setDeleteFileError] = useState<string | null>(null);
  const [openFileMenuId, setOpenFileMenuId] = useState<string | null>(null);
  const openFileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openFileMenuId) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (openFileMenuRef.current && !openFileMenuRef.current.contains(e.target as Node)) {
        setOpenFileMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenFileMenuId(null);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openFileMenuId]);

  return (
    <div className="space-y-3" dir="rtl">
      <div
        className="space-y-2 rounded-[18px] p-3.5"
        style={{
          background: "rgba(255,255,255,0.045)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <label
          className="inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-[16px] text-xs cursor-pointer transition-colors"
          style={{
            color: "var(--tutor-sidebar-text-active)",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.06)",
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
        <p className="text-[11px] px-1" style={{ color: statusColor(uploadStatus) }}>
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

          const isConfirmingDelete = confirmDeleteFileId === file.id;
          const isMenuOpen = openFileMenuId === file.id;

          return (
            <div
              key={file.id}
              className="px-3.5 py-3.5 rounded-[18px] transition-colors text-xs space-y-2.5"
              style={{
                color: "var(--tutor-sidebar-text)",
                border: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(255,255,255,0.03)",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLDivElement).style.background =
                  "rgba(255,255,255,0.055)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)")
              }
            >
              {/* File name + status + three-dot menu */}
              <div className="flex items-start gap-2 min-w-0" dir="rtl">
                <span style={{ fontSize: "12px", color: "var(--tutor-sidebar-text-active)" }} aria-hidden="true">
                  {getFileIcon(file.sourceType)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium" style={{ color: "var(--tutor-sidebar-text-active)" }} title={file.name}>
                    {file.name}
                  </div>
                  <div className="mt-1">
                    <FileStatusLabel
                      extractionStatus={extractionStatus}
                      chunkingStatus={chunkingStatus}
                      embeddingStatus={embeddingStatus}
                      isReadyForLearning={isReadyForLearning}
                    />
                  </div>
                </div>

                {/* Three-dot menu button */}
                {onDeleteFile && (
                  <div ref={isMenuOpen ? openFileMenuRef : undefined} className="flex-shrink-0 relative" dir="ltr">
                    <IconButton
                      label={`File options: ${file.name}`}
                      testId="file-menu-trigger"
                      active={isMenuOpen}
                      size={28}
                      onClick={() => setOpenFileMenuId(isMenuOpen ? null : file.id)}
                    >
                      <FileThreeDots />
                    </IconButton>
                    {isMenuOpen && !isConfirmingDelete && (
                      <FileRowMenu
                        onDelete={() => {
                          setOpenFileMenuId(null);
                          setConfirmDeleteFileId(file.id);
                          setDeleteFileError(null);
                        }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Continue/Retry action button */}
              {action && (
                <div className="flex flex-wrap items-center gap-1.5" dir="rtl">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-full text-[10px] font-medium"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      color: "var(--tutor-sidebar-text-active)",
                      opacity: action.disabled ? 0.45 : 1,
                      border: "1px solid rgba(255,255,255,0.06)",
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
                </div>
              )}

              {/* Use in chat — only for ready files when a session is active */}
              {isReadyForLearning && onUseInChat && !isConfirmingDelete && (() => {
                const isSelected = stagedContextFiles?.some((x) => x.fileId === file.id);
                return (
                  <div dir="rtl">
                    <button
                      type="button"
                      data-testid="use-in-chat-button"
                      className="px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors"
                      style={{
                        background: isSelected ? "rgba(46,125,50,0.15)" : "rgba(123,143,212,0.15)",
                        color: isSelected ? "#2e7d32" : "var(--tutor-accent)",
                        border: isSelected ? "1px solid rgba(46,125,50,0.2)" : "1px solid rgba(123,143,212,0.2)",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUseInChat(file.id, file.originalFileName ?? file.name);
                      }}
                    >
                      {isSelected ? "✓ נבחר לשיחה" : "בחר חומר מהקורס"}
                    </button>
                  </div>
                );
              })()}

              {/* Delete confirmation */}
              {isConfirmingDelete && (
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
                          await onDeleteFile!(file.id);
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

/* ── FileStatusLabel ── */

interface FileStatusLabelProps {
  extractionStatus: UploadedFile["extractionStatus"];
  chunkingStatus: UploadedFile["chunkingStatus"];
  embeddingStatus: UploadedFile["embeddingStatus"];
  isReadyForLearning: boolean;
}

export function FileStatusLabel({
  extractionStatus,
  chunkingStatus,
  embeddingStatus,
  isReadyForLearning,
}: FileStatusLabelProps) {
  if (isReadyForLearning) {
    return <span data-testid="file-status-ready"><StatusPill label="✓ Ready" tone="accent" /></span>;
  }

  const hasFailed =
    extractionStatus === "failed" ||
    chunkingStatus === "failed" ||
    embeddingStatus === "failed";

  if (hasFailed) {
    return <span data-testid="file-status-failed"><StatusPill label="Failed" tone="danger" /></span>;
  }

  return <span data-testid="file-status-processing"><StatusPill label="Processing" tone="neutral" /></span>;
}

/* ── FileRowMenu ── */

interface FileRowMenuProps {
  onDelete?: () => void;
}

export function FileRowMenu({ onDelete }: FileRowMenuProps) {
  return (
    <ActionMenu align="right" width={170}>
      <div aria-label="File options" data-testid="file-row-menu">
        <ActionMenuItem icon={<FileSummarizeIcon />} disabled>
          Summarize
        </ActionMenuItem>
        <ActionMenuItem icon={<FileAskIcon />} disabled>
          Ask about file
        </ActionMenuItem>
        <ActionMenuItem icon={<FileLearnIcon />} disabled>
          Start learning
        </ActionMenuItem>
        <div style={{ borderTop: "1px solid var(--tutor-border-subtle)", margin: "2px 0" }} />
        <ActionMenuItem icon={<FileDeleteIcon />} onClick={onDelete} disabled={!onDelete} destructive>
          Delete file
        </ActionMenuItem>
      </div>
    </ActionMenu>
  );
}

/* ── Icons ── */

export function FileThreeDots() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <circle cx="1.5" cy="5" r="1" />
      <circle cx="5" cy="5" r="1" />
      <circle cx="8.5" cy="5" r="1" />
    </svg>
  );
}

function FileDeleteIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 3h8M4 3V2h3v1M2.5 3l.5 6.5h5l.5-6.5" />
    </svg>
  );
}

function FileSummarizeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h7M2 5.5h7M2 8h4" />
    </svg>
  );
}

function FileAskIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="4" />
      <path d="M5.5 7.5v-.5c0-.8.8-1.3 1-1.8.3-.7-.2-1.7-1-1.7-.7 0-1.2.5-1.2 1.2" />
      <circle cx="5.5" cy="8.5" r="0.3" fill="currentColor" />
    </svg>
  );
}

function FileLearnIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.5 1.5L9.5 3.5v3L5.5 9 1.5 6.5v-3z" />
      <path d="M5.5 4v2M4 3.5l1.5 1 1.5-1" />
    </svg>
  );
}

/* ── Helpers ── */

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
