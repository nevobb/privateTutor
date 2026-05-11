import { randomUUID } from "node:crypto";
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
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
  await withFirestoreEmulatorClient(async ({ db }) => {
    const workspaceSnapshot = await getDoc(doc(db, ...workspacePath(userId, workspaceId)));
    if (!workspaceSnapshot.exists() || workspaceSnapshot.data().userId !== userId) {
      throw new Error("Workspace not found.");
    }

    const sessionSnapshot = await getDoc(doc(db, ...sessionPath(userId, workspaceId, sessionId)));
    if (!sessionSnapshot.exists() || sessionSnapshot.data().userId !== userId) {
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

  return withFirestoreEmulatorClient(async ({ db }) => {
    const messageId = randomUUID();
    const now = new Date();
    const sessionRef = doc(db, ...sessionPath(userId, workspaceId, sessionId));
    const workspaceRef = doc(db, ...workspacePath(userId, workspaceId));
    const messageRef = doc(db, ...messagePath(userId, workspaceId, sessionId, messageId));
    const sessionSnapshot = await getDoc(sessionRef);

    if (!sessionSnapshot.exists()) {
      throw new Error("Session not found.");
    }

    const existingCount = Number(sessionSnapshot.data().messageCount ?? 0);
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

    await setDoc(messageRef, compactRecord(record));
    await updateDoc(sessionRef, {
      updatedAt: now,
      lastMessageAt: now,
      messageCount: sequence,
    });
    await updateDoc(workspaceRef, {
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

  return withFirestoreEmulatorClient(async ({ db }) => {
    const messagesRef = collection(db, ...sessionPath(userId, workspaceId, sessionId), "messages");
    const snapshot = await getDocs(query(messagesRef, orderBy("sequence", "asc")));

    return snapshot.docs.map((entry) => mapMessageRecord(entry.id, entry.data()));
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
