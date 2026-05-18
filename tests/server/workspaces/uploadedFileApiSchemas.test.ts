import { describe, expect, it } from "vitest";
import {
  parseCreateUploadedFileRequest,
  toUploadedFileApiResponse,
} from "../../../src/server/workspaces/uploadedFileApiSchemas";
import type { UploadedFileRecord } from "../../../src/server/workspaces/workspaceTypes";

describe("uploadedFileApiSchemas", () => {
  it("validates a correct payload", () => {
    const result = parseCreateUploadedFileRequest({
      fileName: "Mechanics_Intro.pdf",
      sourceType: "pdf",
      storagePath: "uploads/alice/mechanics.pdf",
      topicHint: "Mechanics",
    });

    expect(result).toEqual({
      ok: true,
      input: {
        fileName: "Mechanics_Intro.pdf",
        sourceType: "pdf",
        storagePath: "uploads/alice/mechanics.pdf",
        topicHint: "Mechanics",
      },
    });
  });

  it("rejects unsupported sourceType", () => {
    const result = parseCreateUploadedFileRequest({
      fileName: "lesson.txt",
      sourceType: "txt",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("sourceType");
    }
  });

  it("rejects missing fileName", () => {
    const result = parseCreateUploadedFileRequest({ sourceType: "pdf" });
    expect(result.ok).toBe(false);
  });

  it("serializes response shape", () => {
    const now = new Date("2026-05-19T08:00:00.000Z");
    const record: UploadedFileRecord = {
      id: "file-1",
      userId: "alice",
      workspaceId: "ws-1",
      name: "Lecture 1.pdf",
      url: "",
      uploadedAt: now,
      assignmentStatus: "assigned",
      indexingStatus: "indexed",
      sourceType: "pdf",
      topic: "Physics",
      confidence: 0.9,
      storagePath: "uploads/alice/lecture-1.pdf",
      createdAt: now,
      updatedAt: now,
    };

    const response = toUploadedFileApiResponse(record);
    expect(response.fileName).toBe("Lecture 1.pdf");
    expect(response.assignmentStatus).toBe("assigned");
    expect(response.indexingStatus).toBe("indexed");
    expect(response.uploadedAt).toBe(now.toISOString());
  });
});
