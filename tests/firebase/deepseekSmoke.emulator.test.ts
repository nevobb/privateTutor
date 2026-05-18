import { beforeAll, describe, expect, it } from "vitest";
import type { AuthResult } from "../../src/server/auth/authTypes";
import { getActiveTutorProvider } from "../../src/server/tutor/providerRegistry";
import { getDeepSeekModel } from "../../src/server/tutor/deepseekConfig";
import { createWorkspace } from "../../src/server/workspaces/workspaceRepository";
import { createSession } from "../../src/server/workspaces/sessionRepository";
import {
  createMessagesGetHandler,
  createMessagesPostHandler,
} from "../../src/app/api/sessions/[sessionId]/messages/route";

const ENABLED = process.env.FIREBASE_DEEPSEEK_SMOKE_TEST === "1";
const describeSmoke = ENABLED ? describe : describe.skip;

const PROJECT_ID = "demo-private-tutor";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const FIRESTORE_BASE_URL = `http://${FIRESTORE_HOST}`;

function makeAuth(userId: string) {
  return async (_req: Request): Promise<AuthResult> => ({
    ok: true,
    user: { userId, email: `${userId}@test.example` },
  });
}

async function ensureFirestoreEmulatorReachable() {
  const res = await fetch(FIRESTORE_BASE_URL);
  if (!res.ok && res.status !== 404) {
    throw new Error(`Firestore emulator is not reachable at ${FIRESTORE_BASE_URL}`);
  }
}

async function clearFirestore() {
  const flushUrl = `${FIRESTORE_BASE_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const res = await fetch(flushUrl, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to clear Firestore emulator: ${res.status}`);
  }
}

describeSmoke("DeepSeek smoke test (real provider + route + persistence + isolation)", () => {
  beforeAll(async () => {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY missing. Smoke test requires a real DeepSeek key.");
    }
    await ensureFirestoreEmulatorReachable();
    await clearFirestore();
  }, 30000);

  it("uses DeepSeek provider and expected model mapping", () => {
    const provider = getActiveTutorProvider();
    expect(provider.name).toBe("deepseek");

    expect(getDeepSeekModel("Cheap Practice")).toBe("deepseek-chat");
    expect(getDeepSeekModel("Normal Learning")).toBe("deepseek-chat");
    expect(getDeepSeekModel("Deep Research")).toBe("deepseek-reasoner");
  });

  it("persists both user+tutor messages for 3 work/cost combinations", async () => {
    await clearFirestore();

    const workspace = await createWorkspace("alice", { name: "DeepSeek Smoke WS" });
    const session = await createSession("alice", workspace.id, { title: "DeepSeek Smoke Session" });

    const postHandler = createMessagesPostHandler(makeAuth("alice"));
    const getHandler = createMessagesGetHandler(makeAuth("alice"));

    const scenarios = [
      { userMessage: "Explain derivative in 2 lines", workMode: "Learning", costMode: "Normal Learning" },
      { userMessage: "Give one short calculus practice question", workMode: "Practice", costMode: "Cheap Practice" },
      { userMessage: "Compare derivative rules and common pitfalls", workMode: "Research", costMode: "Deep Research" },
    ] as const;

    for (const scenario of scenarios) {
      const req = new Request(`http://test/api/sessions/${session.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, ...scenario }),
      });

      const res = await postHandler(req, { params: Promise.resolve({ sessionId: session.id }) });
      expect(res.status).toBe(201);

      const body = (await res.json()) as {
        userMessage: { role: string; content: string };
        assistantMessage: { role: string; content: string };
      };

      expect(body.userMessage.role).toBe("user");
      expect(body.assistantMessage.role).toBe("tutor");
      expect(body.assistantMessage.content.trim().length).toBeGreaterThan(0);
    }

    const getReq = new Request(`http://test/api/sessions/${session.id}/messages?workspaceId=${workspace.id}`);
    const getRes = await getHandler(getReq, { params: Promise.resolve({ sessionId: session.id }) });
    expect(getRes.status).toBe(200);

    const getBody = (await getRes.json()) as { messages: { role: string }[] };
    expect(getBody.messages).toHaveLength(6);
    expect(getBody.messages.filter((m) => m.role === "user")).toHaveLength(3);
    expect(getBody.messages.filter((m) => m.role === "tutor")).toHaveLength(3);
  }, 240000);

  it("blocks cross-user access (GET=404, POST=404)", async () => {
    await clearFirestore();

    const workspace = await createWorkspace("alice", { name: "Isolation WS" });
    const session = await createSession("alice", workspace.id, { title: "Isolation Session" });

    const getHandler = createMessagesGetHandler(makeAuth("bob"));
    const getReq = new Request(`http://test/api/sessions/${session.id}/messages?workspaceId=${workspace.id}`);
    const getRes = await getHandler(getReq, { params: Promise.resolve({ sessionId: session.id }) });
    expect(getRes.status).toBe(404);

    const postHandler = createMessagesPostHandler(makeAuth("bob"));
    const postReq = new Request(`http://test/api/sessions/${session.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: workspace.id,
        userMessage: "Should fail",
        workMode: "Learning",
        costMode: "Normal Learning",
      }),
    });
    const postRes = await postHandler(postReq, { params: Promise.resolve({ sessionId: session.id }) });
    expect(postRes.status).toBe(404);
  });
});
