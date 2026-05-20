import type { DocumentStructuringInput, DocumentStructuringProvider, DocumentStructuringResult } from "./documentStructuringProvider";

const GEMINI_TEXT_MODEL = "gemini-2.0-flash";

export class GeminiDocumentStructuringProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiDocumentStructuringProviderError";
  }
}

export class GeminiDocumentStructuringProvider implements DocumentStructuringProvider {
  constructor(private readonly apiKey: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async structureDocument(input: DocumentStructuringInput): Promise<DocumentStructuringResult> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new GeminiDocumentStructuringProviderError("GEMINI_API_KEY is required for Gemini document structuring.");
    }

    const prompt = buildPrompt(input);
    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new GeminiDocumentStructuringProviderError(
        `Gemini document structuring request failed with status ${response.status}.`
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== "string") {
      throw new GeminiDocumentStructuringProviderError("Gemini returned no JSON content for document structuring.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new GeminiDocumentStructuringProviderError("Gemini returned malformed JSON for document structuring.");
    }

    return parsed as DocumentStructuringResult;
  }
}

function buildPrompt(input: DocumentStructuringInput): string {
  const pages = input.pages
    .slice(0, 30)
    .map((page) => `Page ${page.pageNumber}:\n${(page.cleanedText ?? page.extractedText ?? "").slice(0, 4000)}`)
    .join("\n\n");

  return [
    "You are a document-structuring assistant for academic study materials.",
    "Return JSON only with keys: materialType, title, sections, detectedQuestions, warnings, confidence.",
    "Use materialType one of: assignment, exam, summary, lecture_notes, slides, formula_sheet, book_chapter, lab_sheet, solutions, unknown.",
    "For detectedQuestions, keep real labels from text when present.",
    `File name: ${input.originalFileName ?? input.fileName}`,
    `Source type: ${input.sourceType}`,
    pages,
  ].join("\n\n");
}
