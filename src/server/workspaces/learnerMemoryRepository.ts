import { randomUUID } from "node:crypto";
import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import type { LearnerMemoryObservation } from "../../types";
import { toDate } from "./workspaceTypes";

export interface LearnerMemoryObservationRecord extends LearnerMemoryObservation {
  userId: string;
  updatedAt: Date;
}

export interface CreateLearnerMemoryObservationInput {
  type: NonNullable<LearnerMemoryObservation["type"]>;
  scope: NonNullable<LearnerMemoryObservation["scope"]>;
  workspaceId?: string;
  content: string;
  confidence: number;
  state: LearnerMemoryObservation["state"];
  source: LearnerMemoryObservation["source"];
  requiresApproval: boolean;
}

export interface UpdateLearnerMemoryObservationInput {
  content?: string;
  confidence?: number;
  state?: LearnerMemoryObservation["state"];
  requiresApproval?: boolean;
  type?: LearnerMemoryObservation["type"];
}

function learnerMemoryPath(userId: string, observationId: string): [string, string, string, string] {
  return ["users", userId, "learnerMemory", observationId];
}

export async function createLearnerMemoryObservation(
  userId: string,
  input: CreateLearnerMemoryObservationInput
): Promise<LearnerMemoryObservationRecord> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const id = randomUUID();
    const now = new Date();
    const record: LearnerMemoryObservationRecord = {
      id,
      userId,
      observation: input.content,
      timestamp: now,
      confidence: input.confidence,
      state: input.state,
      source: input.source,
      type: input.type,
      scope: input.scope,
      content: input.content,
      workspaceId: input.workspaceId,
      requiresApproval: input.requiresApproval,
      updatedAt: now,
    };

    await db.doc(learnerMemoryPath(userId, id).join("/")).set(compactRecord(record));
    return record;
  });
}

export async function listLearnerMemoryObservations(
  userId: string,
  workspaceId?: string
): Promise<LearnerMemoryObservationRecord[]> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.collection(`users/${userId}/learnerMemory`).orderBy("updatedAt", "desc").get();

    return snapshot.docs
      .map((item) => mapLearnerMemoryObservationRecord(item.id, item.data() as Record<string, unknown>))
      .filter((item) => item.userId === userId)
      .filter((item) => (workspaceId ? item.workspaceId === workspaceId || item.scope === "global" : true));
  });
}

export async function getLearnerMemoryObservation(
  userId: string,
  observationId: string
): Promise<LearnerMemoryObservationRecord | null> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.doc(learnerMemoryPath(userId, observationId).join("/")).get();
    if (!snapshot.exists) return null;
    const mapped = mapLearnerMemoryObservationRecord(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
    return mapped.userId === userId ? mapped : null;
  });
}

export async function updateLearnerMemoryObservation(
  userId: string,
  observationId: string,
  updates: UpdateLearnerMemoryObservationInput
): Promise<LearnerMemoryObservationRecord | null> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const ref = db.doc(learnerMemoryPath(userId, observationId).join("/"));
    const snapshot = await ref.get();
    if (!snapshot.exists) return null;

    const current = mapLearnerMemoryObservationRecord(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
    if (current.userId !== userId) return null;

    const next: LearnerMemoryObservationRecord = {
      ...current,
      observation: updates.content ?? current.observation,
      content: updates.content ?? current.content,
      confidence: updates.confidence ?? current.confidence,
      state: updates.state ?? current.state,
      requiresApproval: updates.requiresApproval ?? current.requiresApproval,
      type: updates.type ?? current.type,
      updatedAt: new Date(),
    };

    await ref.set(compactRecord(next));
    return next;
  });
}

export async function deleteLearnerMemoryObservation(userId: string, observationId: string): Promise<boolean> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const ref = db.doc(learnerMemoryPath(userId, observationId).join("/"));
    const snapshot = await ref.get();
    if (!snapshot.exists) return false;

    const current = mapLearnerMemoryObservationRecord(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
    if (current.userId !== userId) return false;

    await ref.delete();
    return true;
  });
}

function mapLearnerMemoryObservationRecord(
  id: string,
  data: Record<string, unknown>
): LearnerMemoryObservationRecord {
  const content = typeof data.content === "string" ? data.content : String(data.observation ?? "");
  const updatedAtRaw = data.updatedAt ?? data.timestamp;

  return {
    id,
    userId: String(data.userId ?? ""),
    observation: content,
    timestamp: toDate(data.timestamp),
    confidence: Number.isFinite(Number(data.confidence)) ? Number(data.confidence) : 0,
    state: (data.state as LearnerMemoryObservation["state"]) ?? "candidate",
    source: (data.source as LearnerMemoryObservation["source"]) ?? "conversation",
    type: data.type as LearnerMemoryObservation["type"],
    scope: data.scope as LearnerMemoryObservation["scope"],
    content,
    workspaceId: typeof data.workspaceId === "string" ? data.workspaceId : undefined,
    requiresApproval: typeof data.requiresApproval === "boolean" ? data.requiresApproval : undefined,
    appliesToWorkMode: data.appliesToWorkMode as LearnerMemoryObservation["appliesToWorkMode"],
    updatedAt: toDate(updatedAtRaw),
  };
}

function compactRecord(record: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>).filter(([, value]) => value !== undefined)
  );
}
