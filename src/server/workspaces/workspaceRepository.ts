import { randomUUID } from "node:crypto";
import { collection, doc, getDocs, getDoc, orderBy, query, setDoc } from "firebase/firestore/lite";
import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import type { CreateWorkspaceInput, WorkspaceRecord } from "./workspaceTypes";
import { toDate } from "./workspaceTypes";

export function workspacePath(userId: string, workspaceId: string): [string, string, string, string] {
  return ["users", userId, "workspaces", workspaceId];
}

export async function createWorkspace(userId: string, input: CreateWorkspaceInput): Promise<WorkspaceRecord> {
  return withFirestoreEmulatorClient(async ({ db }) => {
    const workspaceId = randomUUID();
    const now = new Date();
    const ref = doc(db, ...workspacePath(userId, workspaceId));

    const record: WorkspaceRecord = {
      id: workspaceId,
      userId,
      name: input.name,
      description: input.description ?? "",
      path: input.path,
      parentWorkspaceId: input.parentWorkspaceId,
      stableIdentityNote: input.stableIdentityNote,
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };

    await setDoc(ref, compactRecord(record));
    return record;
  });
}

export async function createWorkspaceWithId(
  userId: string,
  workspaceId: string,
  input: CreateWorkspaceInput
): Promise<WorkspaceRecord> {
  return withFirestoreEmulatorClient(async ({ db }) => {
    const now = new Date();
    const ref = doc(db, ...workspacePath(userId, workspaceId));
    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {
      return mapWorkspaceRecord(snapshot.id, snapshot.data());
    }

    const record: WorkspaceRecord = {
      id: workspaceId,
      userId,
      name: input.name,
      description: input.description ?? "",
      path: input.path,
      parentWorkspaceId: input.parentWorkspaceId,
      stableIdentityNote: input.stableIdentityNote,
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };

    await setDoc(ref, compactRecord(record));
    return record;
  });
}

export async function listWorkspaces(userId: string): Promise<WorkspaceRecord[]> {
  return withFirestoreEmulatorClient(async ({ db }) => {
    const ref = collection(db, "users", userId, "workspaces");
    const snapshot = await getDocs(query(ref, orderBy("updatedAt", "desc")));
    return snapshot.docs
      .filter((d) => d.data().userId === userId)
      .map((d) => mapWorkspaceRecord(d.id, d.data()));
  });
}

export async function getWorkspace(userId: string, workspaceId: string): Promise<WorkspaceRecord | null> {
  return withFirestoreEmulatorClient(async ({ db }) => {
    const snapshot = await getDoc(doc(db, ...workspacePath(userId, workspaceId)));

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    if (data.userId !== userId) {
      return null;
    }

    return mapWorkspaceRecord(snapshot.id, data);
  });
}

function compactRecord(record: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>).filter(([, value]) => value !== undefined)
  );
}

function mapWorkspaceRecord(id: string, data: Record<string, unknown>): WorkspaceRecord {
  return {
    id,
    userId: String(data.userId ?? ""),
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    path: Array.isArray(data.path) ? data.path.map((item) => String(item)) : undefined,
    parentWorkspaceId: typeof data.parentWorkspaceId === "string" ? data.parentWorkspaceId : undefined,
    stableIdentityNote: typeof data.stableIdentityNote === "string" ? data.stableIdentityNote : undefined,
    status: (data.status as WorkspaceRecord["status"]) ?? "active",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    lastSessionId: typeof data.lastSessionId === "string" ? data.lastSessionId : undefined,
    lastActivityAt: data.lastActivityAt ? toDate(data.lastActivityAt) : undefined,
  };
}
