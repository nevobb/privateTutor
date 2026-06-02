import type { FileChunkRecord } from "../workspaces/workspaceTypes";

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
