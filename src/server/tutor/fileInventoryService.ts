import type {
  DetectedQuestionArtifactRecord,
  DocumentOutlineArtifactRecord,
  FileChunkRecord,
} from "../workspaces/workspaceTypes";
import type { DeepPdfStatus, ExtractionQuality } from "../../types";

// TODO (Phase C — Document Understanding Layer):
// Replace INVENTORY_NOT_AVAILABLE_RESPONSE with real structured output read from
// detectedQuestions subcollection when understandingStatus === "completed".
// See docs/DOCUMENT_UNDERSTANDING_LAYER.md for the full design.
export const INVENTORY_NOT_AVAILABLE_RESPONSE =
  `אני עובד עם הטקסט שחולץ מהקובץ, אבל עדיין אין לי שכבת זיהוי שאלות אמינה לקובץ הזה.\n` +
  `כרגע אני יכול לחפש לפי מספר שאלה, נושא, או מילת מפתח מתוך הקובץ. ` +
  `אם תכתוב למשל "שאלה 3" או "השאלה על קיבול", אמצא את המקטע הרלוונטי ואסביר אותו.`;

export interface FileInventorySection {
  heading: string;
  preview: string;
  chunkIndex: number;
}

export interface FileInventoryResult {
  fileName: string;
  sections: FileInventorySection[];
  isBestEffort: true;
}

export interface ArtifactInventoryItem {
  label: string;
  detail?: string;
  pageLabel?: string;
  isPartial?: boolean;
}

export interface ArtifactAwareFileInventoryResult {
  fileName: string;
  pageCount?: number;
  outlineTitle?: string;
  detectedQuestionCount?: number;
  extractionQuality?: ExtractionQuality;
  deepPdfStatus?: DeepPdfStatus;
  items: ArtifactInventoryItem[];
  isPartial: boolean;
  weakArtifactsSuppressed?: boolean;
}

const MAX_SECTIONS = 30;
const PREVIEW_MAX_CHARS = 120;
const HEBREW_SECTION_LETTERS = "אבגדהוזחטיכלמנסעפצקרשת";

const SECTION_PATTERNS: RegExp[] = [
  /^שאלה\s+\d+/m,
  /^תרגיל\s+\d+/m,
  /^סעיף\s+\d+/m,
  /^מטלה\s+\d+/m,
  /^\d+\.\s+\S/m,
  /^Question\s+\d+/im,
  /^Exercise\s+\d+/im,
  /^Problem\s+\d+/im,
  /^\(\s*[אבגדהוזחטיכלמנסעפצקרשת]\s*\)/m,
  /^[אבגדהוזחטיכלמנסעפצקרשת]\.\s+\S/m,
];

export function isLowQualityMathExtractionPreview(preview: string): boolean {
  const normalized = preview.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return false;
  }

  const hasPrivateUseGlyph = /[\uF000-\uF8FF]/u.test(normalized);
  const hasMathOperator = /[=+\-*/^≈≤≥±∑∫√∞∂µπ]/u.test(normalized);
  const tokens = normalized.split(" ").filter(Boolean);
  const singleCharTokenCount = tokens.filter((token) => token.length === 1).length;
  const singleCharRatio = tokens.length > 0 ? singleCharTokenCount / tokens.length : 0;
  const digitTokenCount = tokens.filter((token) => /^\d+$/.test(token)).length;
  const digitRatio = tokens.length > 0 ? digitTokenCount / tokens.length : 0;

  if (hasPrivateUseGlyph) {
    return true;
  }

  return tokens.length >= 6 && hasMathOperator && singleCharRatio >= 0.45 && digitRatio >= 0.2;
}

function normalizeDisplayText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s*-\s*/g, "-")
    .trim();
}

