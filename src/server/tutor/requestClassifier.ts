export type TutorRequestIntent =
  | "file_access_status"
  | "file_content_inventory"
  | "active_context_status"
  | "specific_file_question"
  | "file_summary_request"
  | "visual_reference_request"
  | "ambiguous_file_reference"
  | "general_tutor_question";

export interface TutorRequestClassification {
  intent: TutorRequestIntent;
  shouldUseRetrieval: boolean;
  shouldUseFileInventory: boolean;
  shouldAnswerFromSystemState: boolean;
  needsClarification: boolean;
  reason: string;
}

const VISUAL_REFERENCE_PATTERNS: RegExp[] = [
  /גרף/i,
  /מעגל/i,
  /תרשים/i,
  /איור/i,
  /תמונה/i,
  /diagram/i,
  /circuit/i,
  /graph/i,
  /figure/i,
  /image/i,
  /plot/i,
];

const VISUAL_QUESTION_STARTERS: RegExp[] = [
  /^מה (רואים|מופיע|נראה)\s+(ב|על|ליד|אחרי)/i,
  /^תסביר את ה(מעגל|גרף|תרשים|איור)/i,
  /^describe the (circuit|graph|diagram|figure|image)/i,
  /^what (is shown|appears|can you see) in the (graph|circuit|diagram|figure|image)/i,
];

const FILE_CONTENT_INVENTORY_PATTERNS: RegExp[] = [
  /איזה שאלות/i,
  /אילו שאלות/i,
  /איזה תרגילים/i,
  /אילו תרגילים/i,
  /מה ה?שאלות/i,
  /רשימת שאלות/i,
  /רשימת תרגילים/i,
  /תראה לי את השאלות/i,
  /תראה לי את התרגילים/i,
  /תן לי רשימה/i,
  /what questions (are|is)/i,
  /list (the |all )?(questions|exercises|problems)/i,
  /show me the (questions|exercises|problems)/i,
  /(?:איזה|אילו)\s+קבצים\s+(?:העליתי|יש לי)(?:\s+בסביבת העבודה(?:\s+הזאת)?)?/i,
  /מה\s+יש\s+בקבצים\s+שהעליתי/i,
  /תראה לי את הקבצים שהעליתי/i,
  /תגיד לי\s+(?:איזה|אילו)\s+קבצים\s+העליתי(?:\s+ומה\s+(?:יש\s+בהם|התוכן\s+שלהם))?/i,
];

const FILE_ACCESS_STATUS_PATTERNS: RegExp[] = [
  /האם אתה יכול לראות/i,
  /האם אתה יכול לגשת/i,
  /האם יש לך גישה/i,
  /יש לך גישה/i,
  /האם אתה רואה את הקובץ/i,
  /האם אתה יכול לקרוא/i,
  /^האם הקובץ/i,
  /הקובץ נטען/i,
  /הקובץ זמין/i,
  /יכול לראות שאלות מ/i,
  /יכול לראות את הקובץ/i,
  /יכול לגשת לקובץ/i,
  /יש לך גישה לקובץ/i,
  /^אתה רואה את הקובץ/i,
  /can you see.*(?:file|pdf|docx)/i,
  /can you access.*(?:file|pdf|docx)/i,
  /do you have access.*(?:file|pdf|docx)/i,
  /can you read.*(?:file|pdf|docx)/i,
];

const ACTIVE_CONTEXT_STATUS_PATTERNS: RegExp[] = [
  /איזה\s+(?:חומר|קובץ)\s+פעיל/i,
  /איזה\s+קובץ\s+בחרתי/i,
  /על\s+איזה\s+קובץ\s+אנחנו\s+עובדים/i,
  /על\s+איזה\s+חומר\s+אנחנו\s+עובדים/i,
  /which\s+(?:file|material)\s+is\s+active/i,
  /what\s+file\s+(?:did i select|is active)/i,
  /what\s+material\s+is\s+active/i,
];

const FILE_SUMMARY_PATTERNS: RegExp[] = [
  /^תסכם/i,
  /^summarize/i,
  /סיכום של הקובץ/i,
  /תן לי סיכום/i,
  /מה הנושאים המרכזיים/i,
  /מה עיקרי/i,
  /על מה ה?קובץ/i,
  /what (is|are) the main topics/i,
  /give me a summary/i,
];

