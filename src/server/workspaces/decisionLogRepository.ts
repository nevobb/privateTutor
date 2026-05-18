import { randomUUID } from "node:crypto";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from "firebase/firestore/lite";
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
    const ref = doc(db, ...decisionLogPath(userId, entryId));

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

    await setDoc(ref, compactRecord(record));
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      return record;
    }

    return mapDecisionLog(snapshot.id, snapshot.data());
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
    const constraints = [];

    if (filters.workspaceId) {
      constraints.push(where("workspaceId", "==", filters.workspaceId));
    }
    if (filters.sessionId) {
      constraints.push(where("sessionId", "==", filters.sessionId));
    }

    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(filters.limit ?? 20));

    const ref = collection(db, "users", userId, "decisionLog");
    const snapshot = await getDocs(query(ref, ...constraints));
    return snapshot.docs.map((d) => mapDecisionLog(d.id, d.data()));
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
