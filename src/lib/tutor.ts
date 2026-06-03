import {
  CostMode,
  WorkMode,
  TutorResponse,
  TutorMessage,
  SourceCitation,
  RetrievalScope,
  TutorInternalUpdate,
  LearnerMemory,
} from "../types";
import { v4 as uuidv4 } from "uuid";

type MockIntent =
  | "guidance_only"
  | "local_question"
  | "user_correction"
  | "user_preference"
  | "research_request"
  | "temporary_chat"
  | "factual_or_regular";

function createBaseInternalUpdate(): TutorInternalUpdate {
  return {
    detected_intent: "factual_or_regular",
    confidence: 0.74,
    should_stop_progression: false,
    local_question: {
      detected: false,
      reason: "",
    },
    retrieval: {
      used: false,
      scope: "none",
      source_ids: [],
      why: "no_retrieval_needed_for_mock_response",
    },
    learner_memory_update: {
      needed: false,
      update_type: "none",
      memory_type: "none",
      content: "",
      confidence: 0,
    },
    knowledge_base_action: {
      needed: false,
      action: "none",
      confidence: 0,
      requires_user_confirmation: false,
    },
    decision_log_entries: [],
  };
}

function classifyMockIntent(normalizedMessage: string, workMode: WorkMode): MockIntent {
  const asksForHint = /hint|רמז|כיוון|guidance|עזרה/.test(normalizedMessage);
  const asksLocalWhy = /why|למה|איך יודעים|איפה מכניסים|מה המשמעות|רגע/.test(normalizedMessage);
  const asksLocalPersonal = /personal|my case|אצלי|לי אישית|שאלה אישית/.test(normalizedMessage);
  const isCorrection = /לא,|זה לא|wrong|תיקון|תתקן|שייך ל/.test(normalizedMessage);
  const isPreference = /i prefer|prefer|מעדיף|תסביר לי תמיד|אל תרוץ/.test(normalizedMessage);

  if (workMode === "Temporary Chat") return "temporary_chat";
  if (isCorrection) return "user_correction";
  if (isPreference) return "user_preference";
  if (asksLocalWhy || asksLocalPersonal) return "local_question";
  if (workMode === "Research") return "research_request";
  if (workMode === "Practice" || asksForHint) return "guidance_only";
  return "factual_or_regular";
}

function shouldUseMockRetrieval(
  intent: MockIntent,
  workMode: WorkMode,
  costMode: CostMode,
  normalizedMessage: string,
  hasConversationHistory: boolean,
  hasLearnerMemory: boolean
): TutorInternalUpdate["retrieval"] {
  if (intent !== "research_request" || workMode !== "Research") {
    return {
      used: false,
      scope: "none",
      source_ids: [],
      why: "no_retrieval_needed_for_mock_response",
    };
  }

  const asksForFreshWebInfo = /latest|עדכון|update|news|today|מה חדש/.test(normalizedMessage);
  const scope: RetrievalScope = asksForFreshWebInfo
    ? "web"
    : costMode === "Deep Research"
      ? "workspace"
      : "topic";

  return {
    used: true,
    scope,
    source_ids: ["f-1"],
    why: `mock_research_routing(history=${hasConversationHistory},memory=${hasLearnerMemory})`,
  };
}

function createMockLearnerMemoryUpdate(
  intent: MockIntent,
  workMode: WorkMode
): TutorInternalUpdate["learner_memory_update"] {
  if (workMode === "Temporary Chat") {
    return {
      needed: false,
      update_type: "none",
      memory_type: "none",
      content: "",
      confidence: 0,
    };
  }

  if (intent === "user_correction") {
    return {
      needed: true,
      update_type: "requires_approval",
      memory_type: "correction",
      content: "User correction should be reviewed and applied to future tutoring context.",
      confidence: 0.88,
    };
  }

  if (intent === "user_preference") {
    return {
      needed: true,
      update_type: "small_auto",
      memory_type: "preference",
      content: "User preference update detected for tutoring style.",
      confidence: 0.8,
    };
  }

  return {
    needed: false,
    update_type: "none",
    memory_type: "none",
    content: "",
    confidence: 0,
  };
}

/**
 * Mock tutor function simulating a response from an LLM.
 * DO NOT CALL ACTUAL LLM APIS HERE.
 */
