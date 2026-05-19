import { randomUUID } from "node:crypto";
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc } from "firebase/firestore/lite";
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

    await setDoc(doc(db, ...learnerMemoryPath(userId, id)), compactRecord(record));
    return record;
  });
}

export async function listLearnerMemoryObservations(
  userId: string,
  workspaceId?: string
): Promise<LearnerMemoryObservationRecord[]> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const ref = collection(db, "users", userId, "learnerMemory");
    const snapshot = await getDocs(query(ref, orderBy("updatedAt", "desc")));

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
    const snapshot = await getDoc(doc(db, ...learnerMemoryPath(userId, observationId)));
    if (!snapshot.exists()) return null;
    const mapped = mapLearnerMemoryObservationRecord(snapshot.id, snapshot.data() as Record<string, unknown>);
    return mapped.userId === userId ? mapped : null;
  });
}

export async function updateLearnerMemoryObservation(
  userId: string,
  observationId: string,
  updates: UpdateLearnerMemoryObservationInput
): Promise<LearnerMemoryObservationRecord | null> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const ref = doc(db, ...learnerMemoryPath(userId, observationId));
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;

    const current = mapLearnerMemoryObservationRecord(snapshot.id, snapshot.data() as Record<string, unknown>);
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

    await setDoc(ref, compactRecord(next));
    return next;
  });
}

export async function deleteLearnerMemoryObservation(userId: string, observationId: string): Promise<boolean> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const ref = doc(db, ...learnerMemoryPath(userId, observationId));
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return false;
    const mapped = mapLearnerMemoryObservationRecord(snapshot.id, snapshot.data() as Record<string, unknown>);
    if (mapped.userId !== userId) return false;
    await deleteDoc(ref);
    return true;
  });
}

function mapLearnerMemoryObservationRecord(
  id: string,
  data: Record<string, unknown>
): LearnerMemoryObservationRecord {
  const content = typeof data.content === "string" ? data.content : typeof data.observation === "string" ? data.observation : "";
  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : "",
    observation: content,
    timestamp: toDate(data.timestamp),
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
    state: mapState(data.state),
    source: mapSource(data.source),
    type: mapType(data.type),
    scope: mapScope(data.scope),
    content,
    workspaceId: typeof data.workspaceId === "string" ? data.workspaceId : undefined,
    requiresApproval: Boolean(data.requiresApproval),
    updatedAt: toDate(data.updatedAt),
  };
}

function mapState(value: unknown): LearnerMemoryObservation["state"] {
  if (
    value === "candidate" ||
    value === "active" ||
    value === "tentative" ||
    value === "superseded" ||
    value === "archived" ||
    value === "deleted"
  ) {
    return value;
  }
  return "candidate";
}

function mapSource(value: unknown): LearnerMemoryObservation["source"] {
  if (
    value === "conversation" ||
    value === "user-correction" ||
    value === "behavior-test" ||
    value === "manual" ||
    value === "user_explicit" ||
    value === "model_inferred" ||
    value === "repeated_pattern"
  ) {
    return value;
  }
  return "model_inferred";
}

function mapType(value: unknown): LearnerMemoryObservation["type"] {
  if (
    value === "preference" ||
    value === "difficulty" ||
    value === "correction" ||
    value === "explanation_pattern" ||
    value === "pacing" ||
    value === "behavior_rule"
  ) {
    return value;
  }
  return "preference";
}

function mapScope(value: unknown): LearnerMemoryObservation["scope"] {
  if (value === "global" || value === "workspace" || value === "topic" || value === "session") {
    return value;
  }
  return "workspace";
}

function compactRecord(record: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record as Record<string, unknown>).filter(([, value]) => value !== undefined));
}
