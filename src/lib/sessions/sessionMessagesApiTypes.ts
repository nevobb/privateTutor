import type { TutorInternalUpdate, TutorMessage, WorkMode, CostMode } from "../../types";

export interface SendMessageInput {
  workspaceId: string;
  sessionId: string;
  userMessage: string;
  workMode: WorkMode;
  costMode: CostMode;
}

export interface SendMessageApiResponse {
  userMessage: TutorMessage;
  assistantMessage: TutorMessage;
  internalUpdate: TutorInternalUpdate;
}

export interface FetchMessagesApiResponse {
  messages: TutorMessage[];
}
