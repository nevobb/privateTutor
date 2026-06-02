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
  `כן, אני רואה את הקובץ, אבל כרגע אין לי ממנו רשימה מספיק נקייה של שאלות או סעיפים.\n` +
  `אם תכתוב למשל "שאלה 3", נושא מסוים, או ציטוט קצר מתוך הקובץ — אתמקד בדיוק בחלק הזה ואעזור משם.`;

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

function inferInventorySubject(...parts: Array<string | undefined>): string | null {
  const haystack = parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (/(פיזיק|מגנט|חשמל|אלקטרו)/.test(haystack)) {
    return "בפיזיקה/אלקטרומגנטיות";
  }

  if (/(מתמט|אינטגרל|נגזרת|גאומטר|אלגבר)/.test(haystack)) {
    return "במתמטיקה";
  }

  if (/(כימ|מולקול|אטומ)/.test(haystack)) {
    return "בכימיה";
  }

  return null;
}

function buildInventoryIntro(...parts: Array<string | undefined>): string[] {
  const subject = inferInventorySubject(...parts);
  return [
    "כן, אני רואה שהעלית קובץ אחד.",
    subject
      ? `נראה שזה קובץ ${subject} עם כמה שאלות/סעיפים.`
      : "נראה שזה קובץ עם כמה שאלות/סעיפים.",
  ];
}

function buildWeakExtractionWarning(): string {
  return "חלק מהנוסחאות לא חולצו מספיק טוב, אז אני לא רוצה להציג אותן כאילו הן ודאיות.";
}

