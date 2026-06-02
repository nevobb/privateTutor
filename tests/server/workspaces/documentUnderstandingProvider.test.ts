import { describe, expect, it, vi } from "vitest";
import {
  pdfParseOutlineProvider,
  geminiPdfUnderstandingProvider,
  GeminiPdfUnderstandingProvider,
  type DocumentUnderstandingProvider,
  type DocumentUnderstandingInput,
} from "../../../src/server/workspaces/documentUnderstandingProvider";

const baseInput: DocumentUnderstandingInput = {
  userId: "alice",
  workspaceId: "ws-1",
  fileId: "file-1",
  fileName: "Physics.pdf",
  storagePath: "users/alice/workspaces/ws-1/files/file-1/Physics.pdf",
  sourceType: "pdf",
  mode: "text_only",
};

// ---------------------------------------------------------------------------
// Provider contract tests
// ---------------------------------------------------------------------------

describe("DocumentUnderstandingProvider contract", () => {
  const providers: DocumentUnderstandingProvider[] = [
    pdfParseOutlineProvider,
    geminiPdfUnderstandingProvider,
  ];

  for (const provider of providers) {
    it(`${provider.name}: has a non-empty name`, () => {
      expect(typeof provider.name).toBe("string");
      expect(provider.name.length).toBeGreaterThan(0);
    });

    it(`${provider.name}: has a valid mode`, () => {
      expect(["text_only", "deep_pdf"]).toContain(provider.mode);
    });

    it(`${provider.name}: run() returns a promise`, () => {
      const result = provider.run({ ...baseInput, mode: provider.mode });
      expect(result).toBeInstanceOf(Promise);
    });

    it(`${provider.name}: output has required shape`, async () => {
      const output = await provider.run({ ...baseInput, mode: provider.mode });
      expect(typeof output.providerName).toBe("string");
      expect(["text_only", "deep_pdf"]).toContain(output.providerMode);
      expect(typeof output.pageCount).toBe("number");
      expect(Array.isArray(output.pages)).toBe(true);
      expect(Array.isArray(output.detectedQuestions)).toBe(true);
      expect(Array.isArray(output.warnings)).toBe(true);
      expect(Array.isArray(output.errors)).toBe(true);
      expect(typeof output.qualitySignals).toBe("object");
      expect(["high", "medium", "low"]).toContain(output.confidence);
    });
  }
});

// ---------------------------------------------------------------------------
// PdfParseOutlineProvider tests
// ---------------------------------------------------------------------------

