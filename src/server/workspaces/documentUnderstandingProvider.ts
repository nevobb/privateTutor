import type {
  CostMode,
  DetectedQuestionArtifact,
  DocumentOutlineArtifact,
  DocumentOutlineConfidence,
  DocumentPageArtifact,
  DocumentSourceReference,
  DocumentTextQuality,
  ExtractionQuality,
} from "../../types/index";
import {
  DEFAULT_GEMINI_DOCUMENT_MODEL,
  FetchGeminiPdfUnderstandingClient,
  type GeminiPdfUnderstandingClient,
} from "./geminiPdfUnderstandingClient";

export type DocumentUnderstandingMode = "text_only" | "deep_pdf";

export type DocumentUnderstandingInput = {
  userId: string;
  workspaceId: string;
  fileId: string;
  fileName: string;
  storagePath: string;
  sourceType: "pdf" | "docx";
  pdfBytes?: Uint8Array;
  mimeType?: string;
  extractedText?: string;
  extractedTextCharCount?: number;
  mode: DocumentUnderstandingMode;
  // Optional future policy context — not used for routing decisions in this batch
  costMode?: CostMode;
  extractionQuality?: ExtractionQuality;
};

export type DocumentQualitySignals = {
  hasExtractedText: boolean;
  extractedTextCharCount: number;
  likelyHasMath: boolean;
  likelyHasVisualContent: boolean;
  textQuality: DocumentTextQuality;
};

export type DocumentUnderstandingOutput = {
  providerName: string;
  providerMode: DocumentUnderstandingMode;
  pageCount: number;
  pages: DocumentPageArtifact[];
  outline: DocumentOutlineArtifact | null;
  detectedQuestions: DetectedQuestionArtifact[];
  qualitySignals: DocumentQualitySignals;
  extractionQuality: ExtractionQuality | null;
  confidence: DocumentOutlineConfidence;
  warnings: string[];
  errors: string[];
};

export interface DocumentUnderstandingProvider {
  readonly name: string;
  readonly mode: DocumentUnderstandingMode;
  run(input: DocumentUnderstandingInput): Promise<DocumentUnderstandingOutput>;
}

export interface PdfBytesLoader {
  loadPdfBytes(input: Pick<DocumentUnderstandingInput, "userId" | "workspaceId" | "fileId" | "fileName" | "storagePath" | "sourceType">): Promise<Uint8Array>;
}

// ---------------------------------------------------------------------------
// Quality signal helpers
// ---------------------------------------------------------------------------

const MATH_SIGNAL_PATTERN =
  /[∫∑∏∂√∞≤≥≠≈±×÷αβγδεζηθικλμνξπρστυφχψωΩ]|\$[\s\S]{1,200}\$|\\(?:frac|sqrt|int|sum|prod|lim|alpha|beta|theta|lambda|sigma|omega|partial)\b/;

function computeQualitySignals(extractedText: string | undefined): DocumentQualitySignals {
  if (!extractedText || extractedText.trim().length === 0) {
    return {
      hasExtractedText: false,
      extractedTextCharCount: 0,
      likelyHasMath: false,
      likelyHasVisualContent: false,
      textQuality: "empty",
    };
  }

  const charCount = extractedText.length;
  const printableCount = (extractedText.match(/[\x20-\x7E֐-׿Ѐ-ӿ]/g) ?? []).length;
  const printableRatio = charCount > 0 ? printableCount / charCount : 0;

  let textQuality: DocumentTextQuality;
  if (charCount === 0) {
    textQuality = "empty";
  } else if (charCount < 20 || printableRatio < 0.5) {
    textQuality = "poor";
  } else if (charCount < 200 || printableRatio < 0.7) {
    textQuality = "partial";
  } else {
    textQuality = "good";
  }

  return {
    hasExtractedText: true,
    extractedTextCharCount: charCount,
    likelyHasMath: MATH_SIGNAL_PATTERN.test(extractedText),
    likelyHasVisualContent: false,
    textQuality,
  };
}

