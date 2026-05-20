import { randomUUID } from "node:crypto";
import { withFirestoreEmulatorClient } from "../firebase/firestoreEmulatorClient";
import type { AppendMessageInput, MessageRecord } from "./workspaceTypes";
import { toDate } from "./workspaceTypes";
import { sessionPath } from "./sessionRepository";
import { workspacePath } from "./workspaceRepository";

function messagePath(
  userId: string,
  workspaceId: string,
  sessionId: string,
  messageId: string
): [string, string, string, string, string, string, string, string] {
  return [...sessionPath(userId, workspaceId, sessionId), "messages", messageId];
}

async function assertSessionOwnership(userId: string, workspaceId: string, sessionId: string): Promise<void> {
  await withFirestoreEmulatorClient(userId, async ({ db }) => {
    const workspaceSnapshot = await db.doc(workspacePath(userId, workspaceId).join("/")).get();
    const workspaceData = workspaceSnapshot.data() as { userId?: string } | undefined;
    if (!workspaceSnapshot.exists || workspaceData?.userId !== userId) {
      throw new Error("Workspace not found.");
    }

    const sessionSnapshot = await db.doc(sessionPath(userId, workspaceId, sessionId).join("/")).get();
    const sessionData = sessionSnapshot.data() as { userId?: string } | undefined;
    if (!sessionSnapshot.exists || sessionData?.userId !== userId) {
      throw new Error("Session not found.");
    }
  });
}

export async function appendMessage(
  userId: string,
  workspaceId: string,
  sessionId: string,
  input: AppendMessageInput
): Promise<MessageRecord> {
  await assertSessionOwnership(userId, workspaceId, sessionId);

  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const messageId = randomUUID();
    const now = new Date();
    const sessionRef = db.doc(sessionPath(userId, workspaceId, sessionId).join("/"));
    const workspaceRef = db.doc(workspacePath(userId, workspaceId).join("/"));
    const messageRef = db.doc(messagePath(userId, workspaceId, sessionId, messageId).join("/"));
    const sessionSnapshot = await sessionRef.get();

    if (!sessionSnapshot.exists) {
      throw new Error("Session not found.");
    }

    const existingCount = Number((sessionSnapshot.data() as { messageCount?: number }).messageCount ?? 0);
    const sequence = Number.isFinite(existingCount) ? existingCount + 1 : 1;

    const record: MessageRecord = {
      id: messageId,
      userId,
      workspaceId,
      sessionId,
      role: input.role,
      content: input.content,
      citations: input.citations,
      sequence,
      createdAt: now,
      status: input.status ?? "sent",
      toolName: input.toolName,
      toolCallId: input.toolCallId,
    };

    await messageRef.set(compactRecord(record));
    await sessionRef.update({
      updatedAt: now,
      lastMessageAt: now,
      messageCount: sequence,
    });
    await workspaceRef.update({
      updatedAt: now,
      lastActivityAt: now,
      lastSessionId: sessionId,
    });

    return record;
  });
}

function compactRecord(record: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record as Record<string, unknown>).filter(([, value]) => value !== undefined)
  );
}

export async function listSessionMessages(userId: string, workspaceId: string, sessionId: string): Promise<MessageRecord[]> {
  await assertSessionOwnership(userId, workspaceId, sessionId);

  return withFirestoreEmulatorClient(userId, async ({ db }) => {
    const snapshot = await db
      .collection(`${sessionPath(userId, workspaceId, sessionId).join("/")}/messages`)
      .orderBy("sequence", "asc")
      .get();

    return snapshot.docs.map((entry) => mapMessageRecord(entry.id, entry.data() as Record<string, unknown>));
  });
}

function mapMessageRecord(id: string, data: Record<string, unknown>): MessageRecord {
  return {
    id,
    role: data.role === "tutor" ? "tutor" : "user",
    content: String(data.content ?? ""),
    citations: Array.isArray(data.citations) ? (data.citations as MessageRecord["citations"]) : undefined,
    userId: String(data.userId ?? ""),
    workspaceId: String(data.workspaceId ?? ""),
    sessionId: String(data.sessionId ?? ""),
    sequence: Number.isFinite(Number(data.sequence)) ? Number(data.sequence) : 0,
    createdAt: toDate(data.createdAt),
    status: (data.status as MessageRecord["status"]) ?? "sent",
    toolName: typeof data.toolName === "string" ? data.toolName : undefined,
    toolCallId: typeof data.toolCallId === "string" ? data.toolCallId : undefined,
  };
}
