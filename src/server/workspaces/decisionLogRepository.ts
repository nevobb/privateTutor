import { randomUUID } from "node:crypto";
import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import type { DecisionLogEntryRecord, WriteDecisionLogEntryInput } from "./workspaceTypes";
import { toDate } from "./workspaceTypes";

export function decisionLogPath(userId: string, entryId: string): [string, string, string, string] {
  return ["users", userId, "decisionLog", entryId];
}

export async function writeDecisionLogEntry(
  userId: string,
  input: WriteDecisionLogEntryInput
): Promise<DecisionLogEntryRecord> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const entryId = randomUUID();
    const createdAt = new Date();
    const ref = db.doc(decisionLogPath(userId, entryId).join("/"));

    const record: DecisionLogEntryRecord = {
      id: entryId,
      userId,
      decisionType: input.decisionType,
      title: input.title,
      decision: input.decision,
      rationale: input.rationale,
      date: createdAt.toISOString(),
      relatedWorkspaceId: input.workspaceId,
      relatedSessionId: input.sessionId,
      createdAt,
      workspaceId: input.workspaceId,
      sessionId: input.sessionId,
    };

    await ref.set(compactRecord(record));
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return record;
    }

    return mapDecisionLog(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
  });
}

export async function appendDecisionLogEntry(
  userId: string,
  entry: Omit<DecisionLogEntryRecord, "id" | "createdAt">
): Promise<DecisionLogEntryRecord> {
  return writeDecisionLogEntry(userId, {
    decisionType: entry.decisionType,
    title: entry.title,
    decision: entry.decision,
    rationale: entry.rationale,
    workspaceId: entry.workspaceId,
    sessionId: entry.sessionId,
  });
}

export interface ListDecisionLogFilters {
  workspaceId?: string;
  sessionId?: string;
  limit?: number;
}

export async function listDecisionLogEntries(
  userId: string,
  filters: ListDecisionLogFilters = {}
): Promise<DecisionLogEntryRecord[]> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    let ref: FirebaseFirestore.Query = db.collection(`users/${userId}/decisionLog`);

    if (filters.workspaceId) {
      ref = ref.where("workspaceId", "==", filters.workspaceId);
    }
    if (filters.sessionId) {
      ref = ref.where("sessionId", "==", filters.sessionId);
    }

    ref = ref.orderBy("createdAt", "desc").limit(filters.limit ?? 20);

    const snapshot = await ref.get();
    return snapshot.docs.map((d) => mapDecisionLog(d.id, d.data() as Record<string, unknown>));
  });
}

function compactRecord(record: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>).filter(([, value]) => value !== undefined)
  );
}

function mapDecisionLog(id: string, data: Record<string, unknown>): DecisionLogEntryRecord {
  return {
    id,
    userId: String(data.userId ?? ""),
    decisionType: data.decisionType as DecisionLogEntryRecord["decisionType"],
    title: String(data.title ?? ""),
    decision: String(data.decision ?? ""),
    rationale: String(data.rationale ?? ""),
    date: typeof data.date === "string" ? data.date : toDate(data.createdAt).toISOString(),
    relatedSessionId: typeof data.relatedSessionId === "string" ? data.relatedSessionId : undefined,
    relatedWorkspaceId: typeof data.relatedWorkspaceId === "string" ? data.relatedWorkspaceId : undefined,
    createdAt: toDate(data.createdAt),
    workspaceId: typeof data.workspaceId === "string" ? data.workspaceId : undefined,
    sessionId: typeof data.sessionId === "string" ? data.sessionId : undefined,
  };
}