function signalToExtractionQuality(signals: DocumentQualitySignals): ExtractionQuality | null {
  if (!signals.hasExtractedText) return null;
  if (signals.textQuality === "empty" || signals.textQuality === "poor") return "poor";
  if (signals.textQuality === "partial") return "partial";
  return "good";
}

function signalToConfidence(signals: DocumentQualitySignals, questionCount: number): DocumentOutlineConfidence {
  if (!signals.hasExtractedText || signals.textQuality === "empty" || signals.textQuality === "poor") return "low";
  if (questionCount === 0 || signals.textQuality === "partial") return "medium";
  return "high";
}

// ---------------------------------------------------------------------------
// Question detector
// ---------------------------------------------------------------------------

type RawDetection = {
  label: string;
  questionNumber?: number;
  charStart: number;
};

const PRIMARY_PATTERNS: Array<{ regex: RegExp; extractNumber: (m: RegExpMatchArray) => number | undefined }> = [
  {
    regex: /(?:^|\n)(שאלה\s+(\d+))/g,
    extractNumber: (m) => (m[2] ? parseInt(m[2], 10) : undefined),
  },
  {
    regex: /(?:^|\n)(תרגיל\s+(\d+))/g,
    extractNumber: (m) => (m[2] ? parseInt(m[2], 10) : undefined),
  },
  {
    regex: /(?:^|\n)(Question\s+(\d+))/gi,
    extractNumber: (m) => (m[2] ? parseInt(m[2], 10) : undefined),
  },
  {
    regex: /(?:^|\n)(Exercise\s+(\d+))/gi,
    extractNumber: (m) => (m[2] ? parseInt(m[2], 10) : undefined),
  },
  {
    regex: /(?:^|\n)(Problem\s+(\d+))/gi,
    extractNumber: (m) => (m[2] ? parseInt(m[2], 10) : undefined),
  },
  {
    regex: /(?:^|\n)((\d+)\.\s+\S)/gm,
    extractNumber: (m) => (m[2] ? parseInt(m[2], 10) : undefined),
  },
];

function detectQuestions(text: string): RawDetection[] {
  const hits: RawDetection[] = [];

  for (const { regex, extractNumber } of PRIMARY_PATTERNS) {
    regex.lastIndex = 0;
    let m: RegExpMatchArray | null;
    while ((m = regex.exec(text)) !== null) {
      const rawLabel = m[1] ?? m[0];
      // charStart is position of the label match within the text
      const charStart = m.index !== undefined ? m.index + (m[0].length - rawLabel.length) : 0;
      hits.push({
        label: rawLabel.trim(),
        questionNumber: extractNumber(m),
        charStart,
      });
    }
  }

  // Sort by charStart
  hits.sort((a, b) => a.charStart - b.charStart);

  // Deduplicate: if two hits at the same position (same pattern matched twice), keep only the first
  const deduped: RawDetection[] = [];
  for (const hit of hits) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(hit.charStart - last.charStart) < 5) {
      continue;
    }
    deduped.push(hit);
  }

  return deduped;
}

function buildDetectedQuestions(
  fileId: string,
  text: string,
  detections: RawDetection[]
): DetectedQuestionArtifact[] {
  return detections.map((det, idx): DetectedQuestionArtifact => {
    const nextDet = detections[idx + 1];
    const charEnd = nextDet ? nextDet.charStart : text.length;
    const questionId = `q_${String(idx + 1).padStart(3, "0")}`;

    return {
      questionId,
      fileId,
      label: det.label,
      questionNumber: det.questionNumber,
      charStart: det.charStart,
      charEnd,
      sourceChunkIds: [],
      subsections: [],
      confidence: 0.7,
    };
  });
}

