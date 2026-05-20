import type { FileExtractionInput, FileExtractionProvider, FileExtractionResult } from "./fileExtractionProvider";

const VERY_SHORT_TEXT_THRESHOLD = 100;

type PdfParseResult = {
  text: string;
  numpages: number;
};

type DocxParseResult = {
  value: string;
  messages: unknown[];
};

type PdfParserFn = (buffer: Buffer) => Promise<PdfParseResult>;
type DocxParserFn = (buffer: Buffer) => Promise<DocxParseResult>;

async function defaultPdfParser(buffer: Buffer): Promise<PdfParseResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (b: Buffer) => Promise<PdfParseResult>;
  return pdfParse(buffer);
}

async function defaultDocxParser(buffer: Buffer): Promise<DocxParseResult> {
  const mammoth = await import("mammoth");
  return mammoth.extractRawText({ buffer });
}

function buildWarnings(text: string, sourceType: "pdf" | "docx", numpages?: number): string[] {
  const warnings: string[] = [];
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    warnings.push("empty_extracted_text");
    if (sourceType === "pdf" && numpages && numpages > 0) {
      warnings.push("possible_scanned_pdf");
    }
    return warnings;
  }

  if (trimmed.length < VERY_SHORT_TEXT_THRESHOLD) {
    warnings.push("very_short_extracted_text");
    if (sourceType === "pdf" && numpages && numpages > 1) {
      warnings.push("possible_scanned_pdf");
    }
  }

  return warnings;
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class RealDocumentExtractionProvider implements FileExtractionProvider {
  constructor(
    private readonly pdfParser: PdfParserFn = defaultPdfParser,
    private readonly docxParser: DocxParserFn = defaultDocxParser
  ) {}

  async extractText(input: FileExtractionInput): Promise<FileExtractionResult> {
    if (!input.fileBuffer) {
      throw new Error("real_parser_requires_file_buffer");
    }

    if (input.sourceType !== "pdf" && input.sourceType !== "docx") {
      throw new Error(`unsupported_source_type:${input.sourceType}`);
    }

    if (input.sourceType === "docx") {
      return this.extractDocx(input.fileBuffer);
    }

    return this.extractPdf(input.fileBuffer);
  }

  private async extractDocx(buffer: Buffer): Promise<FileExtractionResult> {
    const result = await this.docxParser(buffer);
    const text = normalizeText(result.value ?? "");
    const warnings = buildWarnings(text, "docx");

    return {
      text,
      source: "mammoth_docx_parser",
      parserName: "mammoth",
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private async extractPdf(buffer: Buffer): Promise<FileExtractionResult> {
    const result = await this.pdfParser(buffer);
    const text = normalizeText(result.text ?? "");
    const warnings = buildWarnings(text, "pdf", result.numpages);

    return {
      text,
      source: "pdf_parse_pdf_parser",
      parserName: "pdf-parse",
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}

export function createRealDocumentExtractionProvider(
  pdfParser?: PdfParserFn,
  docxParser?: DocxParserFn
): RealDocumentExtractionProvider {
  return new RealDocumentExtractionProvider(pdfParser, docxParser);
}

export const realDocumentExtractionProvider: FileExtractionProvider =
  new RealDocumentExtractionProvider();
