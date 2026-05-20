export type WorkspaceFileSourceType = "pdf" | "docx";

export interface WorkspaceFileItem {
  id: string;
  userId: string;
  workspaceId?: string;
  fileName: string;
  originalFileName?: string;
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
  embeddingStatus: "not_started" | "completed" | "failed";
  embeddingUpdatedAt: string | null;
  understandingStatus?: "not_started" | "processing" | "completed" | "failed";
  understandingUpdatedAt?: string | null;
  understandingErrorCode?: string | null;
  visualStatus?: "not_started" | "available" | "processing" | "completed" | "failed";
  visualUpdatedAt?: string | null;
  visualErrorCode?: string | null;
  materialType?:
    | "assignment"
    | "exam"
    | "summary"
    | "lecture_notes"
    | "slides"
    | "formula_sheet"
    | "book_chapter"
    | "lab_sheet"
    | "solutions"
    | "unknown";
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}
