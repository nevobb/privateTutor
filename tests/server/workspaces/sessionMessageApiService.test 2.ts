import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

const SERVICE_FILE = resolve(process.cwd(), "src/server/workspaces/sessionMessageApiService.ts");
const hasFile = existsSync(SERVICE_FILE);
const describeService = hasFile ? describe : describe.skip;

type ServiceModule = {
  createSessionMessageApiService: (repos?: {
    getWorkspace: (userId: string, workspaceId: string) => Promise<Record<string, unknown> | null>;
    getSession: (userId: string, workspaceId: string, sessionId: string) => Promise<Record<string, unknown> | null>;
    listSessionMessages: (userId: string, workspaceId: string, sessionId: string) => Promise<Record<string, unknown>[]>;
    appendMessage: (userId: string, workspaceId: string, sessionId: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    getMockTutorResponse: (
      msg: string,
      wm: string,
      cm: string,
      history?: Array<{ role: string; content: string }>
    ) => Promise<{ message: { id: string; role: string; content: string }; internalUpdate: Record<string, unknown> }>;
  }) => {
    listMessagesForUser: (user: string, workspaceId: string, sessionId: string) => Promise<Record<string, unknown>[]>;
    sendMessageForUser: (user: string, sessionId: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
};

let mod: ServiceModule;

const baseMessage = {
  id: "m1",
  role: "user",
  content: "hi",
  userId: "alice",
  workspaceId: "ws-1",
  sessionId: "s-1",
  sequence: 1,
  createdAt: new Date(),
  status: "sent",
};
const tutorMessage = { ...baseMessage, id: "m2", role: "tutor", content: "response", sequence: 2 };
const tutorResponse = {
  message: { id: "m2", role: "tutor", content: "response" },
  internalUpdate: { detected_intent: "factual_or_regular" },
};

function makeRepos(
  overrides: Partial<Parameters<ServiceModule["createSessionMessageApiService"]>[0]> = {}
) {
  return {
    getWorkspace: vi.fn(async (uid: string, wsId: string) =>
      uid === "alice" && wsId === "ws-1" ? { id: "ws-1", userId: "alice" } : null
    ),
    getSession: vi.fn(async (uid: string, wsId: string, sessId: string) =>
      uid === "alice" && wsId === "ws-1" && sessId === "s-1"
        ? { id: "s-1", userId: "alice" }
        : null
    ),
    listSessionMessages: vi.fn(async () => [baseMessage]),
    appendMessage: vi.fn(
      async (_uid: string, _wsId: string, _sessId: string, input: Record<string, unknown>) =>
        input.role === "user" ? baseMessage : tutorMessage
    ),
    getMockTutorResponse: vi.fn(async () => tutorResponse),
    ...overrides,
  };
}

describeService("sessionMessageApiService", () => {
  beforeAll(async () => {
    mod = (await import("../../../src/server/workspaces/sessionMessageApiService")) as ServiceModule;
  });

  describe("listMessagesForUser", () => {
    it("returns messages when workspace and session owned", async () => {
      const repos = makeRepos();
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.listMessagesForUser("alice", "ws-1", "s-1");
      expect(repos.listSessionMessages).toHaveBeenCalledWith("alice", "ws-1", "s-1");
      expect(result).toHaveLength(1);
    });

    it("throws 'Workspace not found.' when workspace missing", async () => {
      const repos = makeRepos({ getWorkspace: vi.fn(async () => null) });
      const service = mod.createSessionMessageApiService(repos);
      await expect(service.listMessagesForUser("bob", "ws-1", "s-1")).rejects.toThrow(
        "Workspace not found."
      );
    });

    it("throws 'Session not found.' when session missing", async () => {
      const repos = makeRepos({ getSession: vi.fn(async () => null) });
      const service = mod.createSessionMessageApiService(repos);
      await expect(service.listMessagesForUser("alice", "ws-1", "missing")).rejects.toThrow(
        "Session not found."
      );
    });

    it("uses trusted userId from auth user object", async () => {
      const repos = makeRepos();
      const service = mod.createSessionMessageApiService(repos);
      await service.listMessagesForUser(
        { userId: "alice", email: "alice@test" } as never,
        "ws-1",
        "s-1"
      );
      expect(repos.getWorkspace).toHaveBeenCalledWith("alice", "ws-1");
    });
  });

  describe("sendMessageForUser", () => {
    it("appends user message, calls mock tutor, appends assistant message", async () => {
      const repos = makeRepos();
      const service = mod.createSessionMessageApiService(repos);
      const result = await service.sendMessageForUser("alice", "s-1", {
        workspaceId: "ws-1",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      });
      expect(repos.appendMessage).toHaveBeenCalledTimes(2);
      expect(repos.appendMessage).toHaveBeenNthCalledWith(
        1,
        "alice",
        "ws-1",
        "s-1",
        expect.objectContaining({ role: "user", content: "hi" })
      );
      expect(repos.getMockTutorResponse).toHaveBeenCalledWith("hi", "Learning", "Normal Learning", []);
      expect(repos.appendMessage).toHaveBeenNthCalledWith(
        2,
        "alice",
        "ws-1",
        "s-1",
        expect.objectContaining({ role: "tutor" })
      );
      expect(result).toHaveProperty("userMessage");
      expect(result).toHaveProperty("assistantMessage");
      expect(result).toHaveProperty("internalUpdate");
    });

    it("throws 'Workspace not found.' when workspace missing", async () => {
      const repos = makeRepos({ getWorkspace: vi.fn(async () => null) });
      const service = mod.createSessionMessageApiService(repos);
      await expect(
        service.sendMessageForUser("bob", "s-1", {
          workspaceId: "ws-1",
          userMessage: "hi",
          workMode: "Learning",
          costMode: "Normal Learning",
        })
      ).rejects.toThrow("Workspace not found.");
    });

    it("throws 'Session not found.' when session missing", async () => {
      const repos = makeRepos({ getSession: vi.fn(async () => null) });
      const service = mod.createSessionMessageApiService(repos);
      await expect(
        service.sendMessageForUser("alice", "missing", {
          workspaceId: "ws-1",
          userMessage: "hi",
          workMode: "Learning",
          costMode: "Normal Learning",
        })
      ).rejects.toThrow("Session not found.");
    });
  });
});