const SPECIFIC_FILE_QUESTION_PATTERNS: RegExp[] = [
  /שאלה\s+(\d+|הראשונה|השנייה|השלישית|הרביעית|אחת|שתיים|שלוש)/i,
  /\bשאלה\b.*\bב?קובץ|בחומר|במטלה/i,
  /מה כתוב בשאלה/i,
  /תרגיל\s+\d+/i,
  /סעיף\s+(\d+|ראשון|שני|שלישי|רביעי|[אבגדהוזחטי])/i,
  /הסעיף הראשון|הסעיף השני|הסעיף השלישי/i,
  /question\s+\d+/i,
  /exercise\s+\d+/i,
  /problem\s+\d+/i,
  /part\s+[a-z]\b/i,
];

const FILE_REFERENCE_KEYWORDS: RegExp[] = [
  /בקובץ/i,
  /מהקובץ/i,
  /מהמטלה/i,
  /במטלה/i,
  /בחומר/i,
  /מהחומר/i,
  /in the file/i,
  /from the file/i,
  /in the assignment/i,
];

export function classifyTutorRequest(message: string): TutorRequestClassification {
  // 1. Visual reference (check before inventory — visual overrides inventory framing)
  const isVisualStarter = VISUAL_QUESTION_STARTERS.some((p) => p.test(message));
  const hasVisualTerm = VISUAL_REFERENCE_PATTERNS.some((p) => p.test(message));
  if (isVisualStarter || (hasVisualTerm && hasFileReference(message))) {
    return {
      intent: "visual_reference_request",
      shouldUseRetrieval: false,
      shouldUseFileInventory: false,
      shouldAnswerFromSystemState: false,
      needsClarification: false,
      reason: "message references a visual element (graph/circuit/diagram/figure)",
    };
  }

  // 2. File-content inventory (before access-status — inventory is content, not capability)
  if (FILE_CONTENT_INVENTORY_PATTERNS.some((p) => p.test(message))) {
    return {
      intent: "file_content_inventory",
      shouldUseRetrieval: false,
      shouldUseFileInventory: true,
      shouldAnswerFromSystemState: false,
      needsClarification: false,
      reason: "message asks for uploaded-file inventory or to enumerate questions/exercises/sections in the file",
    };
  }

  // 3. File-access status (capability questions: yes/no, can you see/access)
  if (FILE_ACCESS_STATUS_PATTERNS.some((p) => p.test(message))) {
    return {
      intent: "file_access_status",
      shouldUseRetrieval: false,
      shouldUseFileInventory: false,
      shouldAnswerFromSystemState: true,
      needsClarification: false,
      reason: "message asks whether the tutor can access the file (capability, not content)",
    };
  }

  // 3.5 Active selected chat-context status
  if (ACTIVE_CONTEXT_STATUS_PATTERNS.some((p) => p.test(message))) {
    return {
      intent: "active_context_status",
      shouldUseRetrieval: false,
      shouldUseFileInventory: false,
      shouldAnswerFromSystemState: true,
      needsClarification: false,
      reason: "message asks which selected course file/material is currently active in chat context",
    };
  }

  // 4. File summary request
  if (FILE_SUMMARY_PATTERNS.some((p) => p.test(message))) {
    return {
      intent: "file_summary_request",
      shouldUseRetrieval: true,
      shouldUseFileInventory: false,
      shouldAnswerFromSystemState: false,
      needsClarification: false,
      reason: "message asks for a summary or overview of the file content",
    };
  }

  // 5. Specific file question (ask about a numbered question/section)
  if (SPECIFIC_FILE_QUESTION_PATTERNS.some((p) => p.test(message))) {
    return {
      intent: "specific_file_question",
      shouldUseRetrieval: true,
      shouldUseFileInventory: false,
      shouldAnswerFromSystemState: false,
      needsClarification: false,
      reason: "message asks about a specific numbered question or section",
    };
  }

  // 6. Ambiguous file reference (mentions file but intent is unclear)
  if (hasFileReference(message) && message.split(/\s+/).length < 5) {
    return {
      intent: "ambiguous_file_reference",
      shouldUseRetrieval: false,
      shouldUseFileInventory: false,
      shouldAnswerFromSystemState: false,
      needsClarification: true,
      reason: "short message references a file but intent is unclear",
    };
  }

  // 7. General tutor question
  return {
    intent: "general_tutor_question",
    shouldUseRetrieval: false,
    shouldUseFileInventory: false,
    shouldAnswerFromSystemState: false,
    needsClarification: false,
    reason: "no file-specific intent detected; treat as a general academic question",
  };
}

function hasFileReference(message: string): boolean {
  return FILE_REFERENCE_KEYWORDS.some((p) => p.test(message));
}
