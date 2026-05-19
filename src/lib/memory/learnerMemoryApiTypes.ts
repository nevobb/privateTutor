import type { MemoryObservationType } from "../../types";

export interface LearnerMemoryObservationItem {
  id: string;
  type?: MemoryObservationType;
  scope?: "global" | "workspace" | "topic" | "session";
  content: string;
  confidence: number;
  state: "candidate" | "active" | "tentative" | "superseded" | "archived" | "deleted";
  source: "conversation" | "user-correction" | "behavior-test" | "manual" | "user_explicit" | "model_inferred" | "repeated_pattern";
  workspaceId?: string;
  requiresApproval?: boolean;
  timestamp: string;
  updatedAt: string;
}

export interface LearnerMemoryListResponse {
  observations: LearnerMemoryObservationItem[];
}
