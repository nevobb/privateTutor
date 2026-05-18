import type { DecisionLogEntryRecord } from "./workspaceTypes";

export interface DecisionLogQuery {
  workspaceId?: string;
  sessionId?: string;
  limit: number;
}

export interface DecisionLogApiItem {
  id: string;
  decisionType: string;
  title: string;
  decision: string;
  rationale: string;
  date: string;
  workspaceId?: string;
  sessionId?: string;
  createdAt: string;
}

export type DecisionLogQueryValidationResult =
  | { ok: true; input: DecisionLogQuery }
  | { ok: false; error: string };

export function parseDecisionLogQuery(searchParams: URLSearchParams): DecisionLogQueryValidationResult {
  const workspaceId = asTrimmedString(searchParams.get("workspaceId"));
  const sessionId = asTrimmedString(searchParams.get("sessionId"));
  const rawLimit = asTrimmedString(searchParams.get("limit"));
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : 20;

  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0 || parsedLimit > 100) {
    return { ok: false, error: "limit must be an integer between 1 and 100." };
  }

  return {
    ok: true,
    input: {
      workspaceId,
      sessionId,
      limit: parsedLimit,
    },
  };
}

export function toDecisionLogApiItem(record: DecisionLogEntryRecord): DecisionLogApiItem {
  return {
    id: record.id,
    decisionType: record.decisionType,
    title: record.title,
    decision: record.decision,
    rationale: record.rationale,
    date: record.date,
    workspaceId: record.workspaceId,
    sessionId: record.sessionId,
    createdAt: record.createdAt.toISOString(),
  };
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
