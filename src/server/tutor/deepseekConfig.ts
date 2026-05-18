import type { CostMode } from "../../types";

export const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

// Model identifiers per DeepSeek API docs (https://api-docs.deepseek.com/quick_start/pricing)
// deepseek-chat   → latest chat model (V4 Flash tier for cost-effective responses)
// deepseek-reasoner → R1 reasoning model (for deep research and complex problems)
export const DEEPSEEK_MODELS = {
  flash: "deepseek-chat",
  reasoner: "deepseek-reasoner",
} as const;

export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[keyof typeof DEEPSEEK_MODELS];

export function getDeepSeekModel(costMode: CostMode): DeepSeekModel {
  switch (costMode) {
    case "Deep Research":
      return DEEPSEEK_MODELS.reasoner;
    case "Cheap Practice":
    case "Normal Learning":
    default:
      return DEEPSEEK_MODELS.flash;
  }
}

export function getDeepSeekApiKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY;
}