function buildOutline(
  fileId: string,
  questions: DetectedQuestionArtifact[],
  signals: DocumentQualitySignals
): DocumentOutlineArtifact {
  const confidence = signalToConfidence(signals, questions.length);
  const sections = questions.map((q) => ({
    sectionId: q.questionId,
    label: q.label,
    charStart: q.charStart,
    charEnd: q.charEnd,
    sourceChunkIds: [],
    subsections: [],
    confidence: q.confidence,
  }));

  return {
    outlineId: "v1",
    fileId,
    sections,
    confidence,
  };
}

function buildPageArtifact(fileId: string, extractedText: string, signals: DocumentQualitySignals): DocumentPageArtifact {
  return {
    pageId: "page_0001",
    fileId,
    pageNumber: 1,
    extractedText,
    textQuality: signals.textQuality === "empty" ? "poor" : signals.textQuality,
    charCount: signals.extractedTextCharCount,
    sourceChunkIds: [],
  };
}

// ---------------------------------------------------------------------------
// PdfParseOutlineProvider — deterministic text-only provider
// ---------------------------------------------------------------------------

class PdfParseOutlineProvider implements DocumentUnderstandingProvider {
  readonly name = "pdf_parse_outline";
  readonly mode: DocumentUnderstandingMode = "text_only";

  async run(input: DocumentUnderstandingInput): Promise<DocumentUnderstandingOutput> {
    const text = input.extractedText ?? "";
    const signals = computeQualitySignals(text || undefined);
    const extractionQuality = signalToExtractionQuality(signals);
    const warnings: string[] = [];

    if (!signals.hasExtractedText) {
      warnings.push("no_extracted_text: outline and question detection skipped");
      return {
        providerName: this.name,
        providerMode: this.mode,
        pageCount: 0,
        pages: [],
        outline: null,
        detectedQuestions: [],
        qualitySignals: signals,
        extractionQuality,
        confidence: "low",
        warnings,
        errors: [],
      };
    }

    if (signals.textQuality === "poor") {
      warnings.push("poor_text_quality: question detection may produce incomplete results");
    }

    const detections = detectQuestions(text);
    const detectedQuestions = buildDetectedQuestions(input.fileId, text, detections);
    const outline = buildOutline(input.fileId, detectedQuestions, signals);
    const page = buildPageArtifact(input.fileId, text, signals);
    const confidence = signalToConfidence(signals, detectedQuestions.length);

    return {
      providerName: this.name,
      providerMode: this.mode,
      pageCount: 1,
      pages: [page],
      outline,
      detectedQuestions,
      qualitySignals: signals,
      extractionQuality,
      confidence,
      warnings,
      errors: [],
    };
  }
}

// ---------------------------------------------------------------------------
// GeminiPdfUnderstandingProvider — real provider behind an isolated boundary
// ---------------------------------------------------------------------------

type GeminiProviderDeps = {
  apiKey?: string;
  model?: string;
  client?: GeminiPdfUnderstandingClient;
  pdfBytesLoader?: PdfBytesLoader;
};

type GeminiStructuredPage = {
  pageNumber?: number | null;
  text?: string | null;
  textQuality?: string | null;
  sourceChunkIds?: unknown;
};

type GeminiStructuredSection = {
  sectionId?: string | null;
  label?: string | null;
  title?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  confidence?: number | null;
};

type GeminiStructuredQuestion = {
  label?: string | null;
  title?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  sectionId?: string | null;
  textPreview?: string | null;
  textQuality?: string | null;
  confidence?: number | null;
};

type GeminiStructuredResult = {
  pageCount?: number | null;
  pages?: GeminiStructuredPage[] | null;
  outline?: {
    title?: string | null;
    sections?: GeminiStructuredSection[] | null;
  } | null;
  detectedQuestions?: GeminiStructuredQuestion[] | null;
  qualitySignals?: {
    likelyHasMath?: boolean | null;
    likelyHasVisualContent?: boolean | null;
    textQuality?: string | null;
    extractedTextCharCount?: number | null;
  } | null;
  extractionQuality?: string | null;
  confidence?: number | null;
  warnings?: string[] | null;
};

