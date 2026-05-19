export type ChunkTextInput = {
  text: string;
  maxChars?: number;
  overlapChars?: number;
};

export type ChunkTextResult = Array<{
  text: string;
  chunkIndex: number;
  charStart: number;
  charEnd: number;
  tokenEstimate: number;
}>;

const DEFAULT_MAX_CHARS = 1200;
const DEFAULT_OVERLAP_CHARS = 150;

export function chunkExtractedText(input: ChunkTextInput): ChunkTextResult {
  const maxChars = Math.max(200, input.maxChars ?? DEFAULT_MAX_CHARS);
  const overlapChars = Math.max(0, Math.min(input.overlapChars ?? DEFAULT_OVERLAP_CHARS, maxChars - 1));

  const normalized = input.text.replace(/\r\n?/g, "\n").trim();
  if (normalized.length === 0) {
    return [];
  }

  const chunks: ChunkTextResult = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);

    if (end < normalized.length) {
      const boundary = findBoundary(normalized, start, end);
      if (boundary > start + Math.floor(maxChars * 0.6)) {
        end = boundary;
      }
    }

    const chunkText = normalized.slice(start, end).trim();
    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        chunkIndex: index,
        charStart: start,
        charEnd: end,
        tokenEstimate: Math.ceil(chunkText.length / 4),
      });
      index += 1;
    }

    if (end >= normalized.length) {
      break;
    }

    const nextStart = Math.max(end - overlapChars, start + 1);
    start = nextStart;
  }

  return chunks;
}

function findBoundary(text: string, start: number, end: number): number {
  const window = text.slice(start, end);

  const paragraphBreak = window.lastIndexOf("\n\n");
  if (paragraphBreak >= 0) {
    return start + paragraphBreak + 2;
  }

  const lineBreak = window.lastIndexOf("\n");
  if (lineBreak >= 0) {
    return start + lineBreak + 1;
  }

  const spaceBreak = window.lastIndexOf(" ");
  if (spaceBreak >= 0) {
    return start + spaceBreak + 1;
  }

  return end;
}
