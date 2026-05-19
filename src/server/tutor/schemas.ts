import {
  CostMode,
  DecisionLogEntry,
  RetrievalScope,
  SourceCitation,
  TutorResponse,
  WorkMode,
} from "../../types";

export const WORK_MODES = ["Learning", "Practice", "Research", "Build", "Temporary Chat"] as const;
export const COST_MODES = ["Cheap Practice", "Normal Learning", "Deep Research"] as const;
export const RETRIEVAL_SCOPES = ["none", "session", "topic", "workspace", "concept_library", "global_learner_memory", "web"] as const;

export interface ConversationTurn {
  role: "user" | "tutor";
  content: string;
}

export interface TutorRequest {
  userId: string;
  workspaceId: string;
  sessionId?: string;
  message: string;
  workMode: WorkMode;
  costMode: CostMode;
  activeFileIds?: string[];
  temporary?: boolean;
  conversationHistory?: ConversationTurn[];
}

export interface DecisionLogEvent {
  type:
    | "mock_provider"
    | "deepseek_provider"
    | "harness_classification"
    | "harness_fallback"
    | "retrieval_scope"
    | "retrieval_requested"
    | "retrieval_executed"
    | "retrieval_skipped"
    | "retrieval_failed"
    | "work_mode_policy"
    | "web_search_requested"
    | "web_search_executed"
    | "web_search_skipped"
    | "web_search_conflict"
    | "request_validation"
    | "response_validation"
    | "memory_not_written";
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

function isDecisionLogEntry(value: unknown): value is DecisionLogEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.decisionType === "string" &&
    typeof value.title === "string" &&
    typeof value.decision === "string" &&
    typeof value.rationale === "string" &&
    typeof value.date === "string"
  );
}

function isDecisionLogEvent(value: unknown): value is DecisionLogEvent {
  if (!isRecord(value)) return false;
  return typeof value.type === "string" && typeof value.title === "string" && typeof value.detail === "string";
}

export function validateTutorResponse(response: unknown): response is TutorBoundaryResponse {
  if (!isRecord(response) || !isRecord(response.message) || !isRecord(response.internalUpdate)) return false;

  const message = response.message;
  const internalUpdate = response.internalUpdate;

  const messageIsValid =
    typeof message.id === "string" &&
    message.role === "tutor" &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    (message.citations === undefined || (Array.isArray(message.citations) && message.citations.every(isCitation)));

  const localQuestionIsValid =
    isRecord(internalUpdate.local_question) &&
    typeof internalUpdate.local_question.detected === "boolean" &&
    typeof internalUpdate.local_question.reason === "string";

  const retrievalIsValid =
    isRecord(internalUpdate.retrieval) &&
    typeof internalUpdate.retrieval.used === "boolean" &&
    isRetrievalScope(internalUpdate.retrieval.scope) &&
    isStringArray(internalUpdate.retrieval.source_ids) &&
    typeof internalUpdate.retrieval.why === "string";

  const retrievalDecisionIsValid =
    internalUpdate.retrieval_decision === undefined ||
    (isRecord(internalUpdate.retrieval_decision) &&
      typeof internalUpdate.retrieval_decision.needs_retrieval === "boolean" &&
      isRetrievalScope(internalUpdate.retrieval_decision.retrieval_scope) &&
      typeof internalUpdate.retrieval_decision.max_chunks === "number" &&
      typeof internalUpdate.retrieval_decision.max_tokens === "number" &&
      typeof internalUpdate.retrieval_decision.should_ask_clarification_first === "boolean");

  const learnerMemoryUpdateIsValid =
    isRecord(internalUpdate.learner_memory_update) &&
    typeof internalUpdate.learner_memory_update.needed === "boolean" &&
    (internalUpdate.learner_memory_update.update_type === "none" ||
      internalUpdate.learner_memory_update.update_type === "small_auto" ||
      internalUpdate.learner_memory_update.update_type === "requires_approval") &&
    typeof internalUpdate.learner_memory_update.memory_type === "string" &&
    typeof internalUpdate.learner_memory_update.content === "string" &&
    typeof internalUpdate.learner_memory_update.confidence === "number";

  const knowledgeBaseActionIsValid =
    isRecord(internalUpdate.knowledge_base_action) &&
    typeof internalUpdate.knowledge_base_action.needed === "boolean" &&
    typeof internalUpdate.knowledge_base_action.action === "string" &&
    typeof internalUpdate.knowledge_base_action.confidence === "number" &&
    typeof internalUpdate.knowledge_base_action.requires_user_confirmation === "boolean";

  const internalUpdateIsValid =
    typeof internalUpdate.detected_intent === "string" &&
    internalUpdate.detected_intent.trim().length > 0 &&
    typeof internalUpdate.confidence === "number" &&
    typeof internalUpdate.should_stop_progression === "boolean" &&
    localQuestionIsValid &&
    retrievalIsValid &&
    retrievalDecisionIsValid &&
    learnerMemoryUpdateIsValid &&
    knowledgeBaseActionIsValid &&
    Array.isArray(internalUpdate.decision_log_entries) &&
    internalUpdate.decision_log_entries.every(isDecisionLogEntry);

  const logsAreValid =
    response.decisionLogEvents === undefined ||
    (Array.isArray(response.decisionLogEvents) && response.decisionLogEvents.every(isDecisionLogEvent));

  const errorsAreValid = response.errors === undefined || isStringArray(response.errors);

  return messageIsValid && internalUpdateIsValid && logsAreValid && errorsAreValid;
}
