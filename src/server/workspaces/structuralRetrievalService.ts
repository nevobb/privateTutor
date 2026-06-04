import type { DetectedQuestionArtifact, DocumentPageArtifact } from "../../types";

// ── moved verbatim from sessionMessageApiService.ts ──

export type ArtifactGroundingSignal = {
  number?: string;
  letter?: string;
};

export function normalizeHebrewGroundingLetter(letter: string): string {
  return letter.replace(/[׳'"]/g, "").trim();
}

export function extractRequestedPages(message: string): number[] {
  return Array.from(message.matchAll(/עמוד\s+(\d+)/g), (match) => Number(match[1])).filter(
    (value) => Number.isFinite(value) && value > 0
  );
}

export function extractArtifactGroundingSignals(message: string): ArtifactGroundingSignal[] {
  const signals: ArtifactGroundingSignal[] = [];

  for (const match of message.matchAll(/(?:שאלה|תרגיל|סעיף|מקטע|question|exercise|problem)\s+(\d+)/gi)) {
    signals.push({ number: match[1] });
  }

  for (const match of message.matchAll(/(?:סעיף|מקטע)\s+([אבגדהוזחטיכלמנסעפצקרשת])[׳'"]?/g)) {
    signals.push({ letter: normalizeHebrewGroundingLetter(match[1]) });
  }

  return signals;
}

export function matchesArtifactGroundingSignals(label: string, signals: ArtifactGroundingSignal[]): boolean {
  const numericMatch = label.match(/(?:שאלה|תרגיל|סעיף|מקטע|question|exercise|problem)\s+(\d+)/i);
  const letterMatch = label.match(/(?:סעיף|מקטע)\s+([אבגדהוזחטיכלמנסעפצקרשת])[׳'"]?/);
  const labelNumber = numericMatch?.[1];
  const labelLetter = letterMatch ? normalizeHebrewGroundingLetter(letterMatch[1]) : undefined;

  return signals.some(
    (signal) =>
      (signal.number && labelNumber === signal.number) ||
      (signal.letter && labelLetter === signal.letter)
  );
}

// ── new resolver ──

export interface StructuralRetrievalDeps {
  listDetectedQuestions: (userId: string, fileId: string) => Promise<DetectedQuestionArtifact[]>;
  listDocumentPages: (userId: string, fileId: string) => Promise<DocumentPageArtifact[]>;
}

export interface StructuralMatch {
  fileId: string;
  chunkIds: string[];
  matchKind: "page" | "question" | "subsection";
  matchLabel: string;
}

const HEBREW_LETTERS = "אבגדהוזחטיכלמנסעפצקרשת";

function extractSubsectionLetter(message: string): string | undefined {
  const m = message.match(new RegExp(`(?:סעיף|מקטע)\\s+([${HEBREW_LETTERS}])[׳'\"]?`));
  return m ? normalizeHebrewGroundingLetter(m[1]) : undefined;
}

export async function resolveStructuralChunkTargets(
  deps: StructuralRetrievalDeps,
  userId: string,
  fileIds: string[],
  userMessage: string
): Promise<StructuralMatch[]> {
  if (fileIds.length === 0) return [];

  const pageRefs = extractRequestedPages(userMessage);
  const signals = extractArtifactGroundingSignals(userMessage);
  const questionNumber = signals.find((s) => s.number)?.number;
  const subsectionLetter = extractSubsectionLetter(userMessage);

  if (pageRefs.length === 0 && !questionNumber && !subsectionLetter) {
    return [];
  }

  for (const fileId of fileIds) {
    // 1) question / subsection
    if (questionNumber || subsectionLetter) {
      let questions: DetectedQuestionArtifact[] = [];
      try {
        questions = await deps.listDetectedQuestions(userId, fileId);
      } catch {
        questions = [];
      }

      const matchedQuestion = questionNumber
        ? questions.find(
            (q) =>
              String(q.questionNumber ?? "") === questionNumber ||
              matchesArtifactGroundingSignals(q.label, [{ number: questionNumber }])
          )
        : undefined;

      if (subsectionLetter) {
        const searchIn = matchedQuestion ? [matchedQuestion] : questions;
        for (const q of searchIn) {
          const sub = q.subsections.find((s) => {
            // Extract the letter after סעיף/מקטע from the subsection label
            const labelLetterMatch = s.label.match(
              new RegExp(`(?:סעיף|מקטע)\\s+([${HEBREW_LETTERS}])[׳'"]?`)
            );
            if (labelLetterMatch) {
              return normalizeHebrewGroundingLetter(labelLetterMatch[1]) === subsectionLetter;
            }
            // Fallback: match any standalone Hebrew letter in the label
            const anyLetterMatch = s.label.match(new RegExp(`(?<![${HEBREW_LETTERS}])([${HEBREW_LETTERS}])(?![${HEBREW_LETTERS}])`));
            return anyLetterMatch
              ? normalizeHebrewGroundingLetter(anyLetterMatch[1]) === subsectionLetter
              : false;
          });
          if (sub && sub.sourceChunkIds.length > 0) {
            return [
              { fileId, chunkIds: dedupe(sub.sourceChunkIds), matchKind: "subsection", matchLabel: sub.label },
            ];
          }
        }
      }

      if (matchedQuestion && matchedQuestion.sourceChunkIds.length > 0) {
        return [
          {
            fileId,
            chunkIds: dedupe(matchedQuestion.sourceChunkIds),
            matchKind: "question",
            matchLabel: matchedQuestion.label,
          },
        ];
      }
    }

    // 2) page
    if (pageRefs.length > 0) {
      let pages: DocumentPageArtifact[] = [];
      try {
        pages = await deps.listDocumentPages(userId, fileId);
      } catch {
        pages = [];
      }
      const matchedPage = pages.find((p) => pageRefs.includes(p.pageNumber));
      if (matchedPage && matchedPage.sourceChunkIds.length > 0) {
        return [
          {
            fileId,
            chunkIds: dedupe(matchedPage.sourceChunkIds),
            matchKind: "page",
            matchLabel: `עמוד ${matchedPage.pageNumber}`,
          },
        ];
      }
    }
  }

  return [];
}

function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids));
}
