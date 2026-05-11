import { randomUUID } from "node:crypto";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import type { CreateSessionInput, SessionRecord } from "./workspaceTypes";
import { toDate } from "./workspaceTypes";
import { workspacePath } from "./workspaceRepository";

export function sessionPath(
  userId: string,
  workspaceId: string,
  sessionId: string
): [string, string, string, string, string, string] {
  return [...workspacePath(userId, workspaceId), "sessions", sessionId];
}

async function assertWorkspaceOwnership(userId: string, workspaceId: string): Promise<void> {
  await withFirestoreEmulatorClient(async ({ db }) => {
    const workspaceSnapshot = await getDoc(doc(db, ...workspacePath(userId, workspaceId)));
    if (!workspaceSnapshot.exists() || workspaceSnapshot.data().userId !== userId) {
      throw new Error("Workspace not found.");
    }
  });
}

export async function createSession(
  userId: string,
  workspaceId: string,
  input: CreateSessionInput = {}
): Promise<SessionRecord> {
  await assertWorkspaceOwnership(userId, workspaceId);

  return withFirestoreEmulatorClient(async ({ db }) => {
    const sessionId = input.id && input.id.trim() ? input.id : randomUUID();
    const ref = doc(db, ...sessionPath(userId, workspaceId, sessionId));
    const existing = await getDoc(ref);

    if (existing.exists()) {
      return mapSessionRecord(existing.id, existing.data());
    }

    const now = new Date();
    const record: SessionRecord = {
      id: sessionId,
      userId,
      workspaceId,
      title: input.title ?? "Untitled session",
      summary: input.summary,
      status: input.status ?? "active",
      startedAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    await setDoc(
      ref,
      compactRecord({
        ...record,
        createdAt: now,
        lastMessageAt: null,
      })
    );

    return record;
  });
}

export async function getSession(userId: string, workspaceId: string, sessionId: string): Promise<SessionRecord | null> {
  await assertWorkspaceOwnership(userId, workspaceId);

  return withFirestoreEmulatorClient(async ({ db }) => {
    const snapshot = await getDoc(doc(db, ...sessionPath(userId, workspaceId, sessionId)));
    if (!snapshot.exists() || snapshot.data().userId !== userId) {
      return null;
    }
    return mapSessionRecord(snapshot.id, snapshot.data());
  });
}

function compactRecord(record: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>).filter(([, value]) => value !== undefined)
  );
}

function mapSessionRecord(id: string, data: Record<string, unknown>): SessionRecord {
  return {
    id,
    userId: String(data.userId ?? ""),
    workspaceId: String(data.workspaceId ?? ""),
    title: String(data.title ?? ""),
    status: (data.status as SessionRecord["status"]) ?? "active",
    startedAt: toDate(data.startedAt),
    updatedAt: toDate(data.updatedAt),
    messageCount: Number.isFinite(Number(data.messageCount)) ? Number(data.messageCount) : 0,
    lastMessageAt: data.lastMessageAt ? toDate(data.lastMessageAt) : undefined,
    summary: typeof data.summary === "string" ? data.summary : undefined,
  };
}
