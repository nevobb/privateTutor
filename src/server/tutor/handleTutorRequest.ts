import { callMockTutorProvider } from "./mockTutorProvider";
import { TutorHandlerResult, validateTutorResponse } from "./schemas";
import { validateTutorRequest } from "./validateTutorRequest";

const INVALID_REQUEST_MESSAGE = "Invalid tutor request.";
const INVALID_RESPONSE_MESSAGE = "Tutor response failed validation.";

export async function handleTutorRequest(input: unknown): Promise<TutorHandlerResult> {
  const validation = validateTutorRequest(input);

  if (!validation.ok || !validation.request) {
    return {
      ok: false,
      status: 400,
      error: {
        error: INVALID_REQUEST_MESSAGE,
      },
    };
  }

  const response = await callMockTutorProvider(validation.request);

  if (!validateTutorResponse(response)) {
    return {
      ok: false,
      status: 500,
      error: {
        error: INVALID_RESPONSE_MESSAGE,
      },
    };
  }

  return {
    ok: true,
    response,
  };
}