export class GeminiPdfUnderstandingProvider implements DocumentUnderstandingProvider {
  readonly name = "gemini_pdf_understanding";
  readonly mode: DocumentUnderstandingMode = "deep_pdf";

  private readonly apiKey: string;
  private readonly model: string;
  private readonly client: GeminiPdfUnderstandingClient;
  private readonly pdfBytesLoader?: PdfBytesLoader;

  constructor(deps: GeminiProviderDeps = {}) {
    this.apiKey = deps.apiKey ?? process.env.GEMINI_API_KEY ?? "";
    this.model =
      deps.model ?? (process.env.GEMINI_DOCUMENT_MODEL?.trim() || DEFAULT_GEMINI_DOCUMENT_MODEL);
    this.client = deps.client ?? new FetchGeminiPdfUnderstandingClient(this.apiKey, fetch, this.model);
    this.pdfBytesLoader = deps.pdfBytesLoader;
  }

  async run(input: DocumentUnderstandingInput): Promise<DocumentUnderstandingOutput> {
    if (input.sourceType !== "pdf") {
      return this.safeFailure("unsupported_source_type: Gemini deep PDF understanding supports PDF files only.");
    }

    if (!this.apiKey || this.apiKey.trim().length === 0) {
      return this.safeFailure("missing_api_key: GEMINI_API_KEY is required for Gemini deep PDF understanding.");
    }

    const pdfBytesResult = await this.resolvePdfBytes(input);
    if (!pdfBytesResult.ok) {
      return this.safeFailure(pdfBytesResult.error);
    }

    try {
      const rawJson = await this.client.generateDocumentJson({
        model: this.model,
        fileName: input.fileName,
        mimeType: "application/pdf",
        pdfBytes: pdfBytesResult.value,
        prompt: buildGeminiDocumentPrompt(input.fileName),
      });

      const parsed = parseGeminiStructuredResult(rawJson);
      if (!parsed.ok) {
        return this.safeFailure(parsed.error);
      }

      return mapGeminiStructuredResult({
        providerName: this.name,
        providerMode: this.mode,
        fileId: input.fileId,
        fileName: input.fileName,
        payload: parsed.value,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown provider failure";
      return this.safeFailure(`provider_failure: ${message}`);
    }
  }

  private async resolvePdfBytes(
    input: DocumentUnderstandingInput
  ): Promise<{ ok: true; value: Uint8Array } | { ok: false; error: string }> {
    if (input.pdfBytes && input.pdfBytes.length > 0) {
      return { ok: true, value: input.pdfBytes };
    }

    if (!input.storagePath || input.storagePath.trim().length === 0) {
      return { ok: false, error: "missing_pdf_input: storagePath is required when inline PDF bytes are not provided." };
    }

    if (!this.pdfBytesLoader) {
      return {
        ok: false,
        error: "missing_pdf_loader: no inline PDF bytes were provided and no PdfBytesLoader is configured.",
      };
    }

    try {
      const bytes = await this.pdfBytesLoader.loadPdfBytes({
        userId: input.userId,
        workspaceId: input.workspaceId,
        fileId: input.fileId,
        fileName: input.fileName,
        storagePath: input.storagePath,
        sourceType: input.sourceType,
      });

      if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
        return { ok: false, error: "missing_pdf_bytes: PdfBytesLoader returned empty PDF bytes." };
      }

      return { ok: true, value: bytes };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown PDF loader failure";
      return { ok: false, error: `pdf_loader_failure: ${message}` };
    }
  }

  private safeFailure(error: string): DocumentUnderstandingOutput {
    return {
      providerName: this.name,
      providerMode: this.mode,
      pageCount: 0,
      pages: [],
      outline: null,
      detectedQuestions: [],
      qualitySignals: {
        hasExtractedText: false,
        extractedTextCharCount: 0,
        likelyHasMath: false,
        likelyHasVisualContent: false,
        textQuality: "empty",
      },
      extractionQuality: null,
      confidence: "low",
      warnings: [],
      errors: [error],
    };
  }
}

export const pdfParseOutlineProvider: DocumentUnderstandingProvider = new PdfParseOutlineProvider();
export const geminiPdfUnderstandingProvider: DocumentUnderstandingProvider = new GeminiPdfUnderstandingProvider();

function buildGeminiDocumentPrompt(fileName: string): string {
  return [
    "Analyze this PDF as a learning document for an academic tutor.",
    `Preserve Hebrew labels and titles when they are visible in the document (${fileName}).`,
    "Detect sections and questions without inventing missing text.",
    "If formulas, diagrams, or visual elements are unclear, mark them as low-confidence and preserve that uncertainty honestly.",
    "Do not reconstruct formulas into valid LaTeX unless they are clearly readable in the PDF.",
    "Include page references only when they are visible or strongly grounded in the document.",
    "Return structured JSON only with this exact top-level shape:",
    JSON.stringify(
      {
        pageCount: "number|null",
        pages: [
          {
            pageNumber: "number",
            text: "string",
            textQuality: "good|partial|poor",
            sourceChunkIds: [],
          },
        ],
        outline: {
          title: "string|null",
          sections: [
            {
              sectionId: "string",
              label: "string",
              title: "string|null",
              pageStart: "number|null",
              pageEnd: "number|null",
              confidence: "number",
            },
          ],
        },
        detectedQuestions: [
          {
            label: "string",
            title: "string|null",
            pageStart: "number|null",
            pageEnd: "number|null",
            sectionId: "string|null",
            textPreview: "string|null",
            textQuality: "good|partial|poor",
            confidence: "number",
          },
        ],
        qualitySignals: {
          likelyHasMath: "boolean",
          likelyHasVisualContent: "boolean",
          textQuality: "good|partial|poor",
          extractedTextCharCount: "number",
        },
        extractionQuality: "good|partial|poor",
        confidence: "number",
        warnings: ["string"],
      },
      null,
      2
    ),
  ].join("\n");
}

function parseGeminiStructuredResult(
  raw: string
): { ok: true; value: GeminiStructuredResult } | { ok: false; error: string } {
  const trimmed = raw.trim();
  const candidate = extractJsonObject(trimmed);

  if (!candidate) {
    return { ok: false, error: "invalid_json: Gemini did not return a parseable JSON object." };
  }

  try {
    const parsed = JSON.parse(candidate) as GeminiStructuredResult;
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "invalid_json: Gemini JSON did not decode into an object." };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, error: "invalid_json: Gemini returned malformed JSON." };
  }
}

