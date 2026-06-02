import { describe, expect, it } from "vitest";
import {
  parseDetectedQuestionArtifactRecord,
  parseDocumentOutlineArtifactRecord,
  parseDocumentPageArtifactRecord,
  parseSourceReference,
} from "../../../src/server/workspaces/documentArtifactSchemas";

const context = {
  userId: "alice",
  fileId: "file-1",
};

describe("documentArtifactSchemas", () => {
  it("parses a valid source reference", () => {
    const result = parseSourceReference({
      fileId: "file-1",
      fileName: "Physics.pdf",
      pageNumber: 2,
      sourceChunkIds: ["chunk-1"],
      textQuality: "partial",
      understandingConfidence: 0.74,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        fileId: "file-1",
        fileName: "Physics.pdf",
        pageNumber: 2,
        pageStart: undefined,
        pageEnd: undefined,
        sectionId: undefined,
        questionId: undefined,
        sourceChunkIds: ["chunk-1"],
        textQuality: "partial",
        understandingConfidence: 0.74,
      },
    });
  });

  it("parses a valid document page artifact", () => {
    const result = parseDocumentPageArtifactRecord(
      {
        pageId: "page_0001",
        fileId: "file-1",
        pageNumber: 1,
        extractedText: "חוק קולון",
        cleanedText: "חוק קולון",
        textQuality: "good",
        charCount: 9,
        sourceChunkIds: ["chunk-1"],
        sourceReferences: [{ fileId: "file-1", pageNumber: 1, sourceChunkIds: ["chunk-1"] }],
        createdAt: "2026-06-02T09:00:00.000Z",
        updatedAt: "2026-06-02T09:00:00.000Z",
      },
      context
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pageId).toBe("page_0001");
      expect(result.value.textQuality).toBe("good");
      expect(result.value.sourceReferences?.[0].pageNumber).toBe(1);
    }
  });

  it("parses a valid document outline artifact with nested sections", () => {
    const result = parseDocumentOutlineArtifactRecord(
      {
        outlineId: "v1",
        fileId: "file-1",
        title: "מטלת פיזיקה",
        confidence: "medium",
        sections: [
          {
            sectionId: "section-1",
            label: "שאלה 1",
            title: "שדה חשמלי",
            pageStart: 1,
            charStart: 0,
            charEnd: 120,
            sourceChunkIds: ["chunk-1"],
            confidence: 0.81,
            subsections: [
              {
                sectionId: "section-1-a",
                label: "סעיף א׳",
                charStart: 20,
                charEnd: 40,
                sourceChunkIds: ["chunk-1"],
                confidence: 0.62,
                subsections: [],
              },
            ],
          },
        ],
      },
      context
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sections[0].subsections[0].label).toBe("סעיף א׳");
      expect(result.value.confidence).toBe("medium");
    }
  });

  it("parses a valid detected question artifact", () => {
    const result = parseDetectedQuestionArtifactRecord(
      {
        questionId: "q_001",
        fileId: "file-1",
        label: "שאלה 3",
        questionNumber: 3,
        topic: "פוטנציאל חשמלי",
        summary: "חישוב פוטנציאל",
        pageStart: 2,
        pageEnd: 3,
        charStart: 150,
        charEnd: 340,
        sourceChunkIds: ["chunk-2", "chunk-3"],
        subsections: [
          {
            label: "סעיף א׳",
            charStart: 170,
            charEnd: 220,
            sourceChunkIds: ["chunk-2"],
          },
        ],
        confidence: 0.77,
        extractionNotes: "boundary inferred",
      },
      context
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.questionNumber).toBe(3);
      expect(result.value.subsections).toHaveLength(1);
    }
  });

  it("rejects invalid artifact enums and shapes", () => {
    const pageResult = parseDocumentPageArtifactRecord(
      {
        pageId: "page_0001",
        pageNumber: 1,
        extractedText: "bad",
        textQuality: "excellent",
        charCount: 3,
        sourceChunkIds: ["chunk-1"],
      },
      context
    );
    expect(pageResult).toEqual({
      ok: false,
      error: "Document page artifact textQuality must be one of: good, partial, poor, empty.",
    });

    const outlineResult = parseDocumentOutlineArtifactRecord(
      {
        outlineId: "v1",
        confidence: "certain",
        sections: [],
      },
      context
    );
    expect(outlineResult).toEqual({
      ok: false,
      error: "Document outline artifact confidence must be one of: high, medium, low.",
    });

    const questionResult = parseDetectedQuestionArtifactRecord(
      {
        questionId: "q_001",
        label: "שאלה 1",
        charStart: 20,
        charEnd: 10,
        sourceChunkIds: ["chunk-1"],
        subsections: [],
      },
      context
    );
    expect(questionResult).toEqual({
      ok: false,
      error: "Detected question artifact charEnd must be >= charStart.",
    });
  });
});
