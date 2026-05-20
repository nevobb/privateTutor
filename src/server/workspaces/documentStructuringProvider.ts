import type {
  DetectedQuestion,
  DocumentOutlineSection,
  DocumentPage,
  ExtractionConfidence,
  FileMaterialType,
} from "../../types";

export type DocumentStructuringInput = {
  userId: string;
  workspaceId: string;
  fileId: string;
  fileName: string;
  originalFileName?: string;
  sourceType: "pdf" | "docx";
  pages: Array<Pick<DocumentPage, "pageNumber" | "cleanedText" | "extractedText" | "textQuality">>;
};

export type DocumentStructuringQuestion = Omit<
  DetectedQuestion,
  "id" | "createdAt" | "updatedAt" | "userId" | "workspaceId" | "fileId"
>;

export type DocumentStructuringResult = {
  materialType: FileMaterialType;
  title?: string;
  sections: DocumentOutlineSection[];
  detectedQuestions: DocumentStructuringQuestion[];
  warnings?: string[];
  confidence: ExtractionConfidence;
};

export interface DocumentStructuringProvider {
  structureDocument(input: DocumentStructuringInput): Promise<DocumentStructuringResult>;
}

const HEBREW_QUESTION_REGEX = /(?:^|\s)(שאלה\s*(\d+))/g;
const ENGLISH_QUESTION_REGEX = /(?:^|\s)((?:question|exercise)\s*(\d+))/gi;

export class DeterministicDocumentStructuringProvider implements DocumentStructuringProvider {
  async structureDocument(input: DocumentStructuringInput): Promise<DocumentStructuringResult> {
    const questions: DocumentStructuringQuestion[] = [];

    for (const page of input.pages) {
      const pageText = (page.cleanedText ?? page.extractedText ?? "").trim();
      if (!pageText) continue;

      questions.push(...extractQuestions(pageText, page.pageNumber));
    }

    const deDuped = dedupeQuestions(questions);
    const sorted = deDuped.sort((a, b) => {
      const aNum = a.questionNumber ?? Number.MAX_SAFE_INTEGER;
      const bNum = b.questionNumber ?? Number.MAX_SAFE_INTEGER;
      if (aNum !== bNum) return aNum - bNum;
      if ((a.pageStart ?? 0) !== (b.pageStart ?? 0)) return (a.pageStart ?? 0) - (b.pageStart ?? 0);
      return a.labelRaw.localeCompare(b.labelRaw);
    });

    const materialType = inferMaterialType(input.fileName, sorted.length);
    const sections = buildSections(materialType, sorted);

    return {
      materialType,
      title: input.originalFileName ?? input.fileName,
      sections,
      detectedQuestions: sorted,
      warnings: sorted.length === 0 ? ["No explicit question labels detected."] : undefined,
      confidence: sorted.length > 0 ? "medium" : "low",
    };
  }
}

export function validateDocumentStructuringResult(result: unknown): DocumentStructuringResult {
  if (!result || typeof result !== "object") {
    throw new Error("Invalid document structuring result payload.");
  }

  const candidate = result as Partial<DocumentStructuringResult>;
  if (!isMaterialType(candidate.materialType)) {
    throw new Error("Invalid materialType in structuring output.");
  }
  if (!Array.isArray(candidate.sections)) {
    throw new Error("Invalid sections in structuring output.");
  }
  if (!Array.isArray(candidate.detectedQuestions)) {
    throw new Error("Invalid detectedQuestions in structuring output.");
  }

  return {
    materialType: candidate.materialType,
    title: typeof candidate.title === "string" ? candidate.title : undefined,
    sections: candidate.sections.map(validateSection),
    detectedQuestions: candidate.detectedQuestions.map(validateQuestion),
    warnings: Array.isArray(candidate.warnings)
      ? candidate.warnings.filter((item): item is string => typeof item === "string")
      : undefined,
    confidence: isConfidence(candidate.confidence) ? candidate.confidence : "low",
  };
}

function validateSection(section: unknown): DocumentOutlineSection {
  if (!section || typeof section !== "object") {
    throw new Error("Invalid section object.");
  }
  const value = section as Partial<DocumentOutlineSection>;
  if (typeof value.sectionId !== "string" || value.sectionId.trim().length === 0) {
    throw new Error("sectionId is required.");
  }

  return {
    sectionId: value.sectionId,
    label: typeof value.label === "string" ? value.label : undefined,
    title: typeof value.title === "string" ? value.title : undefined,
    sectionType: typeof value.sectionType === "string" ? value.sectionType : undefined,
    pageStart: typeof value.pageStart === "number" ? value.pageStart : undefined,
    pageEnd: typeof value.pageEnd === "number" ? value.pageEnd : undefined,
    blockIds: Array.isArray(value.blockIds)
      ? value.blockIds.filter((item): item is string => typeof item === "string")
      : undefined,
    sourceChunkIds: Array.isArray(value.sourceChunkIds)
      ? value.sourceChunkIds.filter((item): item is string => typeof item === "string")
      : undefined,
    confidence: isConfidence(value.confidence) ? value.confidence : undefined,
  };
}

