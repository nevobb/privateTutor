import type { AuthenticatedUser } from "../auth/authTypes";
import { listDecisionLogEntries } from "./decisionLogRepository";
import type { DecisionLogEntryRecord } from "./workspaceTypes";
import type { DecisionLogQuery } from "./decisionLogApiSchemas";

export interface DecisionLogApiService {
  listDecisionLogForUser(user: AuthenticatedUser, query: DecisionLogQuery): Promise<DecisionLogEntryRecord[]>;
}

interface Repositories {
  listDecisionLogEntries: typeof listDecisionLogEntries;
}

function defaultRepositories(): Repositories {
  return { listDecisionLogEntries };
}

export function createDecisionLogApiService(
  repositories: Repositories = defaultRepositories()
): DecisionLogApiService {
  return {
    async listDecisionLogForUser(user, query) {
      return repositories.listDecisionLogEntries(user.userId, {
        workspaceId: query.workspaceId,
        sessionId: query.sessionId,
        limit: query.limit,
      });
    },
  };
}

export const decisionLogApiService: DecisionLogApiService = createDecisionLogApiService();