export async function getMockTutorResponse(
  userMessage: string,
  workMode: WorkMode,
  costMode: CostMode,
  learnerMemory?: LearnerMemory,
  conversationHistory?: TutorMessage[]
): Promise<TutorResponse> {
  let responseContent = "";
  const citations: SourceCitation[] = [];
  const normalizedMessage = userMessage.toLowerCase();
  const intent = classifyMockIntent(normalizedMessage, workMode);
  const hasConversationHistory = (conversationHistory?.length ?? 0) > 0;
  const hasLearnerMemory = (learnerMemory?.observations.length ?? 0) > 0;
  const retrieval = shouldUseMockRetrieval(
    intent,
    workMode,
    costMode,
    normalizedMessage,
    hasConversationHistory,
    hasLearnerMemory
  );
  const learnerMemoryUpdate = createMockLearnerMemoryUpdate(intent, workMode);
  const shouldStopProgression =
    intent === "guidance_only" ||
    intent === "local_question" ||
    intent === "user_correction" ||
    intent === "user_preference";
  const localQuestionDetected = intent === "local_question";
  const localQuestionReason = localQuestionDetected
    ? "Detected a local conceptual or personal clarification request."
    : "";
  const confidenceByIntent: Record<MockIntent, number> = {
    guidance_only: 0.86,
    local_question: 0.9,
    user_correction: 0.88,
    user_preference: 0.82,
    research_request: 0.84,
    temporary_chat: 0.95,
    factual_or_regular: 0.74,
  };

  // Simulate delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (intent === "temporary_chat") {
    responseContent = `זה צ'אט זמני. אענה נקודתית בלי לעדכן זיכרון קבוע או ידע אקדמי. מצב עלות: ${costMode}.`;
  } else if (normalizedMessage.includes("אינטגרל על ln(x)")) {
    responseContent = "כדי לחשב את האינטגרל של $\\ln(x) dx$ באמצעות אינטגרציה בחלקים, כדאי לסמן את הפונקציה $\\ln(x)$ כ-$u$ ואת הדיפרנציאל $dx$ כ-$dv$. כעת, נסה לגזור את $u$ כדי למצוא את $du$ ולבצע אינטגרציה על $dv$ כדי למצוא את $v$. מכאן, תוכל להשתמש בנוסחה $\\int u \\, dv = uv - \\int v \\, du$. נסה להמשיך מכאן!";
  } else if (normalizedMessage.includes("לחלק ב-x") && normalizedMessage.includes("מי אמר שהוא לא אפס")) {
    responseContent = "שאלה מצוינת! שים לב שהפונקציה המקורית שאנו חוקרים היא $\\ln(x)$. תחום ההגדרה של פונקציית הלוגריתם הטבעי $\\ln(x)$ הוא ערכי $x$ חיוביים בלבד, כלומר $x > 0$. מכיוון ש-$x$ בהכרח גדול מאפס לכל אורך התרגיל, הוא לעולם אינו שווה לאפס, ולכן חלוקה ב-$x$ היא מותרת לחלוטין ותקינה מתמטית.";
  } else if (normalizedMessage.includes("חוק שימור האנרגיה")) {
    responseContent = "חוק שימור האנרגיה בפיזיקה קלאסית קובע כי במערכת סגורה ומבודדת, כמות האנרגיה הכוללת נשארת קבועה לאורך זמן. אנרגיה אינה יכולה להיווצר יש מאין או להיעלם, אלא היא רק משנה את צורתה — לדוגמה, מעבר מאנרגיה פוטנציאלית (כמו גוף בגובה) לאנרגיה קינטית (כאשר הגוף נופל). כדי לוודא שהבנו את העיקרון — אם נניח שיש לנו מטוטלת ללא חיכוך, מה לדעתך קורה לאנרגיה בנקודה הגבוהה ביותר של המסלול לעומת הנקודה הנמוכה ביותר?";
  } else if (normalizedMessage.includes("ניוטון המציא את תורת היחסות")) {
    responseContent = "בוא נבחן את מה שכתוב בטקסט: איינשטיין פיתח את תורת היחסות (הפרטית והכללית) בתחילת המאה ה-20, בעוד שניוטון פיתח את המכניקה הקלאסית ואת חוק המשיכה האוניברסלי בסוף המאה ה-17. לפיכך, האם זה נכון לומר שניוטון המציא את תורת היחסות, או שמא היה זה מדען אחר?";
  } else if (intent === "local_question") {
    responseContent = "התשובה המקומית היא שהרעיון כאן תלוי בתפקיד של המספר: הוא יוצר מרחק בין המסורת לבין המבט המודרני. אני עוצר כאן ולא מוסיף תרגול או המשך פתרון.";
  } else if (intent === "guidance_only") {
    responseContent = `זוהי תגובת תרגול. הנה רמז ללא פתרון מלא: חפש קודם את נקודת המתח המרכזית, ואז בדוק איך הניסוח בטקסט תומך בה. מצב עלות: ${costMode}.`;
  } else if (intent === "user_correction") {
    responseContent = "קיבלתי את התיקון שלך. אני מיישר את ההקשר בהתאם ולא ממשיך הלאה עד שהעדכון ברור.";
  } else if (intent === "user_preference") {
    responseContent = "מעולה, קיבלתי את ההעדפה שלך ואכוון את סגנון ההסבר בהתאם מהנקודה הזו והלאה.";
  } else if (intent === "research_request") {
    responseContent = `במצב מחקר, אנו מסתמכים על מקורות מוקצים בלבד במוק הזה. הטקסט מציין מתח בין מסורת ומודרניות. מצב עלות: ${costMode}.`;
    citations.push({
      id: uuidv4(),
      referenceText: "הטקסט מציין את הדיכוטומיה",
      sourceId: "f-1",
    });
  } else if (costMode === "Cheap Practice") {
    responseContent = `אני עונה מקומית ובזול, בלי חיפוש רשת ובלי שליפת מקורות רחבה: "${userMessage}". מצב עבודה: ${workMode}. מצב עלות: ${costMode}.`;
  } else {
    responseContent = `אני המורה האקדמי שלך. קיבלתי את בקשתך בנושא: "${userMessage}". אנו כרגע במצב עבודה: ${workMode} ומצב עלות: ${costMode}.`;
  }

  const message: TutorMessage = {
    id: uuidv4(),
    role: "tutor",
    content: responseContent,
    citations: citations.length > 0 ? citations : undefined,
  };

  const internalUpdate = createBaseInternalUpdate();
  internalUpdate.detected_intent = intent;
  internalUpdate.confidence = confidenceByIntent[intent];
  internalUpdate.should_stop_progression = shouldStopProgression;
  internalUpdate.local_question = {
    detected: localQuestionDetected,
    reason: localQuestionReason,
  };
  internalUpdate.retrieval = retrieval;
  internalUpdate.learner_memory_update = learnerMemoryUpdate;

  return {
    message,
    internalUpdate,
  };
}
