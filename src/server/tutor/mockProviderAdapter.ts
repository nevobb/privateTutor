import type { TutorProvider } from "./tutorProviderInterface";
import { callMockTutorProvider } from "./mockTutorProvider";
import type { TutorRequest, TutorBoundaryResponse } from "./schemas";

class MockProviderAdapter implements TutorProvider {
  readonly name = "mock";

  async call(request: TutorRequest): Promise<TutorBoundaryResponse> {
    return callMockTutorProvider(request);
  }
}

export const mockProviderAdapter = new MockProviderAdapter();
