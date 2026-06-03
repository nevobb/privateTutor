import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const SCHEMAS_FILE = resolve(process.cwd(), "src/server/workspaces/sessionMessageApiSchemas.ts");
const hasFile = existsSync(SCHEMAS_FILE);
const describeSchemas = hasFile ? describe : describe.skip;

type SchemasModule = {
  parsePostMessageRequest: (body: unknown) => { ok: boolean; input?: Record<string, unknown>; error?: string };
  parseGetMessagesQuery: (p: URLSearchParams) => { ok: boolean; input?: Record<string, unknown>; error?: string };
  serializeMessage: (record: Record<string, unknown>) => Record<string, unknown>;
};

let mod: SchemasModule;

describeSchemas("sessionMessageApiSchemas", () => {
  beforeAll(async () => {
    mod = (await import("../../../src/server/workspaces/sessionMessageApiSchemas")) as unknown as SchemasModule;
  });

  describe("parsePostMessageRequest", () => {
    it("returns ok with valid input", () => {
      const result = mod.parsePostMessageRequest({
        workspaceId: "ws-1",
        userMessage: "Hello",
        workMode: "Learning",
        costMode: "Normal Learning",
      });
      expect(result.ok).toBe(true);
      expect(result.input).toMatchObject({
        workspaceId: "ws-1",
        userMessage: "Hello",
        workMode: "Learning",
        costMode: "Normal Learning",
      });
    });

    it("trims whitespace from workspaceId and userMessage", () => {
      const result = mod.parsePostMessageRequest({
        workspaceId: "  ws-1  ",
        userMessage: "  Hi  ",
        workMode: "Practice",
        costMode: "Cheap Practice",
      });
      expect(result.ok).toBe(true);
      expect((result.input as Record<string, string>).workspaceId).toBe("ws-1");
      expect((result.input as Record<string, string>).userMessage).toBe("Hi");
    });

    it("rejects non-object body", () => {
      expect(mod.parsePostMessageRequest("nope")).toMatchObject({ ok: false });
      expect(mod.parsePostMessageRequest(null)).toMatchObject({ ok: false });
      expect(mod.parsePostMessageRequest([])).toMatchObject({ ok: false });
    });

    it("rejects missing workspaceId", () => {
      const result = mod.parsePostMessageRequest({
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Normal Learning",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/workspaceId/);
    });

    it("rejects missing userMessage", () => {
      const result = mod.parsePostMessageRequest({
        workspaceId: "ws",
        workMode: "Learning",
        costMode: "Normal Learning",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/userMessage/);
    });

    it("rejects invalid workMode", () => {
      const result = mod.parsePostMessageRequest({
        workspaceId: "ws",
        userMessage: "hi",
        workMode: "HackerMode",
        costMode: "Normal Learning",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/workMode/);
    });

    it("rejects invalid costMode", () => {
      const result = mod.parsePostMessageRequest({
        workspaceId: "ws",
        userMessage: "hi",
        workMode: "Learning",
        costMode: "Turbo",
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/costMode/);
    });

    it("normalizes attachedFileIds by trimming and de-duplicating", () => {
      const result = mod.parsePostMessageRequest({
        workspaceId: "ws-1",
        userMessage: "Hello",
        workMode: "Learning",
        costMode: "Normal Learning",
        attachedFileIds: [" file-1 ", "file-2", "file-1"],
      });
      expect(result.ok).toBe(true);
      expect((result.input as Record<string, unknown>).attachedFileIds).toEqual(["file-1", "file-2"]);
    });

    it("normalizes an empty attachedFileIds array to undefined", () => {
      const result = mod.parsePostMessageRequest({
        workspaceId: "ws-1",
        userMessage: "Hello",
        workMode: "Learning",
        costMode: "Normal Learning",
        attachedFileIds: [],
      });
      expect(result.ok).toBe(true);
      expect((result.input as Record<string, unknown>).attachedFileIds).toBeUndefined();
    });

    it("rejects non-string attachedFileIds", () => {
      const result = mod.parsePostMessageRequest({
        workspaceId: "ws-1",
        userMessage: "Hello",
        workMode: "Learning",
        costMode: "Normal Learning",
        attachedFileIds: ["file-1", 3],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/attachedFileIds/);
    });

    it("rejects empty-string attachedFileIds", () => {
      const result = mod.parsePostMessageRequest({
        workspaceId: "ws-1",
        userMessage: "Hello",
        workMode: "Learning",
        costMode: "Normal Learning",
        attachedFileIds: ["file-1", "   "],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/attachedFileIds/);
    });

    it("rejects too many attachedFileIds", () => {
      const result = mod.parsePostMessageRequest({
        workspaceId: "ws-1",
        userMessage: "Hello",
        workMode: "Learning",
        costMode: "Normal Learning",
        attachedFileIds: ["f1", "f2", "f3", "f4", "f5", "f6"],
      });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/attachedFileIds/);
    });
  });

  describe("parseGetMessagesQuery", () => {
    it("returns ok with workspaceId param", () => {
      const p = new URLSearchParams({ workspaceId: "ws-1" });
      expect(mod.parseGetMessagesQuery(p)).toMatchObject({ ok: true, input: { workspaceId: "ws-1" } });
    });

    it("rejects missing workspaceId", () => {
      const p = new URLSearchParams({});
      expect(mod.parseGetMessagesQuery(p)).toMatchObject({ ok: false });
    });
  });

  describe("serializeMessage", () => {
    it("returns id, role, content and excludes internal fields", () => {
      const record = {
        id: "m-1",
        role: "user",
        content: "hello",
        attachedFileIds: ["file-1"],
        userId: "alice",
        workspaceId: "ws-1",
        sessionId: "sess-1",
        sequence: 1,
        createdAt: new Date(),
        status: "sent",
      };
      const result = mod.serializeMessage(record);
      expect(result).toMatchObject({ id: "m-1", role: "user", content: "hello", attachedFileIds: ["file-1"] });
      expect(result).not.toHaveProperty("userId");
      expect(result).not.toHaveProperty("sequence");
    });
  });
});
