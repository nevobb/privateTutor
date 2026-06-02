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
const LOW_QUALITY_PREVIEW_PLACEHOLDER =
  "תצוגת הנוסחה/הסימון הושמטה כי חילוץ הטקסט בחלק הזה באיכות נמוכה.";

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
    "הקובץ זוהה והטקסט חולץ, אבל חלק מהנוסחאות/הסימונים המתמטיים חולצו באיכות נמוכה ולכן אני לא מציג אותם כפי שהם. אפשר לבחור שאלה או מקטע, או לשאול שאלה ממוקדת על החומר, ואני אנסה לעבוד עם הטקסט הזמין.";

  if (result.sections.length === 0) {
    return [
      disclaimer,
      "",
      "מהטקסט שחולץ לא זיהיתי מספור מסודר של שאלות/תרגילים — הקובץ עשוי להכיל חומר רציף ללא כותרות ממוספרות.",
      "תוכל לשאול על נושא ספציפי ואמצא את החלק הרלוונטי בטקסט.",
    ].join("\n");
  }

  const listLines = result.sections.map((s, i) => {
    const previewText = isLowQualityMathExtractionPreview(s.preview)
      ? LOW_QUALITY_PREVIEW_PLACEHOLDER
      : s.preview;
    const preview = previewText ? `\n   ${previewText}` : "";
    return `${i + 1}. ${s.heading}${preview}`;
  });

  return [
    disclaimer,
    ...(hasLowQualityMathPreview ? ["", extractionQualityWarning] : []),
    `מהטקסט שחולץ זיהיתי את המקטעים הבאים:`,
    "",
    ...listLines,
    "",
    "אם תרצה, נתחיל משאלה מסוימת.",
  ].join("\n");
}
