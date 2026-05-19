import type { AuthResult } from "../../../server/auth/authTypes";
import { resolveAuthenticatedUser } from "../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../server/firebase/firestoreEmulatorClient";
import { learnerMemoryApiService } from "../../../server/workspaces/learnerMemoryApiService";
import { toLearnerMemoryObservationApiItem } from "../../../server/workspaces/learnerMemoryApiSchemas";

type AuthResolver = (request: Request) => Promise<AuthResult>;

export function createLearnerMemoryGetHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function GET(request: Request): Promise<Response> {
    const auth = await authResolver(request);
    if (!auth.ok) return Response.json(auth.error, { status: auth.status });

    const workspaceId = new URL(request.url).searchParams.get("workspaceId") ?? undefined;

    try {
      const observations = await learnerMemoryApiService.listForUser(auth.user, workspaceId);
      return Response.json({ observations: observations.map(toLearnerMemoryObservationApiItem) });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }
      return Response.json({ error: "Failed to list learner memory." }, { status: 500 });
    }
  };
}

export const GET = createLearnerMemoryGetHandler();