function validateQuestion(question: unknown): DocumentStructuringQuestion {
  if (!question || typeof question !== "object") {
    throw new Error("Invalid detected question object.");
  }

  const value = question as Partial<DocumentStructuringQuestion>;
  if (typeof value.labelRaw !== "string" || value.labelRaw.trim().length === 0) {
    throw new Error("Detected question labelRaw is required.");
  }

  return {
    labelRaw: value.labelRaw,
    normalizedLabel: typeof value.normalizedLabel === "string" ? value.normalizedLabel : undefined,
    questionNumber: typeof value.questionNumber === "number" ? value.questionNumber : undefined,
    topic: typeof value.topic === "string" ? value.topic : undefined,
    summary: typeof value.summary === "string" ? value.summary : undefined,
    pageStart: typeof value.pageStart === "number" ? value.pageStart : undefined,
    pageEnd: typeof value.pageEnd === "number" ? value.pageEnd : undefined,
    blockIds: Array.isArray(value.blockIds)
      ? value.blockIds.filter((item): item is string => typeof item === "string")
      : undefined,
    sourceChunkIds: Array.isArray(value.sourceChunkIds)
      ? value.sourceChunkIds.filter((item): item is string => typeof item === "string")
      : undefined,
    subsections: Array.isArray(value.subsections)
      ? value.subsections.filter((item): item is string => typeof item === "string")
      : undefined,
    confidence: isConfidence(value.confidence) ? value.confidence : "low",
    extractionNotes: typeof value.extractionNotes === "string" ? value.extractionNotes : undefined,
  };
}

function extractQuestions(pageText: string, pageNumber: number): DocumentStructuringQuestion[] {
  const questions: DocumentStructuringQuestion[] = [];

  for (const match of pageText.matchAll(HEBREW_QUESTION_REGEX)) {
    const labelRaw = match[1]?.trim();
    const number = Number(match[2]);
    if (!labelRaw) continue;

    questions.push({
      labelRaw,
      normalizedLabel: `q_${number}`,
      questionNumber: Number.isFinite(number) ? number : undefined,
      pageStart: pageNumber,
      pageEnd: pageNumber,
      confidence: "high",
    });
  }

  for (const match of pageText.matchAll(ENGLISH_QUESTION_REGEX)) {
    const labelRaw = match[1]?.trim();
    const number = Number(match[2]);
    if (!labelRaw) continue;

    questions.push({
      labelRaw,
      normalizedLabel: `q_${number}`,
      questionNumber: Number.isFinite(number) ? number : undefined,
      pageStart: pageNumber,
      pageEnd: pageNumber,
      confidence: "high",
    });
  }

  return questions;
}

function dedupeQuestions(questions: DocumentStructuringQuestion[]): DocumentStructuringQuestion[] {
  const seen = new Set<string>();
  const result: DocumentStructuringQuestion[] = [];

  for (const question of questions) {
    const key = `${question.labelRaw.toLowerCase()}::${question.pageStart ?? "na"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(question);
  }

  return result;
}

function buildSections(
  materialType: FileMaterialType,
  questions: DocumentStructuringQuestion[]
): DocumentOutlineSection[] {
  const sectionType = materialType === "exam" ? "exam_section" : "question_set";
  const maxPage = questions.reduce((acc, q) => Math.max(acc, q.pageEnd ?? q.pageStart ?? 1), 1);

  return [
    {
      sectionId: "section_0001",
      label: materialType,
      title: questions.length > 0 ? "Detected questions" : "Document overview",
      sectionType,
      pageStart: 1,
      pageEnd: maxPage,
      confidence: questions.length > 0 ? "medium" : "low",
    },
  ];
}

function inferMaterialType(fileName: string, questionCount: number): FileMaterialType {
  const normalized = fileName.toLowerCase();
  if (/exam|מבחן|בחינה/.test(normalized)) return "exam";
  if (/slides|lecture|מצגת/.test(normalized)) return "slides";
  if (/summary|סיכום/.test(normalized)) return "summary";
  if (/formula|נוסחאות|דף נוסחאות/.test(normalized)) return "formula_sheet";
  if (/lab|מעבדה/.test(normalized)) return "lab_sheet";
  if (/solution|פתרון/.test(normalized)) return "solutions";
  if (/chapter|פרק|book/.test(normalized)) return "book_chapter";
  if (questionCount > 0) return "assignment";
  return "unknown";
}

function isMaterialType(value: unknown): value is FileMaterialType {
  return (
    value === "assignment" ||
    value === "exam" ||
    value === "summary" ||
    value === "lecture_notes" ||
    value === "slides" ||
    value === "formula_sheet" ||
    value === "book_chapter" ||
    value === "lab_sheet" ||
    value === "solutions" ||
    value === "unknown"
  );
}

function isConfidence(value: unknown): value is ExtractionConfidence {
  return value === "high" || value === "medium" || value === "low";
}
