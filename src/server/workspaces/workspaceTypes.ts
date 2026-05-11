import type { DecisionLogEntry, SourceCitation, TutorMessage, Workspace } from "../../types";

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
  status: SessionStatus;
  startedAt: Date;
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
