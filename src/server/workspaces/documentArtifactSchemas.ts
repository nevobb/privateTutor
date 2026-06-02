import type {
  DetectedQuestionArtifactRecord,
  DocumentOutlineArtifactRecord,
  DocumentPageArtifactRecord,
  DocumentSourceReferenceRecord,
} from "./workspaceTypes";

const VALID_TEXT_QUALITIES = ["good", "partial", "poor", "empty"] as const;
const VALID_OUTLINE_CONFIDENCE = ["high", "medium", "low"] as const;

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

interface ParseContext {
  userId: string;
  fileId: string;
}

export function serializeDocumentPageArtifactRecord(
  record: DocumentPageArtifactRecord
): Record<string, unknown> {
  return {
    pageId: record.pageId,
    fileId: record.fileId,
    pageNumber: record.pageNumber,
    extractedText: record.extractedText,
    cleanedText: record.cleanedText,
    textQuality: record.textQuality,
    charCount: record.charCount,
    sourceChunkIds: record.sourceChunkIds,
    optionalPageImageRef: record.optionalPageImageRef,
    sourceReferences: record.sourceReferences,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function serializeDocumentOutlineArtifactRecord(
  record: DocumentOutlineArtifactRecord
): Record<string, unknown> {
  return {
    outlineId: record.outlineId,
    fileId: record.fileId,
    title: record.title,
    sections: record.sections,
    confidence: record.confidence,
    sourceReferences: record.sourceReferences,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function serializeDetectedQuestionArtifactRecord(
  record: DetectedQuestionArtifactRecord
): Record<string, unknown> {
  return {
    questionId: record.questionId,
    fileId: record.fileId,
    label: record.label,
    questionNumber: record.questionNumber,
    topic: record.topic,
    summary: record.summary,
    pageStart: record.pageStart,
    pageEnd: record.pageEnd,
    charStart: record.charStart,
    charEnd: record.charEnd,
    sourceChunkIds: record.sourceChunkIds,
    subsections: record.subsections,
    confidence: record.confidence,
    extractionNotes: record.extractionNotes,
    sourceReferences: record.sourceReferences,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function parseDocumentPageArtifactRecord(
  raw: unknown,
  context: ParseContext
): ValidationResult<DocumentPageArtifactRecord> {
  if (!isRecord(raw)) {
    return { ok: false, error: "Document page artifact must be an object." };
  }

  if (typeof raw.pageId !== "string" || raw.pageId.trim().length === 0) {
    return { ok: false, error: "Document page artifact pageId must be a non-empty string." };
  }

  if (!isSameFileId(raw.fileId, context.fileId)) {
    return { ok: false, error: "Document page artifact fileId does not match repository context." };
  }

  if (typeof raw.pageNumber !== "number" || raw.pageNumber < 1) {
    return { ok: false, error: "Document page artifact pageNumber must be a positive number." };
  }

  if (typeof raw.extractedText !== "string") {
    return { ok: false, error: "Document page artifact extractedText must be a string." };
  }

  if (!isDocumentTextQuality(raw.textQuality)) {
    return { ok: false, error: "Document page artifact textQuality must be one of: good, partial, poor, empty." };
  }

  if (typeof raw.charCount !== "number" || raw.charCount < 0) {
    return { ok: false, error: "Document page artifact charCount must be a non-negative number." };
  }

  if (!isStringArray(raw.sourceChunkIds)) {
    return { ok: false, error: "Document page artifact sourceChunkIds must be a string array." };
  }

  const sourceReferences = parseSourceReferences(raw.sourceReferences);
  if (!sourceReferences.ok) {
    return sourceReferences;
  }

  return {
    ok: true,
    value: {
      userId: context.userId,
      pageId: raw.pageId,
      fileId: context.fileId,
      pageNumber: raw.pageNumber,
      extractedText: raw.extractedText,
      cleanedText: typeof raw.cleanedText === "string" ? raw.cleanedText : undefined,
      textQuality: raw.textQuality,
      charCount: raw.charCount,
      sourceChunkIds: raw.sourceChunkIds,
      optionalPageImageRef: typeof raw.optionalPageImageRef === "string" ? raw.optionalPageImageRef : undefined,
      sourceReferences: sourceReferences.value,
      createdAt: toDateOrEpoch(raw.createdAt),
      updatedAt: toDateOrEpoch(raw.updatedAt),
    },
  };
}

export function parseDocumentOutlineArtifactRecord(
  raw: unknown,
  context: ParseContext
): ValidationResult<DocumentOutlineArtifactRecord> {
  if (!isRecord(raw)) {
    return { ok: false, error: "Document outline artifact must be an object." };
  }

  if (typeof raw.outlineId !== "string" || raw.outlineId.trim().length === 0) {
    return { ok: false, error: "Document outline artifact outlineId must be a non-empty string." };
  }

  if (!isSameFileId(raw.fileId, context.fileId)) {
    return { ok: false, error: "Document outline artifact fileId does not match repository context." };
  }

  if (!isOutlineConfidence(raw.confidence)) {
    return { ok: false, error: "Document outline artifact confidence must be one of: high, medium, low." };
  }

  const sections = parseDocumentSections(raw.sections);
  if (!sections.ok) {
    return sections;
  }

  const sourceReferences = parseSourceReferences(raw.sourceReferences);
  if (!sourceReferences.ok) {
    return sourceReferences;
  }

  return {
    ok: true,
    value: {
      userId: context.userId,
      outlineId: raw.outlineId,
      fileId: context.fileId,
      title: typeof raw.title === "string" ? raw.title : undefined,
      sections: sections.value,
      confidence: raw.confidence,
      sourceReferences: sourceReferences.value,
      createdAt: toDateOrEpoch(raw.createdAt),
      updatedAt: toDateOrEpoch(raw.updatedAt),
    },
  };
}

export function parseDetectedQuestionArtifactRecord(
  raw: unknown,
  context: ParseContext
): ValidationResult<DetectedQuestionArtifactRecord> {
  if (!isRecord(raw)) {
    return { ok: false, error: "Detected question artifact must be an object." };
  }

  if (typeof raw.questionId !== "string" || raw.questionId.trim().length === 0) {
    return { ok: false, error: "Detected question artifact questionId must be a non-empty string." };
  }

  if (!isSameFileId(raw.fileId, context.fileId)) {
    return { ok: false, error: "Detected question artifact fileId does not match repository context." };
  }

  if (typeof raw.label !== "string" || raw.label.trim().length === 0) {
    return { ok: false, error: "Detected question artifact label must be a non-empty string." };
  }

  if (typeof raw.charStart !== "number" || raw.charStart < 0) {
    return { ok: false, error: "Detected question artifact charStart must be a non-negative number." };
  }

  if (typeof raw.charEnd !== "number" || raw.charEnd < raw.charStart) {
    return { ok: false, error: "Detected question artifact charEnd must be >= charStart." };
  }

  if (!isStringArray(raw.sourceChunkIds)) {
    return { ok: false, error: "Detected question artifact sourceChunkIds must be a string array." };
  }

  const subsections = parseQuestionSubsections(raw.subsections);
  if (!subsections.ok) {
    return subsections;
  }

  const sourceReferences = parseSourceReferences(raw.sourceReferences);
  if (!sourceReferences.ok) {
    return sourceReferences;
  }

  return {
    ok: true,
    value: {
      userId: context.userId,
      questionId: raw.questionId,
      fileId: context.fileId,
      label: raw.label,
      questionNumber: typeof raw.questionNumber === "number" ? raw.questionNumber : undefined,
      topic: typeof raw.topic === "string" ? raw.topic : undefined,
      summary: typeof raw.summary === "string" ? raw.summary : undefined,
      pageStart: typeof raw.pageStart === "number" ? raw.pageStart : undefined,
      pageEnd: typeof raw.pageEnd === "number" ? raw.pageEnd : undefined,
      charStart: raw.charStart,
      charEnd: raw.charEnd,
      sourceChunkIds: raw.sourceChunkIds,
      subsections: subsections.value,
      confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
      extractionNotes: typeof raw.extractionNotes === "string" ? raw.extractionNotes : undefined,
      sourceReferences: sourceReferences.value,
      createdAt: toDateOrEpoch(raw.createdAt),
      updatedAt: toDateOrEpoch(raw.updatedAt),
    },
  };
}

function parseDocumentSections(raw: unknown): ValidationResult<DocumentOutlineArtifactRecord["sections"]> {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Document outline artifact sections must be an array." };
  }

  const sections: DocumentOutlineArtifactRecord["sections"] = [];
  for (const item of raw) {
    const parsed = parseDocumentSection(item);
    if (!parsed.ok) {
      return parsed;
    }
    sections.push(parsed.value);
  }

  return { ok: true, value: sections };
}

function parseDocumentSection(raw: unknown): ValidationResult<DocumentOutlineArtifactRecord["sections"][number]> {
  if (!isRecord(raw)) {
    return { ok: false, error: "Document outline section must be an object." };
  }

  if (typeof raw.sectionId !== "string" || raw.sectionId.trim().length === 0) {
    return { ok: false, error: "Document outline sectionId must be a non-empty string." };
  }

  if (typeof raw.label !== "string" || raw.label.trim().length === 0) {
    return { ok: false, error: "Document outline section label must be a non-empty string." };
  }

  if (typeof raw.charStart !== "number" || raw.charStart < 0) {
    return { ok: false, error: "Document outline section charStart must be a non-negative number." };
  }

  if (typeof raw.charEnd !== "number" || raw.charEnd < raw.charStart) {
    return { ok: false, error: "Document outline section charEnd must be >= charStart." };
  }

  if (!isStringArray(raw.sourceChunkIds)) {
    return { ok: false, error: "Document outline section sourceChunkIds must be a string array." };
  }

  const subsections = parseDocumentSections(raw.subsections ?? []);
  if (!subsections.ok) {
    return subsections;
  }

  const sourceReferences = parseSourceReferences(raw.sourceReferences);
  if (!sourceReferences.ok) {
    return sourceReferences;
  }

  return {
    ok: true,
    value: {
      sectionId: raw.sectionId,
      label: raw.label,
      title: typeof raw.title === "string" ? raw.title : undefined,
      pageStart: typeof raw.pageStart === "number" ? raw.pageStart : undefined,
      pageEnd: typeof raw.pageEnd === "number" ? raw.pageEnd : undefined,
      charStart: raw.charStart,
      charEnd: raw.charEnd,
      sourceChunkIds: raw.sourceChunkIds,
      subsections: subsections.value,
      confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
      sourceReferences: sourceReferences.value,
    },
  };
}

function parseQuestionSubsections(
  raw: unknown
): ValidationResult<DetectedQuestionArtifactRecord["subsections"]> {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Detected question artifact subsections must be an array." };
  }

  const subsections: DetectedQuestionArtifactRecord["subsections"] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      return { ok: false, error: "Detected question subsection must be an object." };
    }

    if (typeof item.label !== "string" || item.label.trim().length === 0) {
      return { ok: false, error: "Detected question subsection label must be a non-empty string." };
    }

    if (typeof item.charStart !== "number" || item.charStart < 0) {
      return { ok: false, error: "Detected question subsection charStart must be a non-negative number." };
    }

    if (typeof item.charEnd !== "number" || item.charEnd < item.charStart) {
      return { ok: false, error: "Detected question subsection charEnd must be >= charStart." };
    }

    if (!isStringArray(item.sourceChunkIds)) {
      return { ok: false, error: "Detected question subsection sourceChunkIds must be a string array." };
    }

    const sourceReferences = parseSourceReferences(item.sourceReferences);
    if (!sourceReferences.ok) {
      return sourceReferences;
    }

    subsections.push({
      label: item.label,
      charStart: item.charStart,
      charEnd: item.charEnd,
      sourceChunkIds: item.sourceChunkIds,
      sourceReferences: sourceReferences.value,
    });
  }

  return { ok: true, value: subsections };
}

function parseSourceReferences(
  raw: unknown
): ValidationResult<DocumentSourceReferenceRecord[] | undefined> {
  if (raw === undefined) {
    return { ok: true, value: undefined };
  }

  if (!Array.isArray(raw)) {
    return { ok: false, error: "Document sourceReferences must be an array when provided." };
  }

  const references: DocumentSourceReferenceRecord[] = [];
  for (const item of raw) {
    const parsed = parseSourceReference(item);
    if (!parsed.ok) {
      return parsed;
    }
    references.push(parsed.value);
  }

  return { ok: true, value: references };
}

export function parseSourceReference(raw: unknown): ValidationResult<DocumentSourceReferenceRecord> {
  if (!isRecord(raw)) {
    return { ok: false, error: "Document source reference must be an object." };
  }

  if (typeof raw.fileId !== "string" || raw.fileId.trim().length === 0) {
    return { ok: false, error: "Document source reference fileId must be a non-empty string." };
  }

  if (!isStringArray(raw.sourceChunkIds)) {
    return { ok: false, error: "Document source reference sourceChunkIds must be a string array." };
  }

  if (raw.textQuality !== undefined && !isDocumentTextQuality(raw.textQuality)) {
    return { ok: false, error: "Document source reference textQuality must be one of: good, partial, poor, empty." };
  }

  if (raw.understandingConfidence !== undefined && typeof raw.understandingConfidence !== "number") {
    return { ok: false, error: "Document source reference understandingConfidence must be a number." };
  }

  return {
    ok: true,
    value: {
      fileId: raw.fileId,
      fileName: typeof raw.fileName === "string" ? raw.fileName : undefined,
      pageNumber: typeof raw.pageNumber === "number" ? raw.pageNumber : undefined,
      pageStart: typeof raw.pageStart === "number" ? raw.pageStart : undefined,
      pageEnd: typeof raw.pageEnd === "number" ? raw.pageEnd : undefined,
      sectionId: typeof raw.sectionId === "string" ? raw.sectionId : undefined,
      questionId: typeof raw.questionId === "string" ? raw.questionId : undefined,
      sourceChunkIds: raw.sourceChunkIds,
      textQuality: raw.textQuality,
      understandingConfidence:
        typeof raw.understandingConfidence === "number" ? raw.understandingConfidence : undefined,
    },
  };
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSameFileId(value: unknown, fileId: string): boolean {
  return value === undefined || value === fileId;
}

function isDocumentTextQuality(value: unknown): value is DocumentPageArtifactRecord["textQuality"] {
  return typeof value === "string" && VALID_TEXT_QUALITIES.includes(value as (typeof VALID_TEXT_QUALITIES)[number]);
}

function isOutlineConfidence(value: unknown): value is DocumentOutlineArtifactRecord["confidence"] {
  return typeof value === "string" && VALID_OUTLINE_CONFIDENCE.includes(value as (typeof VALID_OUTLINE_CONFIDENCE)[number]);
}

function toDateOrEpoch(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const converted = (value as { toDate: () => Date }).toDate();
    if (converted instanceof Date) return converted;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date(0);
}
