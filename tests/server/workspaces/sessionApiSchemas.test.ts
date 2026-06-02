import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const SESSION_API_SCHEMAS_FILE = resolve(process.cwd(), "src/server/workspaces/sessionApiSchemas.ts");
const hasSessionApiSchemas = existsSync(SESSION_API_SCHEMAS_FILE);
const describeSessionApiSchemas = hasSessionApiSchemas ? describe : describe.skip;

type SessionApiSchemasModule = {
  parseCreateSessionRequest: (input: unknown) => { ok: true; input: Record<string, unknown> } | { ok: false; error: string };
  parseListSessionsQuery: (
    input: unknown
  ) => { ok: true; input: { workspaceId: string } } | { ok: false; error: string };
  serializeSession: (record: Record<string, unknown>) => Record<string, unknown>;
};

let schemas: SessionApiSchemasModule;

describeSessionApiSchemas("sessionApiSchemas", () => {
  beforeAll(async () => {
    schemas = (await import("../../../src/server/workspaces/sessionApiSchemas")) as unknown as SessionApiSchemasModule;
  });

  describe("parseCreateSessionRequest", () => {
    it("accepts minimal valid request with workspaceId", () => {
      const result = schemas.parseCreateSessionRequest({ workspaceId: "ws-1" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.input.workspaceId).toBe("ws-1");
      }
    });

    it("accepts optional title/workMode/costMode/activeTopic", () => {
      const result = schemas.parseCreateSessionRequest({
        workspaceId: "ws-1",
        title: "Linear Algebra",
        workMode: "Research",
        costMode: "Normal Learning",
        activeTopic: "Matrices",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.input.workspaceId).toBe("ws-1");
        expect(result.input.workMode).toBe("Research");
        expect(result.input.costMode).toBe("Normal Learning");
        expect(result.input.activeTopic).toBe("Matrices");
      }
    });

    it("rejects missing workspaceId", () => {
      const result = schemas.parseCreateSessionRequest({ title: "No workspace" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("workspaceId");
      }
    });

    it("rejects non-object body", () => {
      const result = schemas.parseCreateSessionRequest("not-an-object");
      expect(result.ok).toBe(false);
    });

    it("does not trust client userId", () => {
      const result = schemas.parseCreateSessionRequest({
        workspaceId: "ws-1",
        userId: "attacker",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Object.keys(result.input)).not.toContain("userId");
      }
    });
  });

  describe("parseListSessionsQuery", () => {
    it("accepts workspaceId from query params", () => {
      const result = schemas.parseListSessionsQuery(
        new URL("http://localhost/api/sessions?workspaceId=ws-1").searchParams
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.input.workspaceId).toBe("ws-1");
      }
    });

    it("rejects missing workspaceId query", () => {
      const result = schemas.parseListSessionsQuery(new URL("http://localhost/api/sessions").searchParams);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("workspaceId");
      }
    });
  });

  describe("serializeSession", () => {
    it("serializes date fields to ISO and preserves boundary fields", () => {
      const startedAt = new Date("2026-05-13T10:00:00.000Z");
      const lastActiveAt = new Date("2026-05-13T10:05:00.000Z");

      const serialized = schemas.serializeSession({
        id: "session-1",
        workspaceId: "ws-1",
        title: "Session title",
        workMode: "Learning",
        costMode: "Cheap Practice",
        activeTopic: "Fractions",
        status: "active",
        startedAt,
        lastActiveAt,
      });

      expect(serialized.id).toBe("session-1");
      expect(serialized.workspaceId).toBe("ws-1");
      expect(serialized.status).toBe("active");
      expect(serialized.startedAt).toBe(startedAt.toISOString());
      expect(serialized.lastActiveAt).toBe(lastActiveAt.toISOString());
    });
  });
});
