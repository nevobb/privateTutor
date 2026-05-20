import type { AuthenticatedUser } from "../auth/authTypes";
import type { DetectedQuestion, DocumentOutline, DocumentPage, FileMaterialType, UploadedFile } from "../../types";
import { listUploadedFiles as defaultListUploadedFiles } from "./uploadedFileRepository";
import { listDocumentPages as defaultListDocumentPages } from "./documentPageRepository";
import { listDetectedQuestions as defaultListDetectedQuestions } from "./detectedQuestionRepository";
import { getDocumentOutline as defaultGetDocumentOutline } from "./documentOutlineRepository";
import {
  fileDocumentUnderstandingService as defaultFileDocumentUnderstandingService,
} from "./fileDocumentUnderstandingService";

export type DocumentTutorIntent =
  | "document_inventory_request"
  | "specific_detected_question_request"
  | "visual_reference_request"
  | "general_tutor_question";

export type DocumentTutorIntentResult = {
  intent: DocumentTutorIntent;
  requestedQuestionNumber?: number;
};

export type ResolvedDocumentFile = {
  file: UploadedFile;
  pages: DocumentPage[];
  detectedQuestions: DetectedQuestion[];
  outline: DocumentOutline | null;
};

export type DocumentFileResolutionResult =
  | { ok: true; resolved: ResolvedDocumentFile }
  | { ok: false; code: "ambiguous_files"; files: UploadedFile[] }
  | { ok: false; code: "unsupported_state"; reason: string };

interface Deps {
  listUploadedFiles: typeof defaultListUploadedFiles;
  listDocumentPages: typeof defaultListDocumentPages;
  listDetectedQuestions: typeof defaultListDetectedQuestions;
  getDocumentOutline: typeof defaultGetDocumentOutline;
  runUnderstandingLifecycleForFile: typeof defaultFileDocumentUnderstandingService.runDocumentUnderstandingLifecycleForFile;
}

function defaultDeps(): Deps {
  return {
    listUploadedFiles: defaultListUploadedFiles,
    listDocumentPages: defaultListDocumentPages,
    listDetectedQuestions: defaultListDetectedQuestions,
    getDocumentOutline: defaultGetDocumentOutline,
    runUnderstandingLifecycleForFile:
      defaultFileDocumentUnderstandingService.runDocumentUnderstandingLifecycleForFile.bind(
        defaultFileDocumentUnderstandingService
      ),
  };
}

const INVENTORY_PATTERNS = [
  /איזה\s+שאלות\s+יש\s+בקובץ/i,
  /איזה\s+שאלות\s+אתה\s+יכול\s+לראות\s+בקובץ/i,
  /רשימת\s+תרגילים/i,
  /questions\s+are\s+in\s+the\s+file/i,
  /list\s+the\s+exercises\s+in\s+the\s+document/i,
];
const VISUAL_PATTERNS = [/(גרף|תרשים|איור|דיאגרמה|table|diagram|graph|figure)/i];
const SPECIFIC_QUESTION_PATTERNS = [/(?:שאלה|question|exercise)\s*(\d{1,3})/i];

export class DocumentTutorContextService {
  constructor(private readonly deps: Deps = defaultDeps()) {}

  classifyIntent(message: string): DocumentTutorIntentResult {
    const normalized = message.trim();

    for (const pattern of INVENTORY_PATTERNS) {
      if (pattern.test(normalized)) {
        return { intent: "document_inventory_request" };
      }
    }

    for (const pattern of SPECIFIC_QUESTION_PATTERNS) {
      const match = normalized.match(pattern);
      if (match?.[1]) {
        return {
          intent: "specific_detected_question_request",
          requestedQuestionNumber: Number(match[1]),
        };
      }
    }

    for (const pattern of VISUAL_PATTERNS) {
      if (pattern.test(normalized)) {
        return { intent: "visual_reference_request" };
      }
    }

    return { intent: "general_tutor_question" };
  }

  async resolveRelevantFileForDocumentIntent(
    user: AuthenticatedUser,
    workspaceId: string,
    options: { allowOnDemandUnderstanding: boolean }
  ): Promise<DocumentFileResolutionResult> {
    const files = await this.deps.listUploadedFiles(user.userId, workspaceId);

    const completedUnderstanding = files.filter((file) => file.understandingStatus === "completed");
    if (completedUnderstanding.length === 1) {
      const loaded = await this.loadResolvedFile(user.userId, workspaceId, completedUnderstanding[0]);
      if (!loaded) {
        return { ok: false, code: "unsupported_state", reason: "The selected file has no persisted page data." };
      }
      return { ok: true, resolved: loaded };
    }

    if (completedUnderstanding.length > 1) {
      return { ok: false, code: "ambiguous_files", files: completedUnderstanding };
    }

    const extractionCandidates: UploadedFile[] = [];
    for (const file of files) {
      if (file.extractionStatus !== "completed") continue;
      const pages = await this.deps.listDocumentPages(user.userId, workspaceId, file.id);
      if (pages.length > 0) {
        extractionCandidates.push(file);
      }
    }

    if (extractionCandidates.length === 0) {
      return {
        ok: false,
        code: "unsupported_state",
        reason: "No file in this workspace has completed extraction with persisted page text.",
      };
    }

    if (extractionCandidates.length > 1) {
      return { ok: false, code: "ambiguous_files", files: extractionCandidates };
    }

    const candidate = extractionCandidates[0];
    if (!options.allowOnDemandUnderstanding) {
      return {
        ok: false,
        code: "unsupported_state",
        reason: "Document understanding is not ready yet for the only extracted file.",
      };
    }

    const lifecycle = await this.deps.runUnderstandingLifecycleForFile(user, workspaceId, candidate.id);
    if (!lifecycle.ok) {
      return {
        ok: false,
        code: "unsupported_state",
        reason: `Document understanding failed to run on-demand (code: ${lifecycle.code}).`,
      };
    }

    const loaded = await this.loadResolvedFile(user.userId, workspaceId, candidate);
    if (!loaded) {
      return { ok: false, code: "unsupported_state", reason: "Unable to load structured document data after understanding run." };
    }

    return { ok: true, resolved: loaded };
  }

