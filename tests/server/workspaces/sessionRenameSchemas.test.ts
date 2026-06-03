import { describe, expect, it } from "vitest";
import { parseRenameSessionRequest } from "../../../src/server/workspaces/sessionApiSchemas";

describe("parseRenameSessionRequest", () => {
  it("returns ok for valid title and workspaceId", () => {
    const result = parseRenameSessionRequest({ title: "My session", workspaceId: "ws-1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.title).toBe("My session");
    expect(result.input.workspaceId).toBe("ws-1");
  });

  it("trims whitespace from title", () => {
    const result = parseRenameSessionRequest({ title: "  hello  ", workspaceId: "ws-1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.title).toBe("hello");
  });

  it("rejects empty title after trim", () => {
    const result = parseRenameSessionRequest({ title: "   ", workspaceId: "ws-1" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/empty/i);
  });

  it("rejects empty string title", () => {
    const result = parseRenameSessionRequest({ title: "", workspaceId: "ws-1" });
    expect(result.ok).toBe(false);
  });

  it("rejects missing title", () => {
    const result = parseRenameSessionRequest({ workspaceId: "ws-1" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/title/i);
  });

  it("rejects title that exceeds 120 characters", () => {
    const longTitle = "a".repeat(121);
    const result = parseRenameSessionRequest({ title: longTitle, workspaceId: "ws-1" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/120/);
  });

  it("accepts title of exactly 120 characters", () => {
    const maxTitle = "a".repeat(120);
    const result = parseRenameSessionRequest({ title: maxTitle, workspaceId: "ws-1" });
    expect(result.ok).toBe(true);
  });

  it("rejects non-string title", () => {
    const result = parseRenameSessionRequest({ title: 42, workspaceId: "ws-1" });
    expect(result.ok).toBe(false);
  });

  it("rejects missing workspaceId", () => {
    const result = parseRenameSessionRequest({ title: "Hello" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/workspaceId/i);
  });

  it("rejects null body", () => {
    const result = parseRenameSessionRequest(null);
    expect(result.ok).toBe(false);
  });

  it("rejects array body", () => {
    const result = parseRenameSessionRequest([]);
    expect(result.ok).toBe(false);
  });
});
