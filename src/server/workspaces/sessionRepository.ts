import { randomUUID } from "node:crypto";
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
  await withFirestoreEmulatorClient(userId, async ({ db }) => {
    const workspaceSnapshot = await db.doc(workspacePath(userId, workspaceId).join("/")).get();
    const data = workspaceSnapshot.data() as { userId?: string } | undefined;
    if (!workspaceSnapshot.exists || data?.userId !== userId) {
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

  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const sessionId = input.id && input.id.trim() ? input.id : randomUUID();
    const ref = db.doc(sessionPath(userId, workspaceId, sessionId).join("/"));
    const existing = await ref.get();

    if (existing.exists) {
      return mapSessionRecord(existing.id, existing.data() ?? {});
    }

    const now = new Date();
    const workMode = input.workMode ?? "Learning";
    const costMode = input.costMode ?? "Normal Learning";
    const activeTopic = typeof input.activeTopic === "string" && input.activeTopic.trim().length > 0
      ? input.activeTopic.trim()
      : undefined;
    const record: SessionRecord = {
      id: sessionId,
      userId,
      workspaceId,
      title: input.title ?? "Untitled session",
      summary: input.summary,
      workMode,
      costMode,
      activeTopic,
      status: input.status ?? "active",
      startedAt: now,
      lastActiveAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    await ref.set(
      compactRecord({
        ...record,
        createdAt: now,
        lastMessageAt: null,
      })
    );

    return record;
  });
}

export async function listSessions(userId: string, workspaceId: string): Promise<SessionRecord[]> {
  await assertWorkspaceOwnership(userId, workspaceId);

  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db
      .collection(`${workspacePath(userId, workspaceId).join("/")}/sessions`)
      .orderBy("updatedAt", "desc")
      .get();

    return snapshot.docs
      .filter((d) => (d.data() as { userId?: string }).userId === userId)
      .map((d) => mapSessionRecord(d.id, d.data() as Record<string, unknown>));
  });
}

export async function getSession(userId: string, workspaceId: string, sessionId: string): Promise<SessionRecord | null> {
  await assertWorkspaceOwnership(userId, workspaceId);

  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db.doc(sessionPath(userId, workspaceId, sessionId).join("/")).get();
    const data = snapshot.data() as { userId?: string } | undefined;
    if (!snapshot.exists || data?.userId !== userId) {
      return null;
    }
    return mapSessionRecord(snapshot.id, data as Record<string, unknown>);
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
    workMode: (data.workMode as SessionRecord["workMode"]) ?? "Learning",
    costMode: (data.costMode as SessionRecord["costMode"]) ?? "Normal Learning",
    activeTopic: typeof data.activeTopic === "string" ? data.activeTopic : undefined,
    status: (data.status as SessionRecord["status"]) ?? "active",
    startedAt: toDate(data.startedAt),
    lastActiveAt: data.lastActiveAt ? toDate(data.lastActiveAt) : toDate(data.updatedAt),
    updatedAt: toDate(data.updatedAt),
    messageCount: Number.isFinite(Number(data.messageCount)) ? Number(data.messageCount) : 0,
    lastMessageAt: data.lastMessageAt ? toDate(data.lastMessageAt) : undefined,
    summary: typeof data.summary === "string" ? data.summary : undefined,
  };
}
