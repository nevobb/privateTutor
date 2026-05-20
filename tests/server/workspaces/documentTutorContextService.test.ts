import { describe, expect, it, vi } from "vitest";
import { DocumentTutorContextService } from "../../../src/server/workspaces/documentTutorContextService";

const user = { userId: "alice", email: "alice@test.example" };

describe("DocumentTutorContextService.classifyIntent", () => {
  const service = new DocumentTutorContextService({} as never);

  it("classifies inventory requests", () => {
    expect(service.classifyIntent("איזה שאלות יש בקובץ?").intent).toBe("document_inventory_request");
    expect(service.classifyIntent("תן לי רשימת תרגילים במטלה").intent).toBe("document_inventory_request");
  });

  it("classifies specific detected question requests", () => {
    const result = service.classifyIntent("תסביר לי שאלה 3");
    expect(result.intent).toBe("specific_detected_question_request");
    expect(result.requestedQuestionNumber).toBe(3);
  });

  it("classifies visual reference requests", () => {
    expect(service.classifyIntent("מה רואים בגרף?").intent).toBe("visual_reference_request");
  });

  it("keeps general tutor questions as general", () => {
    expect(service.classifyIntent("מה זה קיבול?").intent).toBe("general_tutor_question");
  });
});

describe("DocumentTutorContextService resolution + answers", () => {
  it("runs on-demand understanding when exactly one extracted file has pages", async () => {
    const service = new DocumentTutorContextService({
      listUploadedFiles: vi.fn(async () => [
        {
          id: "file-1",
          name: "Exam.pdf",
          originalFileName: "Exam.pdf",
          extractionStatus: "completed",
          understandingStatus: "not_started",
        },
      ]),
      listDocumentPages: vi.fn(async () => [
        {
          id: "page_0001",
          pageNumber: 1,
          extractedText: "שאלה 1",
          cleanedText: "שאלה 1",
        },
      ]),
      runUnderstandingLifecycleForFile: vi.fn(async () => ({ ok: true })),
      listDetectedQuestions: vi.fn(async () => [
        {
          id: "q1",
          labelRaw: "שאלה 1",
          questionNumber: 1,
          pageStart: 1,
          pageEnd: 1,
          confidence: "high",
        },
      ]),
      getDocumentOutline: vi.fn(async () => ({ id: "current", sections: [], createdAt: new Date(), updatedAt: new Date() })),
    } as never);

    const result = await service.resolveRelevantFileForDocumentIntent(user, "ws-1", {
      allowOnDemandUnderstanding: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolved.detectedQuestions).toHaveLength(1);
    }
  });

  it("returns ambiguous when multiple understood files exist", async () => {
    const service = new DocumentTutorContextService({
      listUploadedFiles: vi.fn(async () => [
        { id: "file-1", name: "A.pdf", understandingStatus: "completed" },
        { id: "file-2", name: "B.pdf", understandingStatus: "completed" },
      ]),
      listDocumentPages: vi.fn(async () => []),
      listDetectedQuestions: vi.fn(async () => []),
      getDocumentOutline: vi.fn(async () => null),
      runUnderstandingLifecycleForFile: vi.fn(async () => ({ ok: false, code: "lifecycle_failed" })),
    } as never);

    const result = await service.resolveRelevantFileForDocumentIntent(user, "ws-1", {
      allowOnDemandUnderstanding: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ambiguous_files");
  });

  it("returns specific question not found message with labels", () => {
    const service = new DocumentTutorContextService({} as never);
    const res = service.resolveDetectedQuestionReference(
      {
        file: { id: "file-1", name: "Exam.pdf" } as never,
        pages: [],
        outline: null,
        detectedQuestions: [
          { id: "q1", labelRaw: "שאלה 1", questionNumber: 1, confidence: "high", createdAt: new Date(), updatedAt: new Date(), userId: "u", workspaceId: "w", fileId: "f" },
        ],
      },
      9
    );

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("9");
  });
});
