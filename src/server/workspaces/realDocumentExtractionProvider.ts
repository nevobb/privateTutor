import type { FileExtractionInput, FileExtractionProvider, FileExtractionResult } from "./fileExtractionProvider";

const VERY_SHORT_TEXT_THRESHOLD = 100;

// pdf-parse v2 requires DOMMatrix (a browser DOM API not available in Node.js by default).
// Polyfill it at module load time with a minimal 2D matrix implementation so the
// pdf-parse module sees it when it initializes.
if (typeof globalThis.DOMMatrix === "undefined") {
  const _DM = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true; isIdentity = true;

    constructor(init?: number[] | string) {
      if (Array.isArray(init) && init.length === 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        this.m11 = init[0]; this.m12 = init[1];
        this.m21 = init[2]; this.m22 = init[3];
        this.m41 = init[4]; this.m42 = init[5];
        this.isIdentity = init[0] === 1 && init[1] === 0 && init[2] === 0 && init[3] === 1 && init[4] === 0 && init[5] === 0;
      } else if (Array.isArray(init) && init.length === 16) {
        [this.m11, this.m12, this.m13, this.m14, this.m21, this.m22, this.m23, this.m24, this.m31, this.m32, this.m33, this.m34, this.m41, this.m42, this.m43, this.m44] = init;
        this.a = init[0]; this.b = init[1]; this.c = init[4]; this.d = init[5]; this.e = init[12]; this.f = init[13];
        this.is2D = false;
      }
    }

    multiply(other: InstanceType<typeof _DM>): InstanceType<typeof _DM> {
      const r = new _DM();
      r.a = this.a * other.a + this.b * other.c;
      r.b = this.a * other.b + this.b * other.d;
      r.c = this.c * other.a + this.d * other.c;
      r.d = this.c * other.b + this.d * other.d;
      r.e = this.e * other.a + this.f * other.c + other.e;
      r.f = this.e * other.b + this.f * other.d + other.f;
      r.m11 = r.a; r.m12 = r.b; r.m21 = r.c; r.m22 = r.d; r.m41 = r.e; r.m42 = r.f;
      return r;
    }

    translate(tx = 0, ty = 0): InstanceType<typeof _DM> {
      const r = new _DM([this.a, this.b, this.c, this.d, this.e + tx * this.a + ty * this.c, this.f + tx * this.b + ty * this.d]);
      return r;
    }

    scale(sx = 1, sy = sx): InstanceType<typeof _DM> {
      return new _DM([this.a * sx, this.b * sx, this.c * sy, this.d * sy, this.e, this.f]);
    }

    inverse(): InstanceType<typeof _DM> {
      const det = this.a * this.d - this.b * this.c;
      if (det === 0) return new _DM();
      const inv = 1 / det;
      return new _DM([this.d * inv, -this.b * inv, -this.c * inv, this.a * inv, (this.c * this.f - this.d * this.e) * inv, (this.b * this.e - this.a * this.f) * inv]);
    }

    transformPoint(p: { x?: number; y?: number }) {
      const x = p.x ?? 0; const y = p.y ?? 0;
      return { x: x * this.a + y * this.c + this.e, y: x * this.b + y * this.d + this.f };
    }

    static fromMatrix(init: unknown): InstanceType<typeof _DM> { return new _DM(); }
    static fromFloat32Array(a: Float32Array): InstanceType<typeof _DM> { return new _DM(Array.from(a)); }
    static fromFloat64Array(a: Float64Array): InstanceType<typeof _DM> { return new _DM(Array.from(a)); }
    toFloat32Array() { return new Float32Array([this.a, this.b, 0, 0, this.c, this.d, 0, 0, 0, 0, 1, 0, this.e, this.f, 0, 1]); }
    toFloat64Array() { return new Float64Array([this.a, this.b, 0, 0, this.c, this.d, 0, 0, 0, 0, 1, 0, this.e, this.f, 0, 1]); }
  };
  (globalThis as Record<string, unknown>).DOMMatrix = _DM;
}

type PdfParseResult = {
  text: string;
  numpages?: number;
};

type DocxParseResult = {
  value: string;
  messages: unknown[];
};

type PdfParserFn = (buffer: Buffer) => Promise<PdfParseResult>;
type DocxParserFn = (buffer: Buffer) => Promise<DocxParseResult>;

async function defaultPdfParser(buffer: Buffer): Promise<PdfParseResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require("pdf-parse") as { PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string; pages?: unknown; total?: number }> } };
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  const numpages = Array.isArray(result.pages) ? result.pages.length : (typeof result.pages === "number" ? result.pages : result.total);
  return {
    text: result.text ?? "",
    numpages,
  };
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
