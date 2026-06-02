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

  if (result.sections.length === 0) {
    return [
      disclaimer,
      "",
      "מהטקסט שחולץ לא זיהיתי מספור מסודר של שאלות/תרגילים — הקובץ עשוי להכיל חומר רציף ללא כותרות ממוספרות.",
      "תוכל לשאול על נושא ספציפי ואמצא את החלק הרלוונטי בטקסט.",
    ].join("\n");
  }

  const listLines = result.sections.map((s, i) => {
    const preview = s.preview ? `\n   ${s.preview}` : "";
    return `${i + 1}. ${s.heading}${preview}`;
  });

  return [
    disclaimer,
    `מהטקסט שחולץ זיהיתי את המקטעים הבאים:`,
    "",
    ...listLines,
    "",
    "אם תרצה, נתחיל משאלה מסוימת.",
  ].join("\n");
}
