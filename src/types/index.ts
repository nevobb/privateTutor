export type CostMode = "Cheap Practice" | "Normal Learning" | "Deep Research";

export type WorkMode = "Learning" | "Practice" | "Research" | "Build" | "Temporary Chat";

export type FileAssignmentStatus = "unassigned" | "assigned" | "needs-review";

export type FileIndexingStatus = "not-indexed" | "queued" | "indexed" | "failed";

export type MemoryObservationState = "candidate" | "active" | "archived";

export type MemoryObservationSource = "conversation" | "user-correction" | "behavior-test" | "manual";

export type RetrievalScope = "none" | "session" | "topic" | "workspace" | "concept_library" | "global_learner_memory" | "web";

export type ProviderStatus = "not-configured" | "configured" | "disabled" | "error";

export interface User {
  id: string;
  name: string;
  defaultCostMode?: CostMode;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  path?: string[];
  parentWorkspaceId?: string;
  stableIdentityNote?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  url: string;
  uploadedAt: Date;
  workspaceId?: string;
  assignedTopicId?: string;
  assignmentStatus: FileAssignmentStatus;
  indexingStatus: FileIndexingStatus;
  sourceType: "pdf" | "docx" | "note" | "other";
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
  observation: string;
  timestamp: Date;
  confidence: number;
  state: MemoryObservationState;
  source: MemoryObservationSource;
  appliesToWorkMode?: WorkMode;
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
  internalUpdates?: LearnerMemoryObservation[];
  mockRouting: {
    workMode: WorkMode;
    costMode: CostMode;
    retrievalScope: RetrievalScope;
    usedWebSearch: boolean;
    memoryWrite: "none" | "candidate";
    stoppedAfterLocalAnswer: boolean;
  };
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
}

export interface DecisionLogEntry {
  id: string;
  decisionType: "retrieval_scope" | "web_search" | "memory_write" | "memory_not_written" | "file_assignment" | "model_provider" | "cost_mode" | "mock_alignment";
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
