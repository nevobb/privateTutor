import { describe, expect, it, vi } from "vitest";
import { createFileDocumentUnderstandingService } from "../../../src/server/workspaces/fileDocumentUnderstandingService";
import type { AuthenticatedUser } from "../../../src/server/auth/authTypes";

const user: AuthenticatedUser = { userId: "alice", email: "alice@test.example" };
const now = new Date("2026-05-20T10:00:00.000Z");

function baseFile() {
  return {
    id: "file-1",
    userId: "alice",
    workspaceId: "ws-1",
    name: "Exam 2025.pdf",
    url: "",
    uploadedAt: now,
    assignmentStatus: "assigned" as const,
    indexingStatus: "indexed" as const,
    sourceType: "pdf" as const,
    summaryStatus: "not_requested" as const,
    summaryText: null,
    summarySource: "none" as const,
    summaryErrorCode: null,
    summaryUpdatedAt: null,
    extractionStatus: "completed" as const,
    extractedText: "שאלה 1\nשאלה 2",
    extractionErrorCode: null,
    extractionUpdatedAt: now,
    chunkingStatus: "completed" as const,
    chunkingErrorCode: null,
    chunkingUpdatedAt: now,
    embeddingStatus: "completed" as const,
    embeddingUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function deps() {
  return {
    getWorkspace: vi.fn(async () => ({ id: "ws-1" })),
    getUploadedFile: vi.fn(async () => baseFile()),
    updateUploadedFile: vi.fn(async () => baseFile()),
    listDocumentPages: vi.fn(async () => [
      {
        id: "page_0001",
        userId: "alice",
        workspaceId: "ws-1",
        fileId: "file-1",
        pageNumber: 1,
        extractedText: "שאלה 1\nשאלה 2",
        textQuality: "good" as const,
        createdAt: now,
        updatedAt: now,
      },
    ]),
    replaceDetectedQuestions: vi.fn(async () => {}),
    replaceDocumentOutline: vi.fn(async () => {}),
    structuringProvider: {
      structureDocument: vi.fn(async () => ({
        materialType: "exam" as const,
        title: "Exam",
        confidence: "medium" as const,
        sections: [{ sectionId: "section_0001", title: "Questions" }],
        detectedQuestions: [
          {
            labelRaw: "שאלה 1",
            questionNumber: 1,
            pageStart: 1,
            pageEnd: 1,
            confidence: "high" as const,
          },
        ],
      })),
    },
    writeDecisionLogEntry: vi.fn(async () => ({})),
  };
}

describe("fileDocumentUnderstandingService", () => {
  it("blocks when extraction is not completed", async () => {
    const d = deps();
    d.getUploadedFile = vi.fn(async () => ({ ...baseFile(), extractionStatus: "pending" as const }));
    const service = createFileDocumentUnderstandingService(d as never);

    const result = await service.runDocumentUnderstandingLifecycleForFile(user, "ws-1", "file-1");
    expect(result).toEqual({ ok: false, code: "extraction_not_completed" });
  });

  it("completes lifecycle and persists outputs", async () => {
    const d = deps();
    const service = createFileDocumentUnderstandingService(d as never);

    const result = await service.runDocumentUnderstandingLifecycleForFile(user, "ws-1", "file-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.materialType).toBe("exam");
      expect(result.detectedQuestionCount).toBe(1);
    }
    expect(d.replaceDetectedQuestions).toHaveBeenCalledTimes(1);
    expect(d.replaceDocumentOutline).toHaveBeenCalledTimes(1);
    expect(d.updateUploadedFile).toHaveBeenCalledWith(
      "alice",
      "file-1",
      expect.objectContaining({ understandingStatus: "completed", understandingErrorCode: null })
    );
  });

  it("keeps success when decision-log write fails", async () => {
    const d = deps();
    d.writeDecisionLogEntry = vi.fn(async () => {
      throw new Error("log failed");
    });
    const service = createFileDocumentUnderstandingService(d as never);

    const result = await service.runDocumentUnderstandingLifecycleForFile(user, "ws-1", "file-1");
    expect(result.ok).toBe(true);
    expect(d.replaceDetectedQuestions).toHaveBeenCalledTimes(1);
    expect(d.replaceDocumentOutline).toHaveBeenCalledTimes(1);
    expect(d.updateUploadedFile).toHaveBeenCalledWith(
      "alice",
      "file-1",
      expect.objectContaining({ understandingStatus: "completed" })
    );
    expect(d.updateUploadedFile).not.toHaveBeenCalledWith(
      "alice",
      "file-1",
      expect.objectContaining({ understandingStatus: "failed" })
    );
  });

  it("marks understanding failed when provider throws", async () => {
    const d = deps();
    d.structuringProvider = {
      structureDocument: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const service = createFileDocumentUnderstandingService(d as never);

    const result = await service.runDocumentUnderstandingLifecycleForFile(user, "ws-1", "file-1");
    expect(result.ok).toBe(false);
    expect(d.updateUploadedFile).toHaveBeenCalledWith(
      "alice",
      "file-1",
      expect.objectContaining({ understandingStatus: "failed" })
    );
  });

  it("keeps lifecycle failure result when provider and decision-log both fail", async () => {
    const d = deps();
    d.structuringProvider = {
      structureDocument: vi.fn(async () => {
        throw new Error("provider failed");
      }),
    };
    d.writeDecisionLogEntry = vi.fn(async () => {
      throw new Error("log failed");
    });
    const service = createFileDocumentUnderstandingService(d as never);

    const result = await service.runDocumentUnderstandingLifecycleForFile(user, "ws-1", "file-1");
    expect(result).toEqual({ ok: false, code: "lifecycle_failed" });
    expect(d.updateUploadedFile).toHaveBeenCalledWith(
      "alice",
      "file-1",
      expect.objectContaining({ understandingStatus: "failed" })
    );
  });
});
