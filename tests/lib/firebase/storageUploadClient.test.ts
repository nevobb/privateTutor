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
    expect(safe).toBe("my_weird_file_01.pdf");
  });

  it("preserves original ASCII PDF filename", () => {
    const safe = sanitizeFileName("mechanics-intro.pdf");
    expect(safe).toBe("mechanics-intro.pdf");
  });

  it("preserves original ASCII DOCX filename", () => {
    const safe = sanitizeFileName("lecture_notes.docx");
    expect(safe).toBe("lecture_notes.docx");
  });

  it("normalizes uppercase extension to lowercase", () => {
    const safe = sanitizeFileName("Lecture.PDF");
    expect(safe).toBe("Lecture.pdf");
  });

  it("replaces spaces in base name with underscores", () => {
    const safe = sanitizeFileName("my study notes.pdf");
    expect(safe).toBe("my_study_notes.pdf");
  });

  it("falls back to uploaded-file for Hebrew-only base name", () => {
    const safe = sanitizeFileName("תרגול.pdf");
    expect(safe).toBe("uploaded-file.pdf");
  });

  it("uses fallback only when sanitized base is empty, not when partially ASCII", () => {
    const safe = sanitizeFileName("chapter1-תוצאות.pdf");
    expect(safe).toBe("chapter1-.pdf");
  });

  it("preserves extension in fallback path", () => {
    expect(sanitizeFileName("שאלות.docx")).toBe("uploaded-file.docx");
  });
});

describe("storageUploadClient.validateLearningFile — sourceType detection", () => {
  it("detects pdf from uppercase extension", () => {
    const result = validateLearningFile(makeFile("NOTES.PDF", "application/pdf", 512));
    expect(result).toEqual({ ok: true, sourceType: "pdf" });
  });

  it("detects docx from mixed-case extension", () => {
    const result = validateLearningFile(
      makeFile(
        "Homework.Docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        512
      )
    );
    expect(result).toEqual({ ok: true, sourceType: "docx" });
  });

  it("rejects PNG regardless of MIME type", () => {
    const result = validateLearningFile(makeFile("image.png", "image/png", 512));
    expect(result.ok).toBe(false);
  });

  it("rejects file with no extension and no matching MIME type", () => {
    const result = validateLearningFile(makeFile("nodot", "application/octet-stream", 512));
    expect(result.ok).toBe(false);
  });
});
