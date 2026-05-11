import { getMockTutorResponse } from "../../lib/tutor";
import { TutorBoundaryResponse, TutorRequest } from "./schemas";

export async function callMockTutorProvider(request: TutorRequest): Promise<TutorBoundaryResponse> {
  const response = await getMockTutorResponse(request.message, request.workMode, request.costMode);
  const isTemporary = request.temporary === true || request.workMode === "Temporary Chat";

  return {
    ...response,
    internalUpdates: isTemporary ? undefined : response.internalUpdates,
    mockRouting: {
      ...response.mockRouting,
      memoryWrite: isTemporary ? "none" : response.mockRouting.memoryWrite,
    },
    decisionLogEvents: [
      {
        type: "mock_provider",
        title: "Mock tutor provider used",
        detail: "The backend boundary called the mock tutor provider; no external model, retrieval, or web search provider was used.",
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
