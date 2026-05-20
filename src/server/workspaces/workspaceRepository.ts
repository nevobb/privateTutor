import { randomUUID } from "node:crypto";
import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import type { CreateWorkspaceInput, WorkspaceRecord } from "./workspaceTypes";
import { toDate } from "./workspaceTypes";

export function workspacePath(userId: string, workspaceId: string): [string, string, string, string] {
  return ["users", userId, "workspaces", workspaceId];
}

export async function createWorkspace(userId: string, input: CreateWorkspaceInput): Promise<WorkspaceRecord> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const workspaceId = randomUUID();
    const now = new Date();
    const ref = db.doc(workspacePath(userId, workspaceId).join("/"));

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

    await ref.set(compactRecord(record));
    return record;
  });
}

export async function createWorkspaceWithId(
  userId: string,
  workspaceId: string,
  input: CreateWorkspaceInput
): Promise<WorkspaceRecord> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const now = new Date();
    const ref = db.doc(workspacePath(userId, workspaceId).join("/"));
    const snapshot = await ref.get();

    if (snapshot.exists) {
      return mapWorkspaceRecord(snapshot.id, snapshot.data() ?? {});
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

    await ref.set(compactRecord(record));
    return record;
  });
}

export async function listWorkspaces(userId: string): Promise<WorkspaceRecord[]> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db
      .collection(`users/${userId}/workspaces`)
      .orderBy("updatedAt", "desc")
      .get();

    return snapshot.docs
      .filter((d) => {
        const data = d.data() as Record<string, unknown>;
        return getOwnerUserId(data) === userId;
      })
      .map((d) => mapWorkspaceRecord(d.id, d.data() as Record<string, unknown>));
  });
}

export async function getWorkspace(userId: string, workspaceId: string): Promise<WorkspaceRecord | null> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.doc(workspacePath(userId, workspaceId).join("/")).get();

    if (!snapshot.exists) {
      return null;
    }

    const data = (snapshot.data() ?? {}) as Record<string, unknown>;
    if (getOwnerUserId(data) !== userId) {
      return null;
    }

    return mapWorkspaceRecord(snapshot.id, data);
  });
}

export interface MoveWorkspaceInput {
  currentPath: string;
  parentWorkspaceId?: string;
  stableIdentityNote?: string;
}

export async function moveWorkspace(
  userId: string,
  workspaceId: string,
  input: MoveWorkspaceInput
): Promise<WorkspaceRecord | null> {
  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const ref = db.doc(workspacePath(userId, workspaceId).join("/"));
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return null;
    }

    const current = (snapshot.data() ?? {}) as Record<string, unknown>;
    const ownerId =
      typeof current.userId === "string"
        ? current.userId
        : typeof current.user_id === "string"
          ? current.user_id
          : "";

    if (ownerId !== userId) {
      return null;
    }

    const now = new Date();
    const existingRecord = mapWorkspaceRecord(snapshot.id, current);
    const currentPath = typeof current.currentPath === "string" ? current.currentPath : undefined;
    const previousPaths = Array.isArray(current.previousPaths)
      ? current.previousPaths.filter((entry) => typeof entry === "string").map((entry) => String(entry))
      : [];

    if (currentPath && currentPath !== input.currentPath && !previousPaths.includes(currentPath)) {
      previousPaths.push(currentPath);
    }

    const legacyPath = input.currentPath
      .split("/")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    const nextRecord: WorkspaceRecord = {
      ...existingRecord,
      id: snapshot.id,
      userId: ownerId,
      path: legacyPath.length > 0 ? legacyPath : undefined,
      currentPath: input.currentPath,
      previousPaths: previousPaths.length > 0 ? previousPaths : undefined,
      parentWorkspaceId: input.parentWorkspaceId ?? existingRecord.parentWorkspaceId,
      stableIdentityNote: input.stableIdentityNote ?? existingRecord.stableIdentityNote,
      updatedAt: now,
      lastActivityAt: now,
    };

    await ref.set(compactRecord(nextRecord));
    return nextRecord;
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
    userId: getOwnerUserId(data),
    name: String(data.name ?? ""),
    description: String(data.description ?? ""),
    path: Array.isArray(data.path) ? data.path.map((item) => String(item)) : undefined,
    currentPath: typeof data.currentPath === "string" ? data.currentPath : undefined,
    previousPaths: Array.isArray(data.previousPaths)
      ? data.previousPaths.map((item) => String(item))
      : undefined,
    parentWorkspaceId: typeof data.parentWorkspaceId === "string" ? data.parentWorkspaceId : undefined,
    stableIdentityNote: typeof data.stableIdentityNote === "string" ? data.stableIdentityNote : undefined,
    status: (data.status as WorkspaceRecord["status"]) ?? "active",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    lastSessionId: typeof data.lastSessionId === "string" ? data.lastSessionId : undefined,
    lastActivityAt: data.lastActivityAt ? toDate(data.lastActivityAt) : undefined,
  };
}

function getOwnerUserId(data: Record<string, unknown>): string {
  if (typeof data.userId === "string") return data.userId;
  if (typeof data.user_id === "string") return data.user_id;
  return "";
}
