// Types for the Tutor Harness — structured classification returned alongside the tutor message.
// Phase 3 adds retrieval decision boundary fields (decision only, no retrieval execution).

import type { RetrievalBoundaryDecision, RetrievalScope } from "../../types";

export type TutorIntent =
  | "factual_or_regular"
  | "guidance_only"
  | "local_question"
  | "user_correction"
  | "user_preference"
  | "research_request"
  | "temporary_chat";

export type MemoryUpdateType = "none" | "small_auto" | "requires_approval";

export interface HarnessClassification {
  intent: TutorIntent;
  confidence: number;
  shouldStopProgression: boolean;
  localQuestion: {
    detected: boolean;
    reason: string;
  };
  memoryUpdate: {
    needed: boolean;
    updateType: MemoryUpdateType;
    memoryType: string;
    content: string;
    confidence: number;
  };
}

// The full JSON object DeepSeek returns when the harness prompt is active.
export interface HarnessJsonResponse {
  message: string;
  intent: TutorIntent;
  confidence: number;
  shouldStopProgression: boolean;
  localQuestionDetected: boolean;
  localQuestionReason: string;
  memoryUpdateNeeded: boolean;
  memoryUpdateType: MemoryUpdateType;
  memoryType: string;
  memoryContent: string;
  memoryConfidence: number;
  retrievalDecision: RetrievalBoundaryDecision | null;
}

// Safe fallback defaults when JSON parsing fails.
export function defaultClassification(temporary: boolean): HarnessClassification {
  return {
    intent: temporary ? "temporary_chat" : "factual_or_regular",
    confidence: 0.7,
    shouldStopProgression: false,
    localQuestion: { detected: false, reason: "" },
    memoryUpdate: {
      needed: false,
      updateType: "none",
      memoryType: "none",
      content: "",
      confidence: 0,
    },
  };
}

export function parseHarnessJson(raw: string): HarnessJsonResponse | null {
  const parsedRecord = parseHarnessRecord(raw);
  if (!parsedRecord) {
    return null;
  }

  if (typeof parsedRecord.message !== "string" || parsedRecord.message.trim().length === 0) {
    return null;
  }

  return {
    message: String(parsedRecord.message).trim(),
    intent: isValidIntent(parsedRecord.intent) ? parsedRecord.intent : "factual_or_regular",
    confidence: typeof parsedRecord.confidence === "number" ? parsedRecord.confidence : 0.7,
    shouldStopProgression: Boolean(parsedRecord.shouldStopProgression),
    localQuestionDetected: Boolean(parsedRecord.localQuestionDetected),
    localQuestionReason:
      typeof parsedRecord.localQuestionReason === "string" ? parsedRecord.localQuestionReason : "",
    memoryUpdateNeeded: Boolean(parsedRecord.memoryUpdateNeeded),
    memoryUpdateType: isValidMemoryUpdateType(parsedRecord.memoryUpdateType)
      ? parsedRecord.memoryUpdateType
      : "none",
    memoryType: typeof parsedRecord.memoryType === "string" ? parsedRecord.memoryType : "none",
    memoryContent: typeof parsedRecord.memoryContent === "string" ? parsedRecord.memoryContent : "",
    memoryConfidence: typeof parsedRecord.memoryConfidence === "number" ? parsedRecord.memoryConfidence : 0,
    retrievalDecision: parseRetrievalDecision(parsedRecord),
  };
}

function parseHarnessRecord(raw: string): Record<string, unknown> | null {
  const direct = tryParseJsonObject(raw);
  if (direct) {
    return direct;
  }

  const fenced = extractFencedJson(raw);
  if (fenced) {
    const parsedFenced = tryParseJsonObject(fenced);
    if (parsedFenced) return parsedFenced;
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = raw.slice(firstBrace, lastBrace + 1);
    const parsedCandidate = tryParseJsonObject(candidate);
    if (parsedCandidate) return parsedCandidate;
  }

  return null;
}

function tryParseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractFencedJson(raw: string): string | null {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (!match) return null;
  return match[1]?.trim() || null;
}

const VALID_INTENTS: TutorIntent[] = [
  "factual_or_regular",
  "guidance_only",
  "local_question",
  "user_correction",
  "user_preference",
  "research_request",
  "temporary_chat",
];

const VALID_MEMORY_UPDATE_TYPES: MemoryUpdateType[] = ["none", "small_auto", "requires_approval"];
const VALID_RETRIEVAL_SCOPES: RetrievalScope[] = [
  "none",
  "session",
  "topic",
  "workspace",
  "concept_library",
  "global_learner_memory",
  "web",
];

function isValidIntent(value: unknown): value is TutorIntent {
  return typeof value === "string" && VALID_INTENTS.includes(value as TutorIntent);
}

function isValidMemoryUpdateType(value: unknown): value is MemoryUpdateType {
  return typeof value === "string" && VALID_MEMORY_UPDATE_TYPES.includes(value as MemoryUpdateType);
}

function parseRetrievalDecision(parsed: Record<string, unknown>): RetrievalBoundaryDecision | null {
  if (
    typeof parsed.needs_retrieval !== "boolean" ||
    !isValidRetrievalScope(parsed.retrieval_scope) ||
    !isValidPositiveInteger(parsed.max_chunks) ||
    !isValidPositiveInteger(parsed.max_tokens) ||
    typeof parsed.should_ask_clarification_first !== "boolean"
  ) {
    return null;
  }

  return {
    needs_retrieval: parsed.needs_retrieval,
    retrieval_scope: parsed.retrieval_scope,
    max_chunks: parsed.max_chunks,
    max_tokens: parsed.max_tokens,
    should_ask_clarification_first: parsed.should_ask_clarification_first,
  };
}

function isValidRetrievalScope(value: unknown): value is RetrievalScope {
  return typeof value === "string" && VALID_RETRIEVAL_SCOPES.includes(value as RetrievalScope);
}

function isValidPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