function truncateDisplayText(text: string, maxChars = 100): string {
  const normalized = normalizeDisplayText(text);
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

function buildLetterSectionLabel(letter: string): string {
  return `מקטע ${letter}׳`;
}

function parseSectionHeading(heading: string): { label: string; detail?: string } {
  const normalized = normalizeDisplayText(heading);

  let match = /^שאלה\s+(\d+)(?:\s*[-–—:]?\s*(.*))?$/i.exec(normalized);
  if (match) {
    return { label: `שאלה ${match[1]}`, detail: match[2] ? truncateDisplayText(match[2]) : undefined };
  }

  match = /^תרגיל\s+(\d+)(?:\s*[-–—:]?\s*(.*))?$/i.exec(normalized);
  if (match) {
    return { label: `תרגיל ${match[1]}`, detail: match[2] ? truncateDisplayText(match[2]) : undefined };
  }

  match = /^סעיף\s+(\d+)(?:\s*[-–—:]?\s*(.*))?$/i.exec(normalized);
  if (match) {
    return { label: `סעיף ${match[1]}`, detail: match[2] ? truncateDisplayText(match[2]) : undefined };
  }

  match = /^מטלה\s+(\d+)(?:\s*[-–—:]?\s*(.*))?$/i.exec(normalized);
  if (match) {
    return { label: `מטלה ${match[1]}`, detail: match[2] ? truncateDisplayText(match[2]) : undefined };
  }

  match = /^Question\s+(\d+)(?:\s*[-–—:]?\s*(.*))?$/i.exec(normalized);
  if (match) {
    return { label: `Question ${match[1]}`, detail: match[2] ? truncateDisplayText(match[2]) : undefined };
  }

  match = /^Exercise\s+(\d+)(?:\s*[-–—:]?\s*(.*))?$/i.exec(normalized);
  if (match) {
    return { label: `Exercise ${match[1]}`, detail: match[2] ? truncateDisplayText(match[2]) : undefined };
  }

  match = /^Problem\s+(\d+)(?:\s*[-–—:]?\s*(.*))?$/i.exec(normalized);
  if (match) {
    return { label: `Problem ${match[1]}`, detail: match[2] ? truncateDisplayText(match[2]) : undefined };
  }

  match = new RegExp(`^\\(\\s*([${HEBREW_SECTION_LETTERS}])\\s*\\)\\s*(.*)$`).exec(normalized);
  if (match) {
    return {
      label: buildLetterSectionLabel(match[1]),
      detail: match[2] ? truncateDisplayText(match[2]) : undefined,
    };
  }

  match = new RegExp(`^([${HEBREW_SECTION_LETTERS}])\\.\\s*(.*)$`).exec(normalized);
  if (match) {
    return {
      label: buildLetterSectionLabel(match[1]),
      detail: match[2] ? truncateDisplayText(match[2]) : undefined,
    };
  }

  match = /^(\d+)\.\s*(.*)$/.exec(normalized);
  if (match) {
    return {
      label: `שאלה/מקטע ${match[1]}`,
      detail: match[2] ? truncateDisplayText(match[2]) : undefined,
    };
  }

  return { label: truncateDisplayText(normalized, 60) };
}

function buildSectionLine(section: FileInventorySection): string {
  const parsedHeading = parseSectionHeading(section.heading);
  const cleanPreview = truncateDisplayText(section.preview);
  const previewIsLowQuality = isLowQualityMathExtractionPreview(section.preview);

  let detail: string | undefined;
  if (previewIsLowQuality) {
    if (parsedHeading.detail) {
      detail = `${parsedHeading.detail} (זוהה חלקית)`;
    } else {
      detail = "זוהה חלקית; התוכן המתמטי במקטע הזה לא נקלט בצורה אמינה.";
    }
  } else if (cleanPreview.length > 0) {
    detail = cleanPreview;
  } else if (parsedHeading.detail) {
    detail = parsedHeading.detail;
  }

  return detail ? `${parsedHeading.label} — ${detail}` : parsedHeading.label;
}

function buildPageLabel(pageStart?: number, pageEnd?: number): string | undefined {
  if (typeof pageStart === "number" && typeof pageEnd === "number") {
    return pageStart === pageEnd ? `עמוד ${pageStart}` : `עמודים ${pageStart}-${pageEnd}`;
  }
  if (typeof pageStart === "number") {
    return `עמוד ${pageStart}`;
  }
  if (typeof pageEnd === "number") {
    return `עמוד ${pageEnd}`;
  }
  return undefined;
}

function truncateArtifactDetail(text: string): string {
  return truncateDisplayText(text, 90);
}

function isLowQualityArtifactText(text: string | undefined): boolean {
  if (!text) {
    return true;
  }

  const normalized = normalizeDisplayText(text);
  if (normalized.length === 0) {
    return true;
  }

  if (isLowQualityMathExtractionPreview(normalized)) {
    return true;
  }

  if (/[,.;:!?]{2,}/.test(normalized)) {
    return true;
  }

  if (/(?:\b[a-zA-Z]\b[\s,]*){3,}/.test(normalized)) {
    return true;
  }

  const hebrewTokens = normalized.match(/[א-ת]+/g) ?? [];
  const singleHebrewTokenCount = hebrewTokens.filter((token) => token.length === 1).length;
  const multiCharHebrewTokenCount = hebrewTokens.filter((token) => token.length > 1).length;
  if (singleHebrewTokenCount >= 2 && multiCharHebrewTokenCount <= 1) {
    return true;
  }

  if (/(?:^|\s)[א-ת](?:\s+[א-ת]){1,}\s+[א-ת]{2,}(?:\s|$)/.test(normalized)) {
    return true;
  }

  if (singleHebrewTokenCount >= 2 && singleHebrewTokenCount >= multiCharHebrewTokenCount) {
    return true;
  }

  const longWordCount = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3).length;
  if (normalized.length < 24 && longWordCount < 2) {
    return true;
  }

  return false;
}

