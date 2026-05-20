export type CostMode = "Cheap Practice" | "Normal Learning" | "Deep Research";

export type WorkMode = "Learning" | "Practice" | "Research" | "Build" | "Temporary Chat";

export type FileAssignmentStatus = "unassigned" | "assigned" | "needs-review";

export type FileIndexingStatus =
  | "not-indexed"
  | "queued"
  | "uploaded"
  | "indexing"
  | "indexed"
  | "failed";

export type FileSummaryStatus = "not_requested" | "pending" | "ready" | "failed";
export type FileExtractionStatus = "not_started" | "pending" | "completed" | "failed";
export type FileChunkingStatus = "not_started" | "pending" | "completed" | "failed";
export type FileUnderstandingStatus = "not_started" | "processing" | "completed" | "failed";
export type FileVisualStatus = "not_started" | "available" | "processing" | "completed" | "failed";
export type FileMaterialType =
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
export type FileChunkEmbeddingStatus =
  | "not_started"
  | "pending"
  | "completed"
  | "failed"
  | "stale";
export type DocumentTextQuality = "good" | "partial" | "poor" | "unknown";
export type DocumentBlockType =
  | "paragraph"
  | "heading"
  | "question"
  | "subsection"
  | "formula"
  | "table_text"
  | "definition"
  | "example"
  | "unknown";
export type ExtractionConfidence = "high" | "medium" | "low";
export type VisualElementType = "graph" | "diagram" | "circuit" | "table" | "figure" | "image" | "unknown";

// Extended to include spec lifecycle values alongside legacy "candidate"
export type MemoryObservationState =
  | "candidate"
  | "active"
  | "tentative"
  | "superseded"
  | "archived"
  | "deleted";

// Extended to include spec source values alongside legacy conversation-based values
export type MemoryObservationSource =
  | "conversation"
  | "user-correction"
  | "behavior-test"
  | "manual"
  | "user_explicit"
  | "model_inferred"
  | "repeated_pattern";

export type MemoryObservationType =
  | "preference"
  | "difficulty"
  | "correction"
  | "explanation_pattern"
  | "pacing"
  | "behavior_rule";

export type MemoryScope = "global" | "workspace" | "topic" | "session";

export type RetrievalScope =
  | "none"
  | "session"
  | "topic"
  | "workspace"
  | "concept_library"
  | "global_learner_memory"
  | "web";

export type ProviderStatus = "not-configured" | "configured" | "disabled" | "error";

export type WorkspaceType = "course" | "temporary" | "general" | "archive" | "project";

// Wide union covers both the server-side WorkspaceRecord status and the spec lifecycle values
export type WorkspaceLifecycleStatus = "active" | "inactive" | "archived" | "deleted";

export type SessionLifecycleStatus = "active" | "inactive" | "archived";

export type FilePolicy =
  | "knowledge_base_source"
  | "context_for_practice_generation"
  | "temporary_reference";

