export type WorkspaceFileSourceType = "pdf" | "docx";

export interface WorkspaceFileItem {
  id: string;
  userId: string;
  workspaceId?: string;
  fileName: string;
  sourceType: "pdf" | "docx" | "note" | "other";
  storagePath?: string;
  topic?: string;
  confidence?: number;
  assignmentStatus: string;
  indexingStatus: string;
  summaryStatus: string;
  summaryText: string | null;
  summarySource: "none" | "placeholder";
  summaryErrorCode: string | null;
  summaryUpdatedAt: string | null;
  extractionStatus: "not_started" | "pending" | "completed" | "failed";
  extractedText?: string;
  extractedTextPreview?: string;
  extractedTextCharCount?: number;
  extractionSource?:
    | "deterministic_test_parser"
    | "manual_placeholder"
    | "future_real_parser"
    | "mammoth_docx_parser"
    | "pdf_parse_pdf_parser";
  extractionErrorCode: string | null;
  extractionUpdatedAt: string | null;
  chunkingStatus: "not_started" | "pending" | "completed" | "failed";
  chunkCount?: number;
  chunkingErrorCode: string | null;
  chunkingUpdatedAt: string | null;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}
