import type { CostMode, RetrievalBoundaryDecision, RetrievalScope, WorkMode } from "../../types";

interface RetrievalDecisionInput {
  message: string;
  workMode: WorkMode;
  costMode: CostMode;
}

interface Budget {
  maxChunks: number;
  maxTokens: number;
}

export function decideRetrievalBoundary(input: RetrievalDecisionInput): RetrievalBoundaryDecision {
  const normalized = input.message.toLowerCase();

  if (isSimpleFactQuestion(normalized)) {
    return {
      needs_retrieval: false,
      retrieval_scope: "none",
      max_chunks: 0,
      max_tokens: 0,
      should_ask_clarification_first: false,
    };
  }

  if (isBroadQuestion(normalized)) {
    return {
      needs_retrieval: false,
      retrieval_scope: "none",
      max_chunks: 0,
      max_tokens: 0,
      should_ask_clarification_first: true,
    };
  }

  const budget = getBudgetByCostMode(input.costMode);
  const activeContext = isActiveContextQuestion(normalized);

  if (activeContext) {
    return {
      needs_retrieval: true,
      retrieval_scope: input.costMode === "Deep Research" ? "workspace" : "session",
      max_chunks: budget.maxChunks,
      max_tokens: budget.maxTokens,
      should_ask_clarification_first: false,
    };
  }

  if (input.workMode === "Practice" && input.costMode === "Cheap Practice") {
    return {
      needs_retrieval: false,
      retrieval_scope: "none",
      max_chunks: 0,
      max_tokens: 0,
      should_ask_clarification_first: false,
    };
  }

  return {
    needs_retrieval: true,
    retrieval_scope: chooseDefaultScope(input.workMode, input.costMode),
    max_chunks: budget.maxChunks,
    max_tokens: budget.maxTokens,
    should_ask_clarification_first: false,
  };
}

function chooseDefaultScope(workMode: WorkMode, costMode: CostMode): RetrievalScope {
  if (costMode === "Deep Research") return "workspace";
  if (workMode === "Research") return "workspace";
  return "topic";
}

function getBudgetByCostMode(costMode: CostMode): Budget {
  if (costMode === "Cheap Practice") {
    return { maxChunks: 2, maxTokens: 700 };
  }

  if (costMode === "Deep Research") {
    return { maxChunks: 8, maxTokens: 2800 };
  }

  return { maxChunks: 4, maxTokens: 1400 };
}

function isSimpleFactQuestion(message: string): boolean {
  return /(מה הנגזרת|what is the derivative|capital of|הגדרה של|define\s+)/.test(message);
}

function isBroadQuestion(message: string): boolean {
  return /(תסביר הכול|explain everything|overview of|סכם את כל|summarize the whole|broad overview)/.test(message);
}

function isActiveContextQuestion(message: string): boolean {
  return /(בקובץ|בחומר|מהסיכום|from the file|from this session|in our session|from my notes|my notes)/.test(message);
}
