import { describe, expect, it } from "vitest";
import { parseDeleteSessionRequest } from "../../../src/server/workspaces/sessionApiSchemas";

describe("parseDeleteSessionRequest", () => {
  it("returns ok for valid workspaceId", () => {
    const result = parseDeleteSessionRequest({ workspaceId: "ws-1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.workspaceId).toBe("ws-1");
  });

  it("rejects missing workspaceId", () => {
    const result = parseDeleteSessionRequest({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/workspaceId/i);
  });

  it("rejects whitespace-only workspaceId", () => {
    const result = parseDeleteSessionRequest({ workspaceId: "   " });
    expect(result.ok).toBe(false);
  });

  it("rejects null body", () => {
    const result = parseDeleteSessionRequest(null);
    expect(result.ok).toBe(false);
  });

  it("rejects array body", () => {
    const result = parseDeleteSessionRequest([]);
    expect(result.ok).toBe(false);
  });
});