function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return raw.slice(start, end + 1).trim();
}

function mapGeminiStructuredResult(input: {
  providerName: string;
  providerMode: DocumentUnderstandingMode;
  fileId: string;
  fileName: string;
  payload: GeminiStructuredResult;
}): DocumentUnderstandingOutput {
  const pages = mapPages(input.fileId, input.fileName, input.payload.pages);
  const detectedQuestions = mapDetectedQuestions(input.fileId, input.fileName, input.payload.detectedQuestions);
  const outline = mapOutline(input.fileId, input.fileName, input.payload.outline, detectedQuestions);
  const pageCount = resolvePageCount(input.payload.pageCount, pages.length);
  const qualitySignals = mapQualitySignals(input.payload.qualitySignals, pages);
  const extractionQuality = coerceExtractionQuality(input.payload.extractionQuality, qualitySignals.textQuality);
  const confidence = numericToConfidence(input.payload.confidence);
  const warnings = Array.isArray(input.payload.warnings)
    ? input.payload.warnings.filter((warning): warning is string => typeof warning === "string" && warning.trim().length > 0)
    : [];

  return {
    providerName: input.providerName,
    providerMode: input.providerMode,
    pageCount,
    pages,
    outline,
    detectedQuestions,
    qualitySignals,
    extractionQuality,
    confidence,
    warnings,
    errors: [],
  };
}

