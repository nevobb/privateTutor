import type { AuthResult } from "../../../../server/auth/authTypes";
import { resolveAuthenticatedUser } from "../../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../../server/firebase/firestoreEmulatorClient";
import { learnerMemoryApiService } from "../../../../server/workspaces/learnerMemoryApiService";
import {
  parseLearnerMemoryPatchRequest,
  toLearnerMemoryObservationApiItem,
} from "../../../../server/workspaces/learnerMemoryApiSchemas";

type AuthResolver = (request: Request) => Promise<AuthResult>;
type RouteContext = { params: Promise<{ observationId: string }> };

export function createLearnerMemoryPatchHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function PATCH(request: Request, context: RouteContext): Promise<Response> {
    const auth = await authResolver(request);
    if (!auth.ok) return Response.json(auth.error, { status: auth.status });

    const { observationId } = await context.params;
    if (!observationId || typeof observationId !== "string" || observationId.trim().length === 0) {
      return Response.json({ error: "Missing observation ID." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const validation = parseLearnerMemoryPatchRequest(body);
    if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });

    try {
      const updated = await learnerMemoryApiService.patchObservation(auth.user, observationId, validation.input);
      if (!updated) return Response.json({ error: "Observation not found." }, { status: 404 });
      return Response.json(toLearnerMemoryObservationApiItem(updated));
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }
      return Response.json({ error: "Failed to update learner memory." }, { status: 500 });
    }
  };
}

export function createLearnerMemoryDeleteHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function DELETE(request: Request, context: RouteContext): Promise<Response> {
    const auth = await authResolver(request);
    if (!auth.ok) return Response.json(auth.error, { status: auth.status });

    const { observationId } = await context.params;
    if (!observationId || typeof observationId !== "string" || observationId.trim().length === 0) {
      return Response.json({ error: "Missing observation ID." }, { status: 400 });
    }

    try {
      const deleted = await learnerMemoryApiService.deleteObservation(auth.user, observationId);
      if (!deleted) return Response.json({ error: "Observation not found." }, { status: 404 });
      return Response.json({ ok: true });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }
      return Response.json({ error: "Failed to delete learner memory." }, { status: 500 });
    }
  };
}

export const PATCH = createLearnerMemoryPatchHandler();
export const DELETE = createLearnerMemoryDeleteHandler();
