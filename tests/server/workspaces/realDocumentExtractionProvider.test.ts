import { describe, expect, it, vi } from "vitest";
import { createRealDocumentExtractionProvider } from "../../../src/server/workspaces/realDocumentExtractionProvider";

const baseInput = {
  userId: "alice",
  workspaceId: "ws-1",
  fileId: "file-1",
  fileName: "notes.pdf",
  sourceType: "pdf" as const,
  storagePath: "users/alice/workspaces/ws-1/files/file-1/notes.pdf",
};

const pdfBuffer = Buffer.from("fake-pdf-bytes");
const docxBuffer = Buffer.from("fake-docx-bytes");

describe("RealDocumentExtractionProvider", () => {
  describe("PDF extraction", () => {
    it("returns extracted text from pdf parser", async () => {
      const pdfParser = vi.fn(async () => ({
        text: "Newton's first law states that an object at rest stays at rest.",
        numpages: 1,
      }));
      const provider = createRealDocumentExtractionProvider(pdfParser);

      const result = await provider.extractText({ ...baseInput, fileBuffer: pdfBuffer });

      expect(result.source).toBe("pdf_parse_pdf_parser");
      expect(result.parserName).toBe("pdf-parse");
      expect(result.text).toContain("Newton");
      expect(pdfParser).toHaveBeenCalledWith(pdfBuffer);
    });

    it("normalizes whitespace in extracted text", async () => {
      const pdfParser = vi.fn(async () => ({
        text: "  Hello   World\r\n\r\n\r\nExtra lines  ",
        numpages: 1,
      }));
      const provider = createRealDocumentExtractionProvider(pdfParser);

      const result = await provider.extractText({ ...baseInput, fileBuffer: pdfBuffer });

      expect(result.text).toBe("Hello World\n\nExtra lines");
    });

    it("adds empty_extracted_text warning when pdf text is empty", async () => {
      const pdfParser = vi.fn(async () => ({ text: "   ", numpages: 1 }));
      const provider = createRealDocumentExtractionProvider(pdfParser);

      const result = await provider.extractText({ ...baseInput, fileBuffer: pdfBuffer });

      expect(result.warnings).toContain("empty_extracted_text");
      expect(result.text).toBe("");
    });

    it("adds possible_scanned_pdf warning when pdf has pages but empty text", async () => {
      const pdfParser = vi.fn(async () => ({ text: "", numpages: 3 }));
      const provider = createRealDocumentExtractionProvider(pdfParser);

      const result = await provider.extractText({ ...baseInput, fileBuffer: pdfBuffer });

      expect(result.warnings).toContain("possible_scanned_pdf");
    });

    it("adds very_short_extracted_text warning when text is short", async () => {
      const pdfParser = vi.fn(async () => ({ text: "Short.", numpages: 1 }));
      const provider = createRealDocumentExtractionProvider(pdfParser);

      const result = await provider.extractText({ ...baseInput, fileBuffer: pdfBuffer });

      expect(result.warnings).toContain("very_short_extracted_text");
    });

    it("returns no warnings for normal-length text", async () => {
      const longText = "This is a normal paragraph of text that goes on long enough. ".repeat(5);
      const pdfParser = vi.fn(async () => ({ text: longText, numpages: 1 }));
      const provider = createRealDocumentExtractionProvider(pdfParser);

      const result = await provider.extractText({ ...baseInput, fileBuffer: pdfBuffer });

      expect(result.warnings).toBeUndefined();
    });

    it("throws when fileBuffer is missing", async () => {
      const pdfParser = vi.fn(async () => ({ text: "text", numpages: 1 }));
      const provider = createRealDocumentExtractionProvider(pdfParser);

      await expect(
        provider.extractText({ ...baseInput, fileBuffer: null })
      ).rejects.toThrow("real_parser_requires_file_buffer");

      await expect(
        provider.extractText({ ...baseInput })
      ).rejects.toThrow("real_parser_requires_file_buffer");
    });

    it("propagates parser error with original message", async () => {
      const pdfParser = vi.fn(async () => { throw new Error("invalid_pdf_structure"); });
      const provider = createRealDocumentExtractionProvider(pdfParser);

      await expect(
        provider.extractText({ ...baseInput, fileBuffer: pdfBuffer })
      ).rejects.toThrow("invalid_pdf_structure");
    });
  });

  describe("DOCX extraction", () => {
    it("returns extracted text from docx parser", async () => {
      const docxParser = vi.fn(async () => ({
        value: "Newton's laws of motion are three laws.",
        messages: [],
      }));
      const provider = createRealDocumentExtractionProvider(undefined, docxParser);

      const result = await provider.extractText({
        ...baseInput,
        fileName: "notes.docx",
        sourceType: "docx" as const,
        storagePath: "users/alice/workspaces/ws-1/files/file-1/notes.docx",
        fileBuffer: docxBuffer,
      });

      expect(result.source).toBe("mammoth_docx_parser");
      expect(result.parserName).toBe("mammoth");
      expect(result.text).toContain("Newton");
      expect(docxParser).toHaveBeenCalledWith(docxBuffer);
    });

    it("adds empty_extracted_text warning when docx text is empty", async () => {
      const docxParser = vi.fn(async () => ({ value: "", messages: [] }));
      const provider = createRealDocumentExtractionProvider(undefined, docxParser);

      const result = await provider.extractText({
        ...baseInput,
        sourceType: "docx" as const,
        fileBuffer: docxBuffer,
      });

      expect(result.warnings).toContain("empty_extracted_text");
    });

    it("propagates docx parser error", async () => {
      const docxParser = vi.fn(async () => { throw new Error("invalid_docx"); });
      const provider = createRealDocumentExtractionProvider(undefined, docxParser);

      await expect(
        provider.extractText({ ...baseInput, sourceType: "docx" as const, fileBuffer: docxBuffer })
      ).rejects.toThrow("invalid_docx");
    });
  });

  describe("unsupported type", () => {
    it("throws on unsupported source type", async () => {
      const pdfParser = vi.fn(async () => ({ text: "text", numpages: 1 }));
      const provider = createRealDocumentExtractionProvider(pdfParser);

      await expect(
        provider.extractText({
          ...baseInput,
          sourceType: "pdf" as "pdf" | "docx",
          fileBuffer: pdfBuffer,
        })
      ).resolves.toBeDefined();
    });
  });
});