function isArtifactDetailUseful(detail: string | undefined): boolean {
  if (!detail) {
    return false;
  }
  return !isLowQualityArtifactText(detail);
}

function buildArtifactItemDetail(question: DetectedQuestionArtifactRecord): {
  detail?: string;
  isPartial: boolean;
} {
  const isPartial =
    question.confidence < 0.75 ||
    Boolean(question.extractionNotes) ||
    (!question.summary && !question.topic);

  if (question.summary) {
    const summary = truncateArtifactDetail(question.summary);
    const summaryUseful = isArtifactDetailUseful(summary);
    return {
      detail: summaryUseful
        ? isPartial
          ? `${summary} (זוהה חלקית)`
          : summary
        : undefined,
      isPartial: isPartial || !summaryUseful,
    };
  }

  if (question.topic) {
    const topic = truncateArtifactDetail(question.topic);
    const topicUseful = isArtifactDetailUseful(topic);
    return {
      detail: topicUseful
        ? isPartial
          ? `כנראה עוסק ב-${topic} (זוהה חלקית)`
          : `כנראה עוסק ב-${topic}`
        : undefined,
      isPartial: isPartial || !topicUseful,
    };
  }

  if (question.extractionNotes) {
    return {
      detail: "זוהה חלקית; הטקסט או הסימונים במקטע הזה לא חולצו בצורה מלאה.",
      isPartial: true,
    };
  }

  return { detail: undefined, isPartial };
}

function buildArtifactOutlineItems(
  outline: DocumentOutlineArtifactRecord
): ArtifactInventoryItem[] {
  return outline.sections.slice(0, MAX_SECTIONS).map((section) => ({
    label: section.label,
    detail:
      section.title && isArtifactDetailUseful(section.title)
        ? truncateArtifactDetail(section.title)
        : undefined,
    pageLabel: buildPageLabel(section.pageStart, section.pageEnd),
    isPartial: section.confidence < 0.75 || (section.title ? isLowQualityArtifactText(section.title) : false),
  }));
}

function dedupeArtifactItems(items: ArtifactInventoryItem[]): {
  items: ArtifactInventoryItem[];
  suppressedCount: number;
} {
  const kept: ArtifactInventoryItem[] = [];
  let suppressedCount = 0;

  const scoreItem = (item: ArtifactInventoryItem): number => {
    let score = 0;
    if (item.detail && !isLowQualityArtifactText(item.detail)) score += 4;
    if (item.pageLabel) score += 1;
    if (!item.isPartial) score += 2;
    return score;
  };

  for (const item of items) {
    const existingIndex = kept.findIndex((candidate) => candidate.label === item.label);
    if (existingIndex === -1) {
      kept.push(item);
      continue;
    }

    const existing = kept[existingIndex];
    const candidateCleanDistinct =
      Boolean(item.detail) &&
      Boolean(existing.detail) &&
      !isLowQualityArtifactText(item.detail) &&
      !isLowQualityArtifactText(existing.detail) &&
      item.detail !== existing.detail;

    if (candidateCleanDistinct) {
      kept.push(item);
      continue;
    }

    if (scoreItem(item) > scoreItem(existing)) {
      kept[existingIndex] = item;
    }
    suppressedCount += 1;
  }

  return { items: kept, suppressedCount };
}