function mapPages(
  fileId: string,
  fileName: string,
  rawPages: GeminiStructuredPage[] | null | undefined
): DocumentPageArtifact[] {
  if (!Array.isArray(rawPages) || rawPages.length === 0) {
    return [];
  }

  return rawPages
    .filter((page) => typeof page?.pageNumber === "number" && page.pageNumber > 0)
    .map((page, index) => {
      const text = typeof page.text === "string" ? page.text : "";
      const textQuality = coerceDocumentTextQuality(page.textQuality);
      const sourceChunkIds = toStringArray(page.sourceChunkIds);
      const sourceReferences: DocumentSourceReference[] = [
        {
          fileId,
          fileName,
          pageNumber: page.pageNumber ?? index + 1,
          sourceChunkIds,
          textQuality,
        },
      ];

      return {
        pageId: `page_${String(page.pageNumber ?? index + 1).padStart(4, "0")}`,
        fileId,
        pageNumber: page.pageNumber ?? index + 1,
        extractedText: text,
        textQuality,
        charCount: text.length,
        sourceChunkIds,
        sourceReferences,
      };
    });
}

function mapDetectedQuestions(
  fileId: string,
  fileName: string,
  rawQuestions: GeminiStructuredQuestion[] | null | undefined
): DetectedQuestionArtifact[] {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return [];
  }

  let cursor = 0;
  return rawQuestions
    .filter((question) => typeof question?.label === "string" && question.label.trim().length > 0)
    .map((question, index) => {
      const preview = typeof question.textPreview === "string" ? question.textPreview : "";
      const syntheticLength = Math.max(preview.length, String(question.label).length, 1);
      const charStart = cursor;
      const charEnd = cursor + syntheticLength;
      cursor = charEnd + 1;
      const textQuality = coerceDocumentTextQuality(question.textQuality);

      return {
        questionId: `q_${String(index + 1).padStart(3, "0")}`,
        fileId,
        label: String(question.label).trim(),
        topic: typeof question.title === "string" ? question.title : undefined,
        summary: preview || undefined,
        pageStart: asPositiveNumber(question.pageStart),
        pageEnd: asPositiveNumber(question.pageEnd),
        charStart,
        charEnd,
        sourceChunkIds: [],
        subsections: [],
        confidence: clampConfidence(question.confidence),
        extractionNotes:
          textQuality !== "good" ? "low_confidence_pdf_extraction: question text may be incomplete or visually ambiguous." : undefined,
        sourceReferences: [
          {
            fileId,
            fileName,
            pageStart: asPositiveNumber(question.pageStart),
            pageEnd: asPositiveNumber(question.pageEnd),
            sectionId: typeof question.sectionId === "string" ? question.sectionId : undefined,
            questionId: `q_${String(index + 1).padStart(3, "0")}`,
            sourceChunkIds: [],
            textQuality,
            understandingConfidence: clampConfidence(question.confidence),
          },
        ],
      };
    });
}

