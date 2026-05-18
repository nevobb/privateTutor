import { v4 as uuidv4 } from "uuid";
import type { TutorBoundaryResponse, TutorRequest } from "./schemas";
import type { TutorProvider } from "./tutorProviderInterface";
import { DEEPSEEK_API_URL, getDeepSeekApiKey, getDeepSeekModel } from "./deepseekConfig";
import { buildSystemPrompt } from "./deepseekSystemPrompt";
import type { TutorInternalUpdate } from "../../types";
import { buildHarnessJsonContract } from "./deepseekHarnessPrompt";
import { defaultClassification, parseHarnessJson } from "./harnessTypes";

function buildInternalUpdateFromHarness(
  request: TutorRequest,
  harnessRaw: string
): { internalUpdate: TutorInternalUpdate; usedFallback: boolean } {
  const isTemporary = request.temporary === true || request.workMode === "Temporary Chat";
  const parsed = parseHarnessJson(harnessRaw);
  const classification = parsed
    ? {
        intent: parsed.intent,
        confidence: parsed.confidence,
        shouldStopProgression: parsed.shouldStopProgression,
        localQuestion: {
          detected: parsed.localQuestionDetected,
          reason: parsed.localQuestionReason,
        },
        memoryUpdate: {
          needed: parsed.memoryUpdateNeeded,
          updateType: parsed.memoryUpdateType,
          memoryType: parsed.memoryType,
          content: parsed.memoryContent,
          confidence: parsed.memoryConfidence,
        },
      }
    : defaultClassification(isTemporary);

  return {
    usedFallback: parsed === null,
    internalUpdate: {
      detected_intent: classification.intent,
      confidence: classification.confidence,
      should_stop_progression: classification.shouldStopProgression,
      local_question: {
        detected: classification.localQuestion.detected,
        reason: classification.localQuestion.reason,
      },
      retrieval: {
        used: false,
        scope: "none",
        source_ids: [],
        why: "phase2_harness_no_retrieval",
      },
      learner_memory_update: {
        needed: isTemporary ? false : classification.memoryUpdate.needed,
        update_type: isTemporary ? "none" : classification.memoryUpdate.updateType,
        memory_type: isTemporary ? "none" : (classification.memoryUpdate.memoryType as TutorInternalUpdate["learner_memory_update"]["memory_type"]),
        content: isTemporary ? "" : classification.memoryUpdate.content,
        confidence: isTemporary ? 0 : classification.memoryUpdate.confidence,
      },
      knowledge_base_action: {
        needed: false,
        action: "none",
        confidence: 0,
        requires_user_confirmation: false,
      },
      decision_log_entries: [],
    },
  };
}

interface DeepSeekApiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class DeepSeekTutorProvider implements TutorProvider {
  readonly name = "deepseek";

  async call(request: TutorRequest): Promise<TutorBoundaryResponse> {
    const apiKey = getDeepSeekApiKey();
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY is not configured.");
    }

    const model = getDeepSeekModel(request.costMode);
    const systemPrompt = `${buildSystemPrompt(request.workMode, request.costMode)}\n\n${buildHarnessJsonContract()}`;
    const isTemporary = request.temporary === true || request.workMode === "Temporary Chat";

    // Build messages array: system prompt + conversation history + current user message
    // DeepSeek uses "assistant" for tutor turns (OpenAI-compatible convention)
    const history = request.conversationHistory ?? [];
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((turn) => ({
        role: turn.role === "tutor" ? ("assistant" as const) : ("user" as const),
        content: turn.content,
      })),
      { role: "user" as const, content: request.message },
    ];

    const requestBody = {
      model,
      messages,
      temperature: request.workMode === "Practice" ? 0.3 : 0.7,
      max_tokens: request.costMode === "Cheap Practice" ? 512 : 1024,
      stream: false,
    };

    console.log(`[DeepSeek] calling model=${model} workMode=${request.workMode} costMode=${request.costMode} history=${history.length} turns`);

    const res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "unknown error");
      console.error(`[DeepSeek] API error ${res.status}:`, errorText);
      throw new Error(`DeepSeek API error ${res.status}: ${errorText}`);
    }

    const data = (await res.json()) as DeepSeekApiResponse;
    const content = data.choices?.[0]?.message?.content;
    console.log(`[DeepSeek] response received, content length=${content?.length ?? 0}`);

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      console.error("[DeepSeek] empty or invalid response structure:", JSON.stringify(data).slice(0, 200));
      throw new Error("DeepSeek returned an empty or invalid response.");
    }

    const { internalUpdate, usedFallback } = buildInternalUpdateFromHarness(request, content.trim());
    const parsedHarness = parseHarnessJson(content.trim());
    const assistantContent = parsedHarness ? parsedHarness.message : content.trim();

    return {
      message: {
        id: uuidv4(),
        role: "tutor",
        content: assistantContent,
      },
      internalUpdate,
      decisionLogEvents: [
        {
          type: "deepseek_provider",
          title: `DeepSeek provider used (${model})`,
          detail: `Real AI response via DeepSeek API. Model: ${model}. Work mode: ${request.workMode}. Cost mode: ${request.costMode}.`,
        },
        {
          type: usedFallback ? "harness_fallback" : "harness_classification",
          title: usedFallback ? "Harness JSON parse fallback used" : "Harness classification applied",
          detail: usedFallback
            ? "DeepSeek response was not valid harness JSON; default harness classification was applied."
            : "DeepSeek response parsed as harness JSON and mapped into internalUpdate.",
        },
        ...(isTemporary
          ? [
              {
                type: "memory_not_written" as const,
                title: "Temporary chat memory write skipped",
                detail: "Temporary Chat does not create permanent learner memory.",
              },
            ]
          : []),
      ],
    };
  }
}

export const deepseekTutorProvider = new DeepSeekTutorProvider();
