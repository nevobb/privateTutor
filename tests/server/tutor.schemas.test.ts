import { describe, expect, it } from "vitest";
import { validateTutorRequest } from "../../src/server/tutor/validateTutorRequest";

const validRequest = {
  userId: "user-1",
  workspaceId: "ws-1",
  sessionId: "session-1",
  message: "What is the theme?",
  workMode: "Learning",
  costMode: "Normal Learning",
  activeFileIds: ["f-1"],
  temporary: false,
};

describe("tutor request validation", () => {
  it("accepts a valid request", () => {
    const result = validateTutorRequest(validRequest);

    expect(result.ok).toBe(true);
    expect(result.request?.message).toBe("What is the theme?");
    expect(result.errors).toEqual([]);
  });

  it("rejects an empty message", () => {
    const result = validateTutorRequest({ ...validRequest, message: "   " });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Message must be a non-empty string.");
  });

  it("rejects an invalid workMode", () => {
    const result = validateTutorRequest({ ...validRequest, workMode: "Quiz" });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid workMode.");
  });

  it("rejects an invalid costMode", () => {
    const result = validateTutorRequest({ ...validRequest, costMode: "Free Forever" });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid costMode.");
  });

  it("rejects a missing userId", () => {
    const result = validateTutorRequest({ ...validRequest, userId: "" });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Missing userId.");
  });

  it("rejects a missing workspaceId", () => {
    const result = validateTutorRequest({ ...validRequest, workspaceId: "" });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Missing workspaceId.");
  });

  it("rejects activeFileIds when it is not an array", () => {
    const result = validateTutorRequest({ ...validRequest, activeFileIds: "f-1" });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("activeFileIds must be a string array when present.");
  });
});
