import type { TutorRequest, TutorBoundaryResponse } from "./schemas";

export interface TutorProvider {
  readonly name: string;
  call(request: TutorRequest): Promise<TutorBoundaryResponse>;
}
