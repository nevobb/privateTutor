// Types for the Tutor Harness — structured classification returned alongside the tutor message.
// Phase 2: DeepSeek returns JSON with both the message and this classification in one call.

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
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.message !== "string" || parsed.message.trim().length === 0) {
      return null;
    }
    return {
      message: String(parsed.message).trim(),
      intent: isValidIntent(parsed.intent) ? parsed.intent : "factual_or_regular",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
      shouldStopProgression: Boolean(parsed.shouldStopProgression),
      localQuestionDetected: Boolean(parsed.localQuestionDetected),
      localQuestionReason: typeof parsed.localQuestionReason === "string" ? parsed.localQuestionReason : "",
      memoryUpdateNeeded: Boolean(parsed.memoryUpdateNeeded),
      memoryUpdateType: isValidMemoryUpdateType(parsed.memoryUpdateType) ? parsed.memoryUpdateType : "none",
      memoryType: typeof parsed.memoryType === "string" ? parsed.memoryType : "none",
      memoryContent: typeof parsed.memoryContent === "string" ? parsed.memoryContent : "",
      memoryConfidence: typeof parsed.memoryConfidence === "number" ? parsed.memoryConfidence : 0,
    };
  } catch {
    return null;
  }
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

function isValidIntent(value: unknown): value is TutorIntent {
  return typeof value === "string" && VALID_INTENTS.includes(value as TutorIntent);
}

function isValidMemoryUpdateType(value: unknown): value is MemoryUpdateType {
  return typeof value === "string" && VALID_MEMORY_UPDATE_TYPES.includes(value as MemoryUpdateType);
}
