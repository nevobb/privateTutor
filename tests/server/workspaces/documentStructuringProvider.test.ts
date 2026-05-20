import { describe, expect, it } from "vitest";
import {
  DeterministicDocumentStructuringProvider,
  validateDocumentStructuringResult,
} from "../../../src/server/workspaces/documentStructuringProvider";

describe("DeterministicDocumentStructuringProvider", () => {
  it("detects Hebrew questions", async () => {
    const provider = new DeterministicDocumentStructuringProvider();
    const result = await provider.structureDocument({
      userId: "u1",
      workspaceId: "w1",
      fileId: "f1",
      fileName: "algebra.pdf",
      sourceType: "pdf",
      pages: [{ pageNumber: 1, extractedText: "שאלה 1: פתרו\nשאלה 2: הוכיחו", textQuality: "good" }],
    });

    expect(result.detectedQuestions).toHaveLength(2);
    expect(result.detectedQuestions[0]?.labelRaw).toContain("שאלה 1");
  });

  it("detects English questions", async () => {
    const provider = new DeterministicDocumentStructuringProvider();
    const result = await provider.structureDocument({
      userId: "u1",
      workspaceId: "w1",
      fileId: "f1",
      fileName: "assignment.docx",
      sourceType: "docx",
      pages: [{ pageNumber: 1, extractedText: "Question 1\nExercise 2", textQuality: "good" }],
    });

    expect(result.detectedQuestions).toHaveLength(2);
    expect(result.materialType).toBe("assignment");
  });

  it("fails validation for malformed output", () => {
    expect(() => validateDocumentStructuringResult({ materialType: "oops" })).toThrow(
      "Invalid materialType"
    );
  });
});