export interface User {
  id: string;
  name: string;
  defaultCostMode?: CostMode;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  // Legacy path array — kept for backwards compatibility
  path?: string[];
  parentWorkspaceId?: string;
  stableIdentityNote?: string;
  // Spec-aligned lifecycle and classification fields (optional for backwards compat)
  type?: WorkspaceType;
  // Optional — wide enough for both WorkspaceRecord ("active"|"archived"|"deleted") and spec values
  status?: WorkspaceLifecycleStatus;
  currentPath?: string;
  previousPaths?: string[];
  courseContext?: {
    year: number;
    semester: number;
    course: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UploadedFile {
  id: string;
  name: string;
  originalFileName?: string;
  url: string;
  uploadedAt: Date;
  workspaceId?: string;
  assignedTopicId?: string;
  assignmentStatus: FileAssignmentStatus;
  indexingStatus: FileIndexingStatus;
  sourceType: "pdf" | "docx" | "note" | "other";
  // Spec-aligned classification and indexing fields
  filePolicy?: FilePolicy;
  topic?: string;
  subtopic?: string;
  summaryId?: string;
  indexProvider?: string;
  indexId?: string;
  confidence?: number;
  storagePath?: string;
  summaryStatus?: FileSummaryStatus;
  summaryText?: string | null;
  summarySource?: "none" | "placeholder";
  summaryErrorCode?: string | null;
  summaryUpdatedAt?: Date | null;
  extractionStatus?: FileExtractionStatus;
  extractedText?: string;
  extractedTextPreview?: string;
  extractedTextCharCount?: number;
  extractionSource?: "deterministic_test_parser" | "manual_placeholder" | "future_real_parser" | "mammoth_docx_parser" | "pdf_parse_pdf_parser";
  extractionErrorCode?: string | null;
  extractionUpdatedAt?: Date | null;
  chunkingStatus?: FileChunkingStatus;
  chunkCount?: number;
  chunkingErrorCode?: string | null;
  chunkingUpdatedAt?: Date | null;
  embeddingStatus?: "not_started" | "completed" | "failed";
  embeddingUpdatedAt?: Date | null;
  understandingStatus?: FileUnderstandingStatus;
  understandingUpdatedAt?: Date | null;
  understandingErrorCode?: string | null;
  visualStatus?: FileVisualStatus;
  visualUpdatedAt?: Date | null;
  visualErrorCode?: string | null;
  materialType?: FileMaterialType;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SourceAnchor {
  fileId: string;
  pageNumber?: number;
  blockId?: string;
  questionId?: string;
  chunkId?: string;
  charStart?: number;
  charEnd?: number;
}

export interface DocumentPage {
  id: string;
  userId: string;
  workspaceId: string;
  fileId: string;
  pageNumber: number;
  extractedText: string;
  cleanedText?: string;
  charStart?: number;
  charEnd?: number;
  textQuality?: DocumentTextQuality;
  sourceChunkIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentBlock {
  id: string;
  userId: string;
  workspaceId: string;
  fileId: string;
  pageNumber: number;
  blockType: DocumentBlockType;
  text: string;
  orderIndex: number;
  charStart?: number;
  charEnd?: number;
  sourceChunkIds?: string[];
  confidence?: ExtractionConfidence;
  createdAt: Date;
  updatedAt: Date;
}

export interface DetectedQuestion {
  id: string;
  userId: string;
  workspaceId: string;
  fileId: string;
  labelRaw: string;
  normalizedLabel?: string;
  questionNumber?: number;
  topic?: string;
  summary?: string;
  pageStart?: number;
  pageEnd?: number;
  blockIds?: string[];
  sourceChunkIds?: string[];
  subsections?: string[];
  confidence: ExtractionConfidence;
  extractionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentOutlineSection {
  sectionId: string;
  label?: string;
  title?: string;
  sectionType?: string;
  pageStart?: number;
  pageEnd?: number;
  blockIds?: string[];
  sourceChunkIds?: string[];
  confidence?: ExtractionConfidence;
}

export interface DocumentOutline {
  id: string;
  userId: string;
  workspaceId: string;
  fileId: string;
  title?: string;
  sections: DocumentOutlineSection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VisualElement {
  id: string;
  userId: string;
  workspaceId: string;
  fileId: string;
  pageNumber: number;
  visualType: VisualElementType;
  nearQuestionId?: string;
  descriptionFromText?: string;
  requiresVision: boolean;
  visualStatus?: FileVisualStatus;
  confidence?: ExtractionConfidence;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileChunk {
  chunkId: string;
  userId: string;
  workspaceId: string;
  fileId: string;
  text: string;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
  tokenEstimate: number;
  source: "extracted_text";
  embeddingStatus?: FileChunkEmbeddingStatus;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  embeddingUpdatedAt?: Date | null;
  embeddingErrorCode?: string | null;
  embeddingSourceTextHash?: string;
  createdAt: string;
}

// STRICT RULE: AcademicKnowledgeItem is separate from LearnerMemory
export interface AcademicKnowledgeItem {
  id: string;
  title: string;
  content: string;
  sourceId: string;
  workspaceId: string;
  sourceType: "uploaded_file" | "summary" | "concept" | "external_source" | "mock";
  citationLabel?: string;
  pageRange?: string;
}

// STRICT RULE: LearnerMemory is separate from AcademicKnowledgeItem
export interface LearnerMemoryObservation {
  id: string;
  // Legacy field — kept for backwards compatibility with tutor.ts and behavior tests
  observation: string;
  timestamp: Date;
  confidence: number;
  // Legacy state field — kept for tutor.ts compatibility ("candidate"|"active"|"archived" still valid)
  state: MemoryObservationState;
  source: MemoryObservationSource;
  appliesToWorkMode?: WorkMode;
  // Spec-aligned fields (optional for backwards compat — tutor.ts does not set these yet)
  type?: MemoryObservationType;
  scope?: MemoryScope;
  // Richer content field distinct from observation string
  content?: string;
  workspaceId?: string;
  topic?: string;
  requiresApproval?: boolean;
}

export interface LearnerMemory {
  id: string;
  userId: string;
  observations: LearnerMemoryObservation[];
  masteryLevel: number; // e.g., 0-100
}

export interface SourceCitation {
  id: string;
  referenceText: string;
  sourceId: string;
}

export interface TutorMessage {
  id: string;
  role: "user" | "tutor";
  content: string;
  citations?: SourceCitation[];
}

export interface TutorResponse {
  message: TutorMessage;
  internalUpdate: TutorInternalUpdate;
}

export interface RetrievalBoundaryDecision {
  needs_retrieval: boolean;
  retrieval_scope: RetrievalScope;
  max_chunks: number;
  max_tokens: number;
  should_ask_clarification_first: boolean;
}

// Spec-aligned structured internal update type for mock and real provider responses.
export interface TutorInternalUpdate {
  detected_intent: string;
  confidence: number;
  should_stop_progression: boolean;
  local_question: {
    detected: boolean;
    reason: string;
  };
  retrieval: {
    used: boolean;
    scope: RetrievalScope;
    source_ids: string[];
    why: string;
  };
  retrieval_decision?: RetrievalBoundaryDecision;
  learner_memory_update: {
    needed: boolean;
    update_type: "none" | "small_auto" | "requires_approval";
    memory_type: "none" | MemoryObservationType;
    content: string;
    confidence: number;
  };
  knowledge_base_action: {
    needed: boolean;
    action:
      | "none"
      | "classify_file"
      | "assign_file"
      | "summarize_file"
      | "create_topic"
      | "propose_workspace";
    confidence: number;
    requires_user_confirmation: boolean;
  };
  decision_log_entries: DecisionLogEntry[];
}

export interface SessionSummary {
  id: string;
  summary: string;
  createdAt: Date;
  sessionId: string;
  workspaceId: string;
  rollingVersion: number;
}

export interface Session {
  id: string;
  userId: string;
  workspaceId: string;
  messages: TutorMessage[];
  summary?: SessionSummary;
  // Spec-aligned session context fields
  workMode: WorkMode;
  costMode: CostMode;
  activeTopic?: string;
  startedAt: Date;
  lastActiveAt: Date;
  status: SessionLifecycleStatus;
}

export interface DecisionLogEntry {
  id: string;
  decisionType:
    | "retrieval_scope"
    | "web_search"
    | "memory_write"
    | "memory_not_written"
    | "file_assignment"
    | "topic_classification"
    | "file_indexing"
    | "file_summary"
    | "file_extraction"
    | "file_chunking"
    | "model_provider"
    | "cost_mode"
    | "mock_alignment";
  title: string;
  decision: string;
  rationale: string;
  date: string;
  relatedSessionId?: string;
  relatedWorkspaceId?: string;
}

export interface BehaviorTest {
  id: string;
  description: string;
  expectedOutcome: string;
}

export interface ProviderSettings {
  id: string;
  providerName: string;
  providerType: "model" | "retrieval" | "web-search";
  status: ProviderStatus;
}

export interface AdaptiveInstruction {
  id: string;
  version: number;
  instruction: string;
  sourceObservationId?: string;
  createdAt: Date;
  active: boolean;
  // Spec-aligned optional fields
  scope?: MemoryScope;
  workspaceId?: string;
  topic?: string;
  status?: "active" | "superseded" | "archived";
  updatedAt?: Date;
}

export interface RetrievalDecision {
  needsRetrieval: boolean;
  scope: RetrievalScope;
  reason: string;
  costMode: CostMode;
}

export interface ModelProvider {
  id: string;
  name: string;
  status: ProviderStatus;
}

export interface RetrievalProvider {
  id: string;
  name: string;
  status: ProviderStatus;
  supportedScopes: RetrievalScope[];
}

export interface WebSearchProvider {
  id: string;
  name: string;
  status: ProviderStatus;
}
