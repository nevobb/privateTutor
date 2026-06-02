import type {
  CostMode,
  DecisionLogEntry,
  DetectedQuestionArtifact,
  DocumentOutlineArtifact,
  DocumentPageArtifact,
  DocumentSourceReference,
  FileChunk,
  SourceCitation,
  TutorMessage,
  UploadedFile,
  WorkMode,
  Workspace,
} from "../../types";

export type WorkspaceStatus = "active" | "archived" | "deleted";
export type SessionStatus = "active" | "closed" | "archived";
export type MessageStatus = "sent" | "queued" | "failed";

export interface WorkspaceRecord extends Workspace {
  userId: string;
  status: WorkspaceStatus;
  createdAt: Date;
  updatedAt: Date;
  lastSessionId?: string;
  lastActivityAt?: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  workMode: WorkMode;
  costMode: CostMode;
  activeTopic?: string;
  status: SessionStatus;
  startedAt: Date;
  lastActiveAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessageAt?: Date;
  summary?: string;
}

export interface MessageRecord extends TutorMessage {
  userId: string;
  workspaceId: string;
  sessionId: string;
  sequence: number;
  createdAt: Date;
  status: MessageStatus;
  toolName?: string;
  toolCallId?: string;
  citations?: SourceCitation[];
}

export interface DecisionLogEntryRecord extends DecisionLogEntry {
  userId: string;
  createdAt: Date;
  workspaceId?: string;
  sessionId?: string;
}

export interface UploadedFileRecord extends UploadedFile {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileChunkRecord extends Omit<FileChunk, "createdAt"> {
  createdAt: Date;
}

export interface DocumentSourceReferenceRecord extends DocumentSourceReference {}

export interface DocumentPageArtifactRecord extends Omit<DocumentPageArtifact, "createdAt" | "updatedAt"> {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentOutlineArtifactRecord extends Omit<DocumentOutlineArtifact, "createdAt" | "updatedAt"> {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DetectedQuestionArtifactRecord extends Omit<DetectedQuestionArtifact, "createdAt" | "updatedAt"> {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileChunkEmbeddingRecord {
  userId: string;
  workspaceId: string;
  fileId: string;
  chunkId: string;
  vector: number[];
  embeddingStatus: "completed";
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
  embeddingUpdatedAt: Date;
  embeddingErrorCode: null;
  embeddingSourceTextHash: string;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  path?: string[];
  parentWorkspaceId?: string;
  stableIdentityNote?: string;
}

export interface CreateSessionInput {
  id?: string;
  title?: string;
  summary?: string;
  workMode?: WorkMode;
  costMode?: CostMode;
  activeTopic?: string;
  status?: SessionStatus;
}

export interface AppendMessageInput {
  role: TutorMessage["role"];
  content: string;
  citations?: SourceCitation[];
  status?: MessageStatus;
  toolName?: string;
  toolCallId?: string;
}

export interface WriteDecisionLogEntryInput {
  decisionType: DecisionLogEntry["decisionType"];
  title: string;
  decision: string;
  rationale: string;
  workspaceId?: string;
  sessionId?: string;
}

export interface CreateUploadedFileInput {
  workspaceId: string;
  name: string;
  originalFileName?: string;
  sourceType: "pdf" | "docx";
  storagePath?: string;
  topicHint?: string;
  topic?: string;
  confidence?: number;
  assignmentStatus: UploadedFileRecord["assignmentStatus"];
  indexingStatus: UploadedFileRecord["indexingStatus"];
  summaryStatus: UploadedFileRecord["summaryStatus"];
  summaryText?: UploadedFileRecord["summaryText"];
  summarySource: UploadedFileRecord["summarySource"];
  summaryErrorCode?: UploadedFileRecord["summaryErrorCode"];
  summaryUpdatedAt?: UploadedFileRecord["summaryUpdatedAt"];
  extractionStatus: UploadedFileRecord["extractionStatus"];
  extractedText?: UploadedFileRecord["extractedText"];
  extractedTextPreview?: UploadedFileRecord["extractedTextPreview"];
  extractedTextCharCount?: UploadedFileRecord["extractedTextCharCount"];
  extractionSource?: UploadedFileRecord["extractionSource"];
  extractionErrorCode?: UploadedFileRecord["extractionErrorCode"];
  extractionUpdatedAt?: UploadedFileRecord["extractionUpdatedAt"];
  understandingStatus?: UploadedFileRecord["understandingStatus"];
  understandingErrorCode?: UploadedFileRecord["understandingErrorCode"];
  understandingUpdatedAt?: UploadedFileRecord["understandingUpdatedAt"];
  pageCount?: UploadedFileRecord["pageCount"];
  outlineTitle?: UploadedFileRecord["outlineTitle"];
  detectedQuestionCount?: UploadedFileRecord["detectedQuestionCount"];
  extractionQuality?: UploadedFileRecord["extractionQuality"];
  chunkingStatus: UploadedFileRecord["chunkingStatus"];
  chunkCount?: UploadedFileRecord["chunkCount"];
  chunkingErrorCode?: UploadedFileRecord["chunkingErrorCode"];
  chunkingUpdatedAt?: UploadedFileRecord["chunkingUpdatedAt"];
  deepPdfStatus?: UploadedFileRecord["deepPdfStatus"];
  deepPdfUpdatedAt?: UploadedFileRecord["deepPdfUpdatedAt"];
  embeddingStatus?: UploadedFileRecord["embeddingStatus"];
  embeddingUpdatedAt?: UploadedFileRecord["embeddingUpdatedAt"];
}

export function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const converted = (value as { toDate: () => Date }).toDate();
    if (converted instanceof Date) return converted;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return new Date(0);
}