describe("PdfParseOutlineProvider", () => {
  it("name is pdf_parse_outline", () => {
    expect(pdfParseOutlineProvider.name).toBe("pdf_parse_outline");
  });

  it("mode is text_only", () => {
    expect(pdfParseOutlineProvider.mode).toBe("text_only");
  });

  it("empty extractedText produces no-text partial result", async () => {
    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: "",
    });

    expect(output.qualitySignals.hasExtractedText).toBe(false);
    expect(output.qualitySignals.textQuality).toBe("empty");
    expect(output.pageCount).toBe(0);
    expect(output.pages).toHaveLength(0);
    expect(output.outline).toBeNull();
    expect(output.detectedQuestions).toHaveLength(0);
    expect(output.extractionQuality).toBeNull();
    expect(output.confidence).toBe("low");
    expect(output.warnings.some((w) => w.includes("no_extracted_text"))).toBe(true);
  });

  it("missing extractedText produces no-text partial result", async () => {
    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: undefined,
    });

    expect(output.qualitySignals.hasExtractedText).toBe(false);
    expect(output.pageCount).toBe(0);
    expect(output.outline).toBeNull();
  });

  it("clean Hebrew questions produce outline and detected questions", async () => {
    const text =
      "שאלה 1\n\nחשב את המהירות.\nתוצאה: 5 m/s\n\nשאלה 2\n\nמה הכיוון?\n\nשאלה 3\n\nתאר את האנרגיה.";

    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: text,
    });

    expect(output.detectedQuestions.length).toBeGreaterThanOrEqual(3);
    expect(output.outline).not.toBeNull();
    expect(output.outline?.sections.length).toBeGreaterThanOrEqual(3);
    expect(output.pages).toHaveLength(1);
    expect(output.pages[0].extractedText).toBe(text);
    expect(output.qualitySignals.hasExtractedText).toBe(true);
    expect(output.extractionQuality).not.toBeNull();
    expect(output.extractionQuality).not.toBe("poor");
    expect(output.errors).toHaveLength(0);
  });

  it("English numbered questions are detected", async () => {
    const text =
      "Question 1\n\nFind the velocity.\n\nQuestion 2\n\nDescribe momentum.\n\nQuestion 3\n\nExplain force.";

    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: text,
    });

    expect(output.detectedQuestions.length).toBeGreaterThanOrEqual(3);
    expect(output.detectedQuestions[0].label).toContain("Question 1");
    expect(output.detectedQuestions[1].label).toContain("Question 2");
  });

  it("Exercise and Problem patterns are detected", async () => {
    const text =
      "Exercise 1\n\nSome content here.\n\nProblem 2\n\nMore content here.";

    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: text,
    });

    expect(output.detectedQuestions.length).toBeGreaterThanOrEqual(2);
  });

  it("numbered list pattern (1. 2. 3.) is detected", async () => {
    const text =
      "1. Calculate the force applied.\n\n2. Find the acceleration.\n\n3. Determine the mass.";

    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: text,
    });

    expect(output.detectedQuestions.length).toBeGreaterThanOrEqual(3);
  });

  it("detectedQuestions charStart/charEnd are within text boundaries", async () => {
    const text =
      "שאלה 1\n\nחוק ניוטון\n\nשאלה 2\n\nאנרגיה קינטית\n\nשאלה 3\n\nמומנטום";

    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: text,
    });

    for (const q of output.detectedQuestions) {
      expect(q.charStart).toBeGreaterThanOrEqual(0);
      expect(q.charEnd).toBeLessThanOrEqual(text.length);
      expect(q.charStart).toBeLessThan(q.charEnd);
    }
  });

  it("poor quality (short garbled) text produces poor extractionQuality", async () => {
    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: "???���",
    });

    expect(["poor", null]).toContain(output.extractionQuality);
    expect(output.confidence).toBe("low");
  });

  it("math signals detected in text with math symbols", async () => {
    const text =
      "שאלה 1\n\nחשב את האינטגרל ∫f(x)dx עבור הפונקציה הנתונה.\n\nשאלה 2\n\nמה שווה α+β?";

    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: text,
    });

    expect(output.qualitySignals.likelyHasMath).toBe(true);
  });

  it("no Gemini call or external dependency — runs synchronously within test", async () => {
    const start = Date.now();
    await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: "שאלה 1\n\nתוכן\n\nשאלה 2\n\nתוכן נוסף",
    });
    const elapsed = Date.now() - start;
    // Deterministic provider finishes in well under 1 second with no I/O
    expect(elapsed).toBeLessThan(1000);
  });

  it("prose text with no markers produces zero questions and medium confidence", async () => {
    const text =
      "This document covers the theory of relativity. Einstein proposed that the speed of light is constant. " +
      "The implications of this are profound and affect our understanding of space and time. " +
      "Mass and energy are related by the equation E=mc^2.";

    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: text,
    });

    expect(output.detectedQuestions).toHaveLength(0);
    expect(output.confidence).toBe("medium");
    expect(output.outline?.sections).toHaveLength(0);
  });

  it("outline sections map to detected questions", async () => {
    const text = "שאלה 1\n\nתוכן א\n\nשאלה 2\n\nתוכן ב";

    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: text,
    });

    expect(output.outline?.sections.length).toBe(output.detectedQuestions.length);
  });

  it("outline outlineId is always v1", async () => {
    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      extractedText: "שאלה 1\n\nתוכן",
    });

    expect(output.outline?.outlineId).toBe("v1");
  });

  it("page artifact has correct fileId", async () => {
    const output = await pdfParseOutlineProvider.run({
      ...baseInput,
      fileId: "file-abc",
      extractedText: "תוכן כלשהו לבדיקה",
    });

    if (output.pages.length > 0) {
      expect(output.pages[0].fileId).toBe("file-abc");
    }
  });
});

// ---------------------------------------------------------------------------
// GeminiPdfUnderstandingProvider placeholder tests
// ---------------------------------------------------------------------------

