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
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}
