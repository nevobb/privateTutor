export const DEFAULT_GEMINI_DOCUMENT_MODEL = "gemini-2.5-flash";

export type GeminiDocumentRequest = {
  model?: string;
  fileName: string;
  mimeType: "application/pdf";
  pdfBytes: Uint8Array;
  prompt: string;
};

export interface GeminiPdfUnderstandingClient {
  generateDocumentJson(request: GeminiDocumentRequest): Promise<string>;
}

export class GeminiPdfUnderstandingClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiPdfUnderstandingClientError";
  }
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export class FetchGeminiPdfUnderstandingClient implements GeminiPdfUnderstandingClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly model: string = DEFAULT_GEMINI_DOCUMENT_MODEL
  ) {}

  async generateDocumentJson(request: GeminiDocumentRequest): Promise<string> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new GeminiPdfUnderstandingClientError("GEMINI_API_KEY is required for Gemini PDF understanding.");
    }

    const response = await this.fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        request.model ?? this.model
      )}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: request.prompt },
                {
                  inline_data: {
                    mime_type: request.mimeType,
                    data: Buffer.from(request.pdfBytes).toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new GeminiPdfUnderstandingClientError(
        `Gemini document understanding request failed with status ${response.status}.`
      );
    }

    const data = (await response.json()) as GeminiGenerateContentResponse;
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join("\n")
      .trim();

    if (!text) {
      throw new GeminiPdfUnderstandingClientError(
        "Gemini document understanding response did not include JSON text."
      );
    }

    return text;
  }
}