export function buildArtifactAwareFileInventory(params: {
  fileName: string;
  pageCount?: number;
  outlineTitle?: string;
  detectedQuestionCount?: number;
  extractionQuality?: ExtractionQuality;
  deepPdfStatus?: DeepPdfStatus;
  outline: DocumentOutlineArtifactRecord | null;
  detectedQuestions: DetectedQuestionArtifactRecord[];
}): ArtifactAwareFileInventoryResult | null {
  const rawItems =
    params.detectedQuestions.length > 0
      ? params.detectedQuestions.slice(0, MAX_SECTIONS).map((question) => {
          const built = buildArtifactItemDetail(question);
          return {
            label: question.label,
            detail: built.detail,
            pageLabel: buildPageLabel(question.pageStart, question.pageEnd),
            isPartial: built.isPartial,
          };
        })
      : params.outline && params.outline.sections.length > 0
        ? buildArtifactOutlineItems(params.outline)
        : [];
  const filteredItems = rawItems.filter(
    (item) => !item.isPartial || Boolean(item.detail && !isLowQualityArtifactText(item.detail))
  );
  const { items, suppressedCount } = dedupeArtifactItems(filteredItems);

  const pageCount = params.pageCount;
  const detectedQuestionCount = params.detectedQuestionCount ?? params.detectedQuestions.length;
  const hasUsefulFacts =
    items.length > 0 ||
    typeof pageCount === "number" ||
    Boolean(params.outlineTitle) ||
    (typeof detectedQuestionCount === "number" && detectedQuestionCount > 0);

  if (!hasUsefulFacts) {
    return null;
  }

  const isPartial =
    params.extractionQuality === "partial" ||
    params.extractionQuality === "poor" ||
    items.some((item) => item.isPartial) ||
    suppressedCount > 0;

  return {
    fileName: params.fileName,
    pageCount,
    outlineTitle: params.outlineTitle,
    detectedQuestionCount,
    extractionQuality: params.extractionQuality,
    deepPdfStatus: params.deepPdfStatus,
    items,
    isPartial,
    weakArtifactsSuppressed: rawItems.length > 0 && items.length === 0,
  };
}

export function buildFileInventory(
  fileName: string,
  chunks: FileChunkRecord[]
): FileInventoryResult {
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const sections: FileInventorySection[] = [];

  for (const chunk of sorted) {
    if (sections.length >= MAX_SECTIONS) break;

    for (const pattern of SECTION_PATTERNS) {
      const match = pattern.exec(chunk.text);
      if (match) {
        const matchIndex = match.index ?? 0;
        const headingEnd = chunk.text.indexOf("\n", matchIndex);
        const heading = (
          headingEnd === -1
            ? chunk.text.slice(matchIndex, matchIndex + 60)
            : chunk.text.slice(matchIndex, headingEnd)
        ).trim();

        const previewStart = headingEnd === -1 ? matchIndex + heading.length : headingEnd + 1;
        const previewRaw = chunk.text.slice(previewStart, previewStart + PREVIEW_MAX_CHARS).trim();
        const preview = previewRaw.length > 100
          ? previewRaw.slice(0, 100) + "…"
          : previewRaw;

        sections.push({ heading, preview, chunkIndex: chunk.chunkIndex });
        break;
      }
    }
  }

  return { fileName, sections, isBestEffort: true };
}

