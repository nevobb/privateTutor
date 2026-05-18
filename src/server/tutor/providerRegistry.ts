import type { TutorProvider } from "./tutorProviderInterface";
import { deepseekTutorProvider } from "./deepseekTutorProvider";
import { mockProviderAdapter } from "./mockProviderAdapter";
import { getDeepSeekApiKey } from "./deepseekConfig";

/**
 * Returns the active tutor provider based on environment configuration.
 *
 * Priority:
 *   1. DeepSeek — when DEEPSEEK_API_KEY is set
 *   2. Mock    — fallback for local dev and tests without a real API key
 *
 * To add a new provider in the future, add it here before the mock fallback.
 */
export function getActiveTutorProvider(): TutorProvider {
  if (getDeepSeekApiKey()) {
    return deepseekTutorProvider;
  }
  return mockProviderAdapter;
}