describe("GeminiPdfUnderstandingProvider", () => {
  it("name is gemini_pdf_understanding", () => {
    expect(geminiPdfUnderstandingProvider.name).toBe("gemini_pdf_understanding");
  });

  it("mode is deep_pdf", () => {
    expect(geminiPdfUnderstandingProvider.mode).toBe("deep_pdf");
  });

  it("run() returns a promise without throwing", async () => {
    await expect(
      geminiPdfUnderstandingProvider.run({ ...baseInput, mode: "deep_pdf" })
    ).resolves.toBeDefined();
  });

  it("fails safely when API key is missing", async () => {
    const output = await geminiPdfUnderstandingProvider.run({
      ...baseInput,
      mode: "deep_pdf",
    });

    expect(output.errors.length).toBeGreaterThan(0);
    expect(output.errors[0]).toContain("missing_api_key");
  });

  it("returns empty pages, no outline, no questions", async () => {
    const output = await geminiPdfUnderstandingProvider.run({
      ...baseInput,
      mode: "deep_pdf",
    });

    expect(output.pages).toHaveLength(0);
    expect(output.outline).toBeNull();
    expect(output.detectedQuestions).toHaveLength(0);
    expect(output.pageCount).toBe(0);
  });

  it("does not perform network calls — resolves quickly", async () => {
    const start = Date.now();
    await geminiPdfUnderstandingProvider.run({ ...baseInput, mode: "deep_pdf" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it("providerName matches name field", async () => {
    const output = await geminiPdfUnderstandingProvider.run({
      ...baseInput,
      mode: "deep_pdf",
    });
    expect(output.providerName).toBe(geminiPdfUnderstandingProvider.name);
  });

  it("providerMode is deep_pdf", async () => {
    const output = await geminiPdfUnderstandingProvider.run({
      ...baseInput,
      mode: "deep_pdf",
    });
    expect(output.providerMode).toBe("deep_pdf");
  });

  it("returns structured artifacts from mocked Gemini JSON with Hebrew labels preserved", async () => {
    const client = {
      generateDocumentJson: vi.fn(async () =>
        JSON.stringify({
          pageCount: 2,
          pages: [
            {
              pageNumber: 1,
              text: "שאלה 1 — חשמל",
              textQuality: "good",
              sourceChunkIds: [],
            },
            {
              pageNumber: 2,
              text: "שאלה 2 — שדה מגנטי",
              textQuality: "partial",
              sourceChunkIds: [],
            },
          ],
          outline: {
            title: "מטלת פיזיקה",
            sections: [
              {
                sectionId: "section_1",
                label: "שאלה 1",
                title: "חשמל",
                pageStart: 1,
                pageEnd: 1,
                confidence: 0.9,
              },
            ],
          },
          detectedQuestions: [
            {
              label: "שאלה 1",
              title: "חשמל",
              pageStart: 1,
              pageEnd: 1,
              sectionId: "section_1",
              textPreview: "חשב את הכוח החשמלי.",
              textQuality: "good",
              confidence: 0.88,
            },
          ],
          qualitySignals: {
            likelyHasMath: true,
            likelyHasVisualContent: true,
            textQuality: "partial",
            extractedTextCharCount: 220,
          },
          extractionQuality: "partial",
          confidence: 0.82,
          warnings: ["math_not_fully_reliable"],
        })
      ),
    };

    const provider = new GeminiPdfUnderstandingProvider({
      apiKey: "key-123",
      client,
    });

    const output = await provider.run({
      ...baseInput,
      mode: "deep_pdf",
      pdfBytes: new Uint8Array([1, 2, 3]),
    });

    expect(output.errors).toEqual([]);
    expect(output.pageCount).toBe(2);
    expect(output.pages).toHaveLength(2);
    expect(output.pages[0].pageId).toBe("page_0001");
    expect(output.outline?.title).toBe("מטלת פיזיקה");
    expect(output.outline?.sections[0].label).toBe("שאלה 1");
    expect(output.detectedQuestions[0].label).toBe("שאלה 1");
    expect(output.detectedQuestions[0].summary).toBe("חשב את הכוח החשמלי.");
    expect(output.qualitySignals.likelyHasMath).toBe(true);
    expect(output.qualitySignals.likelyHasVisualContent).toBe(true);
    expect(output.warnings).toContain("math_not_fully_reliable");
  });

  it("preserves low-confidence math/visual warnings without overclaiming certainty", async () => {
    const provider = new GeminiPdfUnderstandingProvider({
      apiKey: "key-123",
      client: {
        generateDocumentJson: vi.fn(async () =>
          JSON.stringify({
            pageCount: 1,
            pages: [{ pageNumber: 1, text: "0 0 1 2 μ", textQuality: "poor", sourceChunkIds: [] }],
            outline: { title: "דף תרגול", sections: [] },
            detectedQuestions: [
              {
                label: "שאלה 3",
                title: "שדה מגנטי",
                pageStart: 1,
                pageEnd: 1,
                sectionId: null,
                textPreview: "formula unclear",
                textQuality: "poor",
                confidence: 0.22,
              },
            ],
            qualitySignals: {
              likelyHasMath: true,
              likelyHasVisualContent: false,
              textQuality: "poor",
              extractedTextCharCount: 18,
            },
            extractionQuality: "poor",
            confidence: 0.24,
            warnings: ["formulas_or_diagrams_unclear"],
          })
        ),
      },
    });

    const output = await provider.run({
      ...baseInput,
      mode: "deep_pdf",
      pdfBytes: new Uint8Array([9, 9, 9]),
    });

    expect(output.confidence).toBe("low");
    expect(output.extractionQuality).toBe("poor");
    expect(output.warnings).toContain("formulas_or_diagrams_unclear");
    expect(output.detectedQuestions[0].extractionNotes).toContain("low_confidence_pdf_extraction");
  });

  it("fails safely on malformed Gemini JSON", async () => {
    const provider = new GeminiPdfUnderstandingProvider({
      apiKey: "key-123",
      client: {
        generateDocumentJson: vi.fn(async () => "{ not valid json"),
      },
    });

    const output = await provider.run({
      ...baseInput,
      mode: "deep_pdf",
      pdfBytes: new Uint8Array([1]),
    });

    expect(output.errors[0]).toContain("invalid_json");
    expect(output.pages).toEqual([]);
    expect(output.outline).toBeNull();
  });

  it("fails safely when inline bytes and loader are both missing", async () => {
    const provider = new GeminiPdfUnderstandingProvider({
      apiKey: "key-123",
      client: {
        generateDocumentJson: vi.fn(async () => "{}"),
      },
    });

    const output = await provider.run({
      ...baseInput,
      mode: "deep_pdf",
      storagePath: "",
    });

    expect(output.errors[0]).toContain("missing_pdf_input");
  });

  it("uses injected PdfBytesLoader when inline bytes are absent", async () => {
    const loader = {
      loadPdfBytes: vi.fn(async () => new Uint8Array([4, 5, 6])),
    };
    const client = {
      generateDocumentJson: vi.fn(async () =>
        JSON.stringify({
          pageCount: 1,
          pages: [{ pageNumber: 1, text: "Question 1", textQuality: "good", sourceChunkIds: [] }],
          outline: { title: "Physics", sections: [] },
          detectedQuestions: [],
          qualitySignals: {
            likelyHasMath: false,
            likelyHasVisualContent: false,
            textQuality: "good",
            extractedTextCharCount: 10,
          },
          extractionQuality: "good",
          confidence: 0.7,
          warnings: [],
        })
      ),
    };
    const provider = new GeminiPdfUnderstandingProvider({
      apiKey: "key-123",
      client,
      pdfBytesLoader: loader,
    });

    const output = await provider.run({
      ...baseInput,
      mode: "deep_pdf",
      pdfBytes: undefined,
    });

    expect(loader.loadPdfBytes).toHaveBeenCalledTimes(1);
    expect(client.generateDocumentJson).toHaveBeenCalledTimes(1);
    expect(output.errors).toEqual([]);
  });

  it("fails safely for unsupported non-PDF source types", async () => {
    const provider = new GeminiPdfUnderstandingProvider({
      apiKey: "key-123",
      client: {
        generateDocumentJson: vi.fn(async () => "{}"),
      },
    });

    const output = await provider.run({
      ...baseInput,
      mode: "deep_pdf",
      sourceType: "docx",
      pdfBytes: new Uint8Array([1, 2]),
    });

    expect(output.errors[0]).toContain("unsupported_source_type");
  });

  it("does not call the Gemini client when configuration is missing", async () => {
    const client = {
      generateDocumentJson: vi.fn(async () => "{}"),
    };
    const provider = new GeminiPdfUnderstandingProvider({
      apiKey: "",
      client,
    });

    const output = await provider.run({
      ...baseInput,
      mode: "deep_pdf",
      pdfBytes: new Uint8Array([7, 8]),
    });

    expect(client.generateDocumentJson).not.toHaveBeenCalled();
    expect(output.errors[0]).toContain("missing_api_key");
  });
});
