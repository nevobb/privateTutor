import { getMockTutorResponse } from "../../lib/tutor";
import { TutorBoundaryResponse, TutorRequest } from "./schemas";

export async function callMockTutorProvider(request: TutorRequest): Promise<TutorBoundaryResponse> {
  const response = await getMockTutorResponse(request.message, request.workMode, request.costMode);
  const isTemporary = request.temporary === true || request.workMode === "Temporary Chat";
  const grounding = request.groundingContext;
  const hasGrounding =
    grounding?.mode === "file_chunks" && (grounding.chunks?.length ?? 0) > 0;

  return {
    ...response,
    internalUpdate: {
      ...response.internalUpdate,
      learner_memory_update: isTemporary
        ? {
            needed: false,
            update_type: "none",
            memory_type: "none",
            content: "",
            confidence: 0,
          }
        : response.internalUpdate.learner_memory_update,
    },
    decisionLogEvents: [
      {
        type: "mock_provider",
        title: "Mock tutor provider used",
        detail: hasGrounding
          ? `Mock provider used with grounding context; chunks=${grounding!.chunks.length}; total_token_estimate=${grounding!.totalTokenEstimate}`
          : "The backend boundary called the mock tutor provider; no external model, retrieval, or web search provider was used.",
      },
      ...(isTemporary
        ? [
            {
              type: "memory_not_written" as const,
              title: "Temporary chat memory write skipped",
              detail: "Temporary Chat does not create permanent learner memory or academic knowledge updates.",
            },
          ]
        : []),
    ],
  };
}