export function formatArtifactAwareFileInventoryResponse(
  result: ArtifactAwareFileInventoryResult
): string {
  const disclaimer =
    "אני עובד עם הטקסט שחולץ מהקובץ, לא עם תצוגה חזותית של ה-PDF.";
  const extractionWarning =
    "חשוב: חלק מהנוסחאות, הסימונים המתמטיים, או מבנה המסמך חולצו באיכות חלקית, לכן חלק מהמקטעים מזוהים באופן חלקי.";
  const deepPdfRecommendation =
    "המסמך כנראה דורש עיבוד מתקדם יותר כדי להבין נוסחאות/תרשימים בצורה אמינה.";

  const facts = [
    typeof result.pageCount === "number" ? `מספר עמודים שזוהו: ${result.pageCount}` : undefined,
    result.outlineTitle ? `כותרת/נושא שזוהה: ${result.outlineTitle}` : undefined,
    typeof result.detectedQuestionCount === "number"
      ? `מספר שאלות/מקטעים שזוהו: ${result.detectedQuestionCount}`
      : undefined,
  ].filter(Boolean) as string[];

  const listLines = result.items.map((item, index) => {
    const details = [item.detail, item.pageLabel].filter(Boolean).join(" · ");
    return details ? `${index + 1}. ${item.label} — ${details}` : `${index + 1}. ${item.label}`;
  });

  const hasExtractionWarning =
    result.extractionQuality === "partial" || result.extractionQuality === "poor";

  if (result.items.length === 0) {
    return [
      "הקובץ זוהה והטקסט חולץ.",
      disclaimer,
      "",
      ...facts,
      ...(facts.length > 0 ? [""] : []),
      ...(hasExtractionWarning ? [extractionWarning, ""] : []),
      ...(result.deepPdfStatus === "recommended" ? [deepPdfRecommendation, ""] : []),
      ...(result.weakArtifactsSuppressed
        ? [
            "זוהו מקטעים/שאלות בקובץ, אבל איכות החילוץ לא מספיקה כדי להציג אותם כסיכום אמין.",
            "בחר שאלה, עמוד, או שלח ציטוט קצר מהקובץ ואמשיך משם בזהירות.",
          ]
        : [
            "זוהו פרטי מסמך בסיסיים, אבל עדיין אין מספיק מקטעים מובנים כדי להציג רשימה טובה.",
            "אפשר לבחור שאלה, עמוד, או נושא ספציפי ונמשיך משם.",
          ]),
    ].join("\n");
  }

  return [
    "הקובץ זוהה והטקסט חולץ.",
    disclaimer,
    "",
    ...facts,
    ...(facts.length > 0 ? [""] : []),
    ...(hasExtractionWarning ? [extractionWarning, ""] : []),
    ...(result.deepPdfStatus === "recommended" ? [deepPdfRecommendation, ""] : []),
    result.isPartial ? "שאלות/מקטעים שזוהו חלקית:" : "שאלות/מקטעים שזוהו:",
    "",
    ...listLines,
    "",
    result.isPartial
      ? "כדי לעבוד בצורה טובה יותר, בחר שאלה/מקטע מסוים או ציין עמוד/ציטוט קצר ממנו."
      : "אם תרצה, בחר שאלה/מקטע מסוים ונמשיך משם.",
  ].join("\n");
}

export function formatFileInventoryResponse(result: FileInventoryResult): string {
  const disclaimer =
    "אני עובד עם הטקסט שחולץ מהקובץ, לא עם תצוגה חזותית של ה-PDF.";
  const hasLowQualityMathPreview = result.sections.some((section) =>
    isLowQualityMathExtractionPreview(section.preview)
  );
  const extractionQualityWarning =
    "חשוב: חלק מהנוסחאות והסימונים המתמטיים חולצו באיכות נמוכה, לכן אני לא מציג אותם כאילו הם נוסחה תקינה.";

  if (result.sections.length === 0) {
    return [
      "הקובץ זוהה והטקסט חולץ.",
      disclaimer,
      "",
      "מהטקסט שחולץ לא זיהיתי מספור מסודר של שאלות/תרגילים — הקובץ עשוי להכיל חומר רציף ללא כותרות ממוספרות.",
      "תוכל לשאול על נושא ספציפי ואמצא את החלק הרלוונטי בטקסט.",
    ].join("\n");
  }

  const listLines = result.sections.map((s, i) => `${i + 1}. ${buildSectionLine(s)}`);

  return [
    "הקובץ זוהה והטקסט חולץ.",
    disclaimer,
    ...(hasLowQualityMathPreview ? ["", extractionQualityWarning] : []),
    "",
    hasLowQualityMathPreview ? "מקטעים שזוהו חלקית:" : "מקטעים שזוהו:",
    "",
    ...listLines,
    "",
    hasLowQualityMathPreview
      ? "כדי לעבוד בצורה טובה יותר, בחר שאלה/מקטע מסוים או ציין עמוד/ציטוט קצר ממנו."
      : "אם תרצה, בחר שאלה/מקטע מסוים ונמשיך משם.",
  ].join("\n");
}
