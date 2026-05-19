export type FileExtractionInput = {
  userId: string;
  workspaceId: string;
  fileId: string;
  fileName: string;
  sourceType: "pdf" | "docx";
  storagePath: string;
  fileBuffer?: Buffer | null;
};

export type FileExtractionResult = {
  text: string;
  source:
    | "deterministic_test_parser"
    | "manual_placeholder"
    | "future_real_parser"
    | "mammoth_docx_parser"
    | "pdf_parse_pdf_parser";
  parserName?: string;
  warnings?: string[];
};

export interface FileExtractionProvider {
  extractText(input: FileExtractionInput): Promise<FileExtractionResult>;
}

class DeterministicFileExtractionProvider implements FileExtractionProvider {
  async extractText(input: FileExtractionInput): Promise<FileExtractionResult> {
    if (!input.storagePath || (input.sourceType !== "pdf" && input.sourceType !== "docx")) {
      throw new Error("unsupported_input");
    }

    return {
      text: [
        `Extraction boundary placeholder for ${input.fileName}.`,
        "Real PDF/DOCX parsing is not implemented yet.",
        `sourceType=${input.sourceType}; fileId=${input.fileId}; workspaceId=${input.workspaceId}.`,
      ].join(" "),
      source: "deterministic_test_parser",
    };
  }
}

export const fileExtractionProvider: FileExtractionProvider = new DeterministicFileExtractionProvider();
