import { resolveAuthenticatedUser } from "../../../server/auth/resolveAuthenticatedUser";
import { isFirestoreEmulatorUnavailableError } from "../../../server/firebase/firestoreEmulatorClient";
import { decisionLogApiService } from "../../../server/workspaces/decisionLogApiService";
import {
  parseDecisionLogQuery,
  toDecisionLogApiItem,
} from "../../../server/workspaces/decisionLogApiSchemas";
import type { AuthResult } from "../../../server/auth/authTypes";

type AuthResolver = (request: Request) => Promise<AuthResult>;

export function createDecisionLogGetHandler(authResolver: AuthResolver = resolveAuthenticatedUser) {
  return async function GET(request: Request): Promise<Response> {
    const authResult = await authResolver(request);
    if (!authResult.ok) {
      return Response.json(authResult.error, { status: authResult.status });
    }

    const validation = parseDecisionLogQuery(new URL(request.url).searchParams);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    try {
      const entries = await decisionLogApiService.listDecisionLogForUser(authResult.user, validation.input);
      return Response.json({ entries: entries.map(toDecisionLogApiItem) });
    } catch (error: unknown) {
      if (isFirestoreEmulatorUnavailableError(error)) {
        return Response.json({ error: "Firestore emulator is unavailable." }, { status: 503 });
      }
      return Response.json({ error: "Failed to list decision log entries." }, { status: 500 });
    }
  };
}

export const GET = createDecisionLogGetHandler();
