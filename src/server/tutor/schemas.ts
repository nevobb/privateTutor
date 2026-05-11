import {
  CostMode,
  LearnerMemoryObservation,
  RetrievalScope,
  SourceCitation,
  TutorResponse,
  WorkMode,
} from "../../types";

export const WORK_MODES = ["Learning", "Practice", "Research", "Build", "Temporary Chat"] as const;
export const COST_MODES = ["Cheap Practice", "Normal Learning", "Deep Research"] as const;
export const RETRIEVAL_SCOPES = ["none", "session", "topic", "workspace", "concept_library", "global_learner_memory", "web"] as const;

export interface TutorRequest {
  userId: string;
  workspaceId: string;
  sessionId?: string;
  message: string;
  workMode: WorkMode;
  costMode: CostMode;
  activeFileIds?: string[];
  temporary?: boolean;
}

export interface DecisionLogEvent {
  type: "mock_provider" | "request_validation" | "response_validation" | "memory_not_written";
  title: string;
  detail: string;
}

export interface TutorBoundaryResponse extends TutorResponse {
  decisionLogEvents?: DecisionLogEvent[];
  errors?: string[];
}

export interface SafeErrorPayload {
  error: string;
}

export type TutorHandlerResult =
  | { ok: true; response: TutorBoundaryResponse }
  | { ok: false; status: 400 | 500; error: SafeErrorPayload };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isWorkMode(value: unknown): value is WorkMode {
  return typeof value === "string" && WORK_MODES.includes(value as WorkMode);
}

export function isCostMode(value: unknown): value is CostMode {
  return typeof value === "string" && COST_MODES.includes(value as CostMode);
}

export function isRetrievalScope(value: unknown): value is RetrievalScope {
  return typeof value === "string" && RETRIEVAL_SCOPES.includes(value as RetrievalScope);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCitation(value: unknown): value is SourceCitation {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.referenceText === "string" && typeof value.sourceId === "string";
}

function isMemoryObservation(value: unknown): value is LearnerMemoryObservation {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.observation === "string" &&
    value.timestamp instanceof Date &&
    typeof value.confidence === "number" &&
    typeof value.state === "string" &&
    typeof value.source === "string"
  );
}

function isDecisionLogEvent(value: unknown): value is DecisionLogEvent {
  if (!isRecord(value)) return false;
  return typeof value.type === "string" && typeof value.title === "string" && typeof value.detail === "string";
}

export function validateTutorResponse(response: unknown): response is TutorBoundaryResponse {
  if (!isRecord(response) || !isRecord(response.message) || !isRecord(response.mockRouting)) return false;

  const message = response.message;
  const routing = response.mockRouting;

  const messageIsValid =
    typeof message.id === "string" &&
    message.role === "tutor" &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    (message.citations === undefined || (Array.isArray(message.citations) && message.citations.every(isCitation)));

  const updatesAreValid =
    response.internalUpdates === undefined ||
    (Array.isArray(response.internalUpdates) && response.internalUpdates.every(isMemoryObservation));

  const routingIsValid =
    isWorkMode(routing.workMode) &&
    isCostMode(routing.costMode) &&
    isRetrievalScope(routing.retrievalScope) &&
    typeof routing.usedWebSearch === "boolean" &&
    (routing.memoryWrite === "none" || routing.memoryWrite === "candidate") &&
    typeof routing.stoppedAfterLocalAnswer === "boolean";

  const logsAreValid =
    response.decisionLogEvents === undefined ||
    (Array.isArray(response.decisionLogEvents) && response.decisionLogEvents.every(isDecisionLogEvent));

  const errorsAreValid = response.errors === undefined || isStringArray(response.errors);

  return messageIsValid && updatesAreValid && routingIsValid && logsAreValid && errorsAreValid;
}
