export type CostMode = "Cheap Practice" | "Normal Learning" | "Deep Research";

export type WorkMode = "Learning" | "Practice" | "Research" | "Build" | "Temporary Chat";

export interface User {
  id: string;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  url: string;
  uploadedAt: Date;
}

// STRICT RULE: AcademicKnowledgeItem is separate from LearnerMemory
export interface AcademicKnowledgeItem {
  id: string;
  title: string;
  content: string;
  source: string;
}

// STRICT RULE: LearnerMemory is separate from AcademicKnowledgeItem
export interface LearnerMemoryObservation {
  id: string;
  observation: string;
  timestamp: Date;
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
}

export interface SessionSummary {
  id: string;
  summary: string;
  createdAt: Date;
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
  title: string;
  decision: string;
  rationale: string;
  date: string;
}

export interface BehaviorTest {
  id: string;
  description: string;
  expectedOutcome: string;
}

export interface ProviderSettings {
  id: string;
  providerName: string;
  apiKey?: string; // mocked
}
