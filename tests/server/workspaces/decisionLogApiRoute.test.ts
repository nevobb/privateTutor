import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../../../src/server/auth/authTypes";

vi.mock("../../../src/server/workspaces/decisionLogApiService", () => ({
  decisionLogApiService: {
    listDecisionLogForUser: vi.fn(),
  },
}));

vi.mock("../../../src/server/workspaces/decisionLogApiSchemas", () => ({
  parseDecisionLogQuery: vi.fn(),
  toDecisionLogApiItem: vi.fn((r: unknown) => r),
}));

vi.mock("../../../src/server/firebase/firestoreEmulatorClient", () => ({
  isFirestoreEmulatorUnavailableError: vi.fn(() => false),
}));

import { createDecisionLogGetHandler } from "../../../src/app/api/decision-log/route";
import { decisionLogApiService } from "../../../src/server/workspaces/decisionLogApiService";
import {
  parseDecisionLogQuery,
  toDecisionLogApiItem,
} from "../../../src/server/workspaces/decisionLogApiSchemas";
import { isFirestoreEmulatorUnavailableError } from "../../../src/server/firebase/firestoreEmulatorClient";

const mockList = vi.mocked(decisionLogApiService.listDecisionLogForUser);
const mockParseQuery = vi.mocked(parseDecisionLogQuery);
const mockSerialize = vi.mocked(toDecisionLogApiItem);
const mockIsUnavailable = vi.mocked(isFirestoreEmulatorUnavailableError);

const okAuth =
  (userId = "alice"): ((req: Request) => Promise<AuthResult>) =>
  async () => ({ ok: true, user: { userId, email: `${userId}@test.example` } });

const failAuth =
  (): ((req: Request) => Promise<AuthResult>) =>
  async () => ({ ok: false, status: 401, error: { error: "Unauthorized." } });

beforeEach(() => {
  vi.clearAllMocks();
  mockIsUnavailable.mockReturnValue(false);
});

describe("GET /api/decision-log", () => {
  it("returns 401 when auth fails", async () => {
    const handler = createDecisionLogGetHandler(failAuth());
    const req = new Request("http://test/api/decision-log");
    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when query validation fails", async () => {
    mockParseQuery.mockReturnValueOnce({ ok: false, error: "bad query" });
    const handler = createDecisionLogGetHandler(okAuth());
    const req = new Request("http://test/api/decision-log?limit=999");
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it("returns 503 when firestore emulator is unavailable", async () => {
    mockParseQuery.mockReturnValueOnce({ ok: true, input: { workspaceId: "ws-1", limit: 20 } });
    mockList.mockRejectedValueOnce(new Error("unavailable"));
    mockIsUnavailable.mockReturnValueOnce(true);
    const handler = createDecisionLogGetHandler(okAuth());
    const req = new Request("http://test/api/decision-log?workspaceId=ws-1");
    const res = await handler(req);
    expect(res.status).toBe(503);
  });

  it("returns 500 on unknown errors", async () => {
    mockParseQuery.mockReturnValueOnce({ ok: true, input: { workspaceId: "ws-1", limit: 20 } });
    mockList.mockRejectedValueOnce(new Error("boom"));
    const handler = createDecisionLogGetHandler(okAuth());
    const req = new Request("http://test/api/decision-log?workspaceId=ws-1");
    const res = await handler(req);
    expect(res.status).toBe(500);
  });

  it("returns 200 with serialized entries", async () => {
    mockParseQuery.mockReturnValueOnce({
      ok: true,
      input: { workspaceId: "ws-1", sessionId: "s-1", limit: 10 },
    });
    const entry = {
      id: "d1",
      decisionType: "model_provider",
      title: "Harness classification applied",
      decision: "Parsed JSON",
      rationale: "Event type: harness_classification",
      date: new Date().toISOString(),
      createdAt: new Date(),
    };
    mockList.mockResolvedValueOnce([entry] as never);
    mockSerialize.mockReturnValueOnce({ ...entry, createdAt: new Date().toISOString() } as never);

    const handler = createDecisionLogGetHandler(okAuth());
    const req = new Request("http://test/api/decision-log?workspaceId=ws-1&sessionId=s-1&limit=10");
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: unknown[] };
    expect(body.entries).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "alice" }),
      expect.objectContaining({ workspaceId: "ws-1", sessionId: "s-1", limit: 10 })
    );
  });
});
