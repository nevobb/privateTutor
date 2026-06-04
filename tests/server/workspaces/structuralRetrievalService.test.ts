import { describe, it, expect, vi } from "vitest";
import { resolveStructuralChunkTargets } from "../../../src/server/workspaces/structuralRetrievalService";
import type { DetectedQuestionArtifact, DocumentPageArtifact } from "../../../src/types";

function question(over: Partial<DetectedQuestionArtifact>): DetectedQuestionArtifact {
  return {
    questionId: "q",
    fileId: "file-A",
    label: "שאלה 2",
    questionNumber: 2,
    charStart: 0,
    charEnd: 10,
    sourceChunkIds: ["q2-c1", "q2-c2"],
    subsections: [],
    confidence: 1,
    ...over,
  };
}

function page(over: Partial<DocumentPageArtifact>): DocumentPageArtifact {
  return {
    pageId: "p",
    fileId: "file-A",
    pageNumber: 3,
    extractedText: "",
    textQuality: "good",
    charCount: 0,
    sourceChunkIds: ["p3-c1"],
    ...over,
  };
}

function makeDeps(over: Partial<{
  questions: DetectedQuestionArtifact[];
  pages: DocumentPageArtifact[];
}> = {}) {
  return {
    listDetectedQuestions: vi.fn(async () => over.questions ?? []),
    listDocumentPages: vi.fn(async () => over.pages ?? []),
  };
}

describe("resolveStructuralChunkTargets", () => {
  it("returns [] when the message has no structural signal", async () => {
    const deps = makeDeps({ questions: [question({})] });
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "מה הרעיון המרכזי?");
    expect(result).toEqual([]);
    expect(deps.listDetectedQuestions).not.toHaveBeenCalled();
  });

  it("routes 'שאלה 2' to that question's chunks", async () => {
    const deps = makeDeps({ questions: [question({ sourceChunkIds: ["q2-c1", "q2-c2"] })] });
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "תפתור את שאלה 2");
    expect(result).toEqual([
      { fileId: "file-A", chunkIds: ["q2-c1", "q2-c2"], matchKind: "question", matchLabel: "שאלה 2" },
    ]);
  });

  it("routes 'תרגיל 2' and 'exercise 2' to the same question", async () => {
    const deps = makeDeps({ questions: [question({})] });
    const a = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "תרגיל 2");
    const b = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "solve exercise 2");
    expect(a[0]?.chunkIds).toEqual(["q2-c1", "q2-c2"]);
    expect(b[0]?.chunkIds).toEqual(["q2-c1", "q2-c2"]);
  });

  it("routes 'עמוד 3' to that page's chunks", async () => {
    const deps = makeDeps({ pages: [page({ pageNumber: 3, sourceChunkIds: ["p3-c1"] })] });
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "מה כתוב בעמוד 3?");
    expect(result).toEqual([
      { fileId: "file-A", chunkIds: ["p3-c1"], matchKind: "page", matchLabel: "עמוד 3" },
    ]);
  });

  it("routes 'שאלה 2 סעיף ב' to the subsection's chunks", async () => {
    const deps = makeDeps({
      questions: [
        question({
          subsections: [
            { label: "סעיף א", charStart: 0, charEnd: 1, sourceChunkIds: ["q2-a"] },
            { label: "סעיף ב", charStart: 2, charEnd: 3, sourceChunkIds: ["q2-b"] },
          ],
        }),
      ],
    });
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "תסביר שאלה 2 סעיף ב");
    expect(result[0]?.matchKind).toBe("subsection");
    expect(result[0]?.chunkIds).toEqual(["q2-b"]);
  });

  it("returns [] when a signal is present but no artifact matches", async () => {
    const deps = makeDeps({ questions: [question({ questionNumber: 2, label: "שאלה 2" })] });
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "תפתור את שאלה 9");
    expect(result).toEqual([]);
  });

  it("first active file with a match wins", async () => {
    const deps = {
      listDetectedQuestions: vi.fn(async (_u: string, fileId: string) =>
        fileId === "file-B" ? [question({ fileId: "file-B", sourceChunkIds: ["B-q2"] })] : []
      ),
      listDocumentPages: vi.fn(async () => []),
    };
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A", "file-B"], "שאלה 2");
    expect(result).toEqual([
      { fileId: "file-B", chunkIds: ["B-q2"], matchKind: "question", matchLabel: "שאלה 2" },
    ]);
  });

  it("skips a file whose artifact read throws, does not reject", async () => {
    const deps = {
      listDetectedQuestions: vi.fn(async (_u: string, fileId: string) => {
        if (fileId === "file-A") throw new Error("boom");
        return [question({ fileId: "file-B", sourceChunkIds: ["B-q2"] })];
      }),
      listDocumentPages: vi.fn(async () => []),
    };
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A", "file-B"], "שאלה 2");
    expect(result[0]?.fileId).toBe("file-B");
  });

  it("returns [] when there are no active files", async () => {
    const deps = makeDeps({ questions: [question({})] });
    const result = await resolveStructuralChunkTargets(deps, "u", [], "שאלה 2");
    expect(result).toEqual([]);
  });
});