  buildInventoryAnswer(file: UploadedFile, resolved: ResolvedDocumentFile): string {
    const questions = resolved.detectedQuestions;
    const fileLabel = file.originalFileName ?? file.name;

    if (questions.length === 0) {
      return [
        `עיבדתי את ההבנה המבנית של הקובץ \"${fileLabel}\", אבל לא זיהיתי בו תוויות שאלה מפורשות.`,
        "אפשר לבקש ממני להתמקד בעמוד מסוים או להעלות גרסה עם סימון ברור יותר של מספרי השאלות.",
      ].join("\n\n");
    }

    const lines = questions
      .slice()
      .sort((a, b) => {
        const aNum = a.questionNumber ?? Number.MAX_SAFE_INTEGER;
        const bNum = b.questionNumber ?? Number.MAX_SAFE_INTEGER;
        if (aNum !== bNum) return aNum - bNum;
        return (a.pageStart ?? 1) - (b.pageStart ?? 1);
      })
      .map((q, index) => {
        const pageInfo = q.pageStart ? ` (עמוד ${q.pageStart}${q.pageEnd && q.pageEnd !== q.pageStart ? `-${q.pageEnd}` : ""})` : "";
        return `${index + 1}. ${q.labelRaw}${pageInfo}`;
      });

    const outlineHint = resolved.outline?.sections?.length
      ? `\n\nזיהיתי גם ${resolved.outline.sections.length} מקטעים במבנה המסמך.`
      : "";

    return [
      `אני עובד עם ההבנה המבנית שנבנתה מהטקסט שחולץ מהקובץ \"${fileLabel}\".`,
      "זיהיתי את השאלות/המקטעים הבאים:",
      ...lines,
      "",
      "בחלק מהמקומות הזיהוי עשוי להיות חלקי אם הטקסט שחולץ מה-PDF לא מושלם.",
    ].join("\n") + outlineHint;
  }

  resolveDetectedQuestionReference(
    resolved: ResolvedDocumentFile,
    requestedQuestionNumber: number
  ): { ok: true; question: DetectedQuestion } | { ok: false; message: string } {
    const exact = resolved.detectedQuestions.find((q) => q.questionNumber === requestedQuestionNumber);
    if (exact) return { ok: true, question: exact };

    const labels = resolved.detectedQuestions
      .map((q) => q.labelRaw)
      .slice(0, 12)
      .map((label, index) => `${index + 1}. ${label}`)
      .join("\n");

    if (!labels) {
      return {
        ok: false,
        message:
          `לא זיהיתי במסמך שאלה מספר ${requestedQuestionNumber}. כרגע גם אין רשימת שאלות מזוהה שאפשר להתאים אליה.`,
      };
    }

    return {
      ok: false,
      message: `לא זיהיתי שאלה מספר ${requestedQuestionNumber}.\n\nאלה התוויות שזוהו כרגע:\n${labels}\n\nתגיד לי על איזו שאלה להתמקד לפי התווית המדויקת.`,
    };
  }

  buildQuestionGrounding(resolved: ResolvedDocumentFile, question: DetectedQuestion): {
    contextText: string;
    sourcePages: DocumentPage[];
  } {
    const start = question.pageStart ?? 1;
    const end = question.pageEnd ?? start;

    const relevantPages = resolved.pages.filter((page) => page.pageNumber >= start && page.pageNumber <= end);

    const pageText = relevantPages
      .map((page) => `עמוד ${page.pageNumber}:\n${(page.cleanedText ?? page.extractedText).slice(0, 3000)}`)
      .join("\n\n");

    return {
      contextText: `התמקד בשאלה ${question.labelRaw}.\n\nטקסט עוגן מהמסמך:\n${pageText}`,
      sourcePages: relevantPages,
    };
  }

  buildAmbiguousFilesAnswer(files: UploadedFile[]): string {
    const lines = files
      .slice(0, 8)
      .map((file, index) => `${index + 1}. ${file.originalFileName ?? file.name}`)
      .join("\n");

    return `מצאתי כמה קבצים אפשריים. על איזה קובץ להתמקד?\n${lines}`;
  }

  buildVisualNotSupportedAnswer(): string {
    return "הבנת תוכן חזותי (כמו גרפים/דיאגרמות) עדיין לא פעילה. אם תרצה, אפשר בינתיים לעבוד רק לפי הטקסט שחולץ מהמסמך.";
  }

  private async loadResolvedFile(
    userId: string,
    workspaceId: string,
    file: UploadedFile
  ): Promise<ResolvedDocumentFile | null> {
    const [pages, detectedQuestions, outline] = await Promise.all([
      this.deps.listDocumentPages(userId, workspaceId, file.id),
      this.deps.listDetectedQuestions(userId, workspaceId, file.id),
      this.deps.getDocumentOutline(userId, workspaceId, file.id),
    ]);

    if (pages.length === 0) return null;

    return {
      file,
      pages,
      detectedQuestions,
      outline,
    };
  }
}

export const documentTutorContextService = new DocumentTutorContextService();