function mapOutline(
  fileId: string,
  fileName: string,
  rawOutline: GeminiStructuredResult["outline"],
  detectedQuestions: DetectedQuestionArtifact[]
): DocumentOutlineArtifact | null {
  const rawSections = rawOutline?.sections;
  if (!Array.isArray(rawSections) || rawSections.length === 0) {
    return detectedQuestions.length > 0
      ? {
          outlineId: "v1",
          fileId,
          title: rawOutline?.title ?? undefined,
          sections: detectedQuestions.map((question) => ({
            sectionId: question.questionId,
            label: question.label,
            title: question.topic,
            pageStart: question.pageStart,
            pageEnd: question.pageEnd,
            charStart: question.charStart,
            charEnd: question.charEnd,
            sourceChunkIds: question.sourceChunkIds,
            subsections: [],
            confidence: question.confidence,
            sourceReferences: question.sourceReferences,
          })),
          confidence: "medium",
          sourceReferences: detectedQuestions.flatMap((question) => question.sourceReferences ?? []),
        }
      : null;
  }

  let cursor = 0;
  const sections = rawSections
    .filter((section) => typeof section?.label === "string" && section.label.trim().length > 0)
    .map((section, index) => {
      const matchingQuestion = detectedQuestions[index];
      const syntheticLength = Math.max(
        String(section.label).length + (typeof section.title === "string" ? section.title.length : 0),
        matchingQuestion ? matchingQuestion.charEnd - matchingQuestion.charStart : 1
      );
      const charStart = matchingQuestion?.charStart ?? cursor;
      const charEnd = matchingQuestion?.charEnd ?? charStart + syntheticLength;
      cursor = charEnd + 1;

      return {
        sectionId:
          typeof section.sectionId === "string" && section.sectionId.trim().length > 0
            ? section.sectionId
            : `section_${String(index + 1).padStart(3, "0")}`,
        label: String(section.label).trim(),
        title: typeof section.title === "string" ? section.title : undefined,
        pageStart: asPositiveNumber(section.pageStart),
        pageEnd: asPositiveNumber(section.pageEnd),
        charStart,
        charEnd,
        sourceChunkIds: [],
        subsections: [],
        confidence: clampConfidence(section.confidence),
        sourceReferences: [
          {
            fileId,
            fileName,
            pageStart: asPositiveNumber(section.pageStart),
            pageEnd: asPositiveNumber(section.pageEnd),
            sectionId:
              typeof section.sectionId === "string" && section.sectionId.trim().length > 0
                ? section.sectionId
                : `section_${String(index + 1).padStart(3, "0")}`,
            sourceChunkIds: [],
            understandingConfidence: clampConfidence(section.confidence),
          },
        ],
      };
    });

  const averageConfidence =
    sections.length > 0
      ? sections.reduce((sum, section) => sum + section.confidence, 0) / sections.length
      : 0;

  return {
    outlineId: "v1",
    fileId,
    title: typeof rawOutline?.title === "string" ? rawOutline.title : undefined,
    sections,
    confidence: numericToConfidence(averageConfidence),
    sourceReferences: sections.flatMap((section) => section.sourceReferences ?? []),
  };
}

function mapQualitySignals(
  rawSignals: GeminiStructuredResult["qualitySignals"],
  pages: DocumentPageArtifact[]
): DocumentQualitySignals {
  const extractedTextCharCount =
    typeof rawSignals?.extractedTextCharCount === "number"
      ? rawSignals.extractedTextCharCount
      : pages.reduce((sum, page) => sum + page.charCount, 0);
  const textQuality = coerceDocumentTextQuality(rawSignals?.textQuality);

  return {
    hasExtractedText: extractedTextCharCount > 0,
    extractedTextCharCount,
    likelyHasMath: rawSignals?.likelyHasMath === true,
    likelyHasVisualContent: rawSignals?.likelyHasVisualContent === true,
    textQuality,
  };
}

function resolvePageCount(pageCount: number | null | undefined, pagesLength: number): number {
  if (typeof pageCount === "number" && pageCount >= 0) {
    return pageCount;
  }
  return pagesLength;
}

function numericToConfidence(value: number | null | undefined): DocumentOutlineConfidence {
  const normalized = clampConfidence(value);
  if (normalized >= 0.75) return "high";
  if (normalized >= 0.45) return "medium";
  return "low";
}

function clampConfidence(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(3));
}

function coerceDocumentTextQuality(value: unknown): DocumentTextQuality {
  if (value === "good" || value === "partial" || value === "poor") {
    return value;
  }
  if (value === "empty") {
    return "empty";
  }
  return "partial";
}

function coerceExtractionQuality(
  value: unknown,
  fallbackTextQuality: DocumentTextQuality
): ExtractionQuality | null {
  if (value === "good" || value === "partial" || value === "poor") {
    return value;
  }
  if (fallbackTextQuality === "good" || fallbackTextQuality === "partial" || fallbackTextQuality === "poor") {
    return fallbackTextQuality;
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && value > 0 ? value : undefined;
}