function buildPracticalNextStep(): string {
  return "הכי טוב לבחור סעיף/שאלה מסוימים ונעבוד עליהם בזהירות.";
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
  const previewIsLowQuality =
    isLowQualityMathExtractionPreview(section.preview) || isLowQualityChunkSnippet(cleanPreview);
  const parsedHeadingDetailIsUseful = Boolean(
    parsedHeading.detail && !isLowQualityArtifactText(parsedHeading.detail)
  );

  let detail: string | undefined;
  if (previewIsLowQuality) {
    if (parsedHeadingDetailIsUseful && parsedHeading.detail) {
      detail = `${parsedHeading.detail} — אבל הניסוח שם לא נקלט מספיק טוב כדי לסמוך עליו לגמרי.`;
    } else {
      detail = "הניסוח במקטע הזה לא נקלט מספיק טוב כדי לסכם אותו בביטחון.";
    }
  } else if (cleanPreview.length > 0) {
    detail = cleanPreview;
  } else if (parsedHeadingDetailIsUseful && parsedHeading.detail) {
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

  if (/(,{2,}|;{2,}|:{2,}|!{2,}|\?{2,})/.test(normalized)) {
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

function isLowQualityChunkSnippet(text: string | undefined): boolean {
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

  if (/(,{2,}|;{2,}|:{2,}|!{2,}|\?{2,})/.test(normalized)) {
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
      detail: "הטקסט במקטע הזה לא חולץ מספיק טוב כדי להציג אותו בביטחון.",
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

function dedupeChunkSections(sections: FileInventorySection[]): {
  sections: FileInventorySection[];
  suppressedCount: number;
} {
  const kept: FileInventorySection[] = [];
  let suppressedCount = 0;

  const scoreSection = (section: FileInventorySection): number => {
    const parsedHeading = parseSectionHeading(section.heading);
    const preview = truncateDisplayText(section.preview);
    const previewIsClean = preview.length > 0 && !isLowQualityChunkSnippet(preview);
    const headingDetailIsClean = Boolean(
      parsedHeading.detail && !isLowQualityArtifactText(parsedHeading.detail)
    );
    return (previewIsClean ? 4 : 0) + (headingDetailIsClean ? 2 : 0);
  };

  for (const section of sections) {
    const label = parseSectionHeading(section.heading).label;
    const existingIndex = kept.findIndex((candidate) => parseSectionHeading(candidate.heading).label === label);
    if (existingIndex === -1) {
      kept.push(section);
      continue;
    }

    const existing = kept[existingIndex];
    const candidatePreview = truncateDisplayText(section.preview);
    const existingPreview = truncateDisplayText(existing.preview);
    const candidateCleanDistinct =
      candidatePreview.length > 0 &&
      existingPreview.length > 0 &&
      !isLowQualityChunkSnippet(candidatePreview) &&
      !isLowQualityChunkSnippet(existingPreview) &&
      candidatePreview !== existingPreview;

    if (candidateCleanDistinct) {
      kept.push(section);
      continue;
    }

    if (scoreSection(section) > scoreSection(existing)) {
      kept[existingIndex] = section;
    }
    suppressedCount += 1;
  }

  return { sections: kept, suppressedCount };
}

function allChunkSectionsLookLowQuality(sections: FileInventorySection[]): boolean {
  if (sections.length === 0) {
    return false;
  }

  return sections.every((section) => {
    const parsedHeading = parseSectionHeading(section.heading);
    const cleanPreview = truncateDisplayText(section.preview);
    const previewLooksWeak =
      cleanPreview.length === 0 ||
      isLowQualityMathExtractionPreview(section.preview) ||
      isLowQualityChunkSnippet(cleanPreview);
    const headingDetailLooksWeak =
      !parsedHeading.detail || isLowQualityArtifactText(parsedHeading.detail);

    return previewLooksWeak && headingDetailLooksWeak;
  });
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
  const intro = buildInventoryIntro(
    result.fileName,
    result.outlineTitle,
    ...result.items.flatMap((item) => [item.label, item.detail])
  );
  const extractionWarning = buildWeakExtractionWarning();
  const carefulFocusSuggestion =
    "אם יש שם נוסחה או תרשים שחשובים לך במיוחד, עדיף לבחור שאלה או סעיף מסוים ונתמקד רק בהם.";

  const facts = [
    result.outlineTitle ? `הכיוון הכללי שנראה מהקובץ: ${result.outlineTitle}.` : undefined,
    typeof result.detectedQuestionCount === "number" && result.detectedQuestionCount > 0
      ? `אני מצליח לזהות בו בערך ${result.detectedQuestionCount} שאלות/סעיפים.`
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
      ...intro,
      "",
      ...facts,
      ...(facts.length > 0 ? [""] : []),
      ...(hasExtractionWarning ? [extractionWarning, ""] : []),
      ...(result.deepPdfStatus === "recommended" ? [carefulFocusSuggestion, ""] : []),
      ...(result.weakArtifactsSuppressed
        ? [
            "אני כן רואה שיש שם שאלות או סעיפים, אבל החילוץ לא מספיק נקי כדי להציג אותם כסיכום בטוח.",
            buildPracticalNextStep(),
          ]
        : [
            "כרגע אין לי ממנו רשימה מספיק נקייה של שאלות או סעיפים.",
            "אם תרצה, אפשר לבחור שאלה, עמוד או ציטוט קצר ונעבוד משם.",
          ]),
    ].join("\n");
  }

  return [
    ...intro,
    "",
    ...facts,
    ...(facts.length > 0 ? [""] : []),
    ...(hasExtractionWarning ? [extractionWarning, ""] : []),
    ...(result.deepPdfStatus === "recommended" ? [carefulFocusSuggestion, ""] : []),
    result.isPartial ? "אלה הדברים שאני מצליח להוציא ממנו בזהירות:" : "אלה הדברים שאני מצליח לראות ממנו כרגע:",
    "",
    ...listLines,
    "",
    buildPracticalNextStep(),
  ].join("\n");
}

export function formatFileInventoryResponse(result: FileInventoryResult): string {
  const intro = buildInventoryIntro(
    result.fileName,
    ...result.sections.flatMap((section) => [section.heading, section.preview])
  );
  const extractionQualityWarning = buildWeakExtractionWarning();

  if (result.sections.length === 0) {
    return [
      ...intro,
      "",
      "כרגע אני לא מצליח להוציא ממנו רשימה נקייה של שאלות או סעיפים.",
      "אם תרצה, אפשר ללכת לפי נושא, מספר שאלה או ציטוט קצר מתוך הקובץ.",
    ].join("\n");
  }

  const { sections, suppressedCount } = dedupeChunkSections(result.sections);
  const hasLowQualityMathPreview = sections.some((section) =>
    isLowQualityMathExtractionPreview(section.preview) ||
    isLowQualityChunkSnippet(truncateDisplayText(section.preview))
  );
  const allSectionsWeak = allChunkSectionsLookLowQuality(sections);

  if (sections.length === 0 || allSectionsWeak) {
    return [
      ...intro,
      "",
      extractionQualityWarning,
      "",
      "אני כן רואה שיש שם שאלות או סעיפים, אבל הטקסט שיצא מהם לא מספיק נקי כדי לסכם אותם בביטחון.",
      ...(suppressedCount > 0 ? ["יש שם גם כמה שורות שבורות או כפולות, אז העדפתי לא להציג אותן כמו שהן."] : []),
      buildPracticalNextStep(),
    ].join("\n");
  }

  const listLines = sections.map((s, i) => `${i + 1}. ${buildSectionLine(s)}`);

  return [
    ...intro,
    ...(hasLowQualityMathPreview ? ["", extractionQualityWarning] : []),
    "",
    hasLowQualityMathPreview ? "אלה הסעיפים שאני מצליח לקרוא ממנו בזהירות:" : "אלה הסעיפים שאני מצליח לראות ממנו כרגע:",
    "",
    ...listLines,
    "",
    buildPracticalNextStep(),
  ].join("\n");
}
