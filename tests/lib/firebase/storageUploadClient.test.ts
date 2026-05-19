import { describe, expect, it } from "vitest";
import {
  sanitizeFileName,
  validateLearningFile,
} from "../../../src/lib/firebase/storageUploadClient";

function makeFile(name: string, type: string, sizeBytes: number): File {
  const chunk = new Uint8Array(sizeBytes);
  const file = new File([chunk], name, { type });
  return file;
}

describe("storageUploadClient.validateLearningFile", () => {
  it("accepts PDF", () => {
    const result = validateLearningFile(makeFile("lesson.pdf", "application/pdf", 1024));
    expect(result).toEqual({ ok: true, sourceType: "pdf" });
  });

  it("accepts DOCX", () => {
    const result = validateLearningFile(
      makeFile(
        "lesson.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        1024
      )
    );
    expect(result).toEqual({ ok: true, sourceType: "docx" });
  });

  it("rejects unsupported extension", () => {
    const result = validateLearningFile(makeFile("notes.txt", "text/plain", 100));
    expect(result.ok).toBe(false);
  });

  it("rejects empty file", () => {
    const result = validateLearningFile(makeFile("lesson.pdf", "application/pdf", 0));
    expect(result).toEqual({ ok: false, reason: "File is empty." });
  });

  it("rejects oversized file", () => {
    const result = validateLearningFile(makeFile("lesson.pdf", "application/pdf", 20 * 1024 * 1024 + 1));
    expect(result).toEqual({ ok: false, reason: "File exceeds 20 MB limit." });
  });
});

describe("storageUploadClient.sanitizeFileName", () => {
  it("sanitizes unsafe filename", () => {
    const safe = sanitizeFileName(" ../my weird/file 01?.pdf ");
    expect(safe).toBe("my_weird_file_01_.pdf");
  });
});
