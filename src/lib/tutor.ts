import { CostMode, WorkMode, TutorResponse, TutorMessage, LearnerMemoryObservation, RetrievalScope } from "../types";
import { v4 as uuidv4 } from "uuid";

/**
 * Mock tutor function simulating a response from an LLM.
 * DO NOT CALL ACTUAL LLM APIS HERE.
 */
export async function getMockTutorResponse(
  userMessage: string,
  workMode: WorkMode,
  costMode: CostMode
): Promise<TutorResponse> {
  let responseContent = "";
  const citations = [];
  const internalUpdates: LearnerMemoryObservation[] = [];
  let retrievalScope: RetrievalScope = "none";
  const usedWebSearch = false;
  let stoppedAfterLocalAnswer = false;
  const normalizedMessage = userMessage.toLowerCase();
  const asksForHint = /hint|רמז|כיוון|guidance|עזרה/.test(normalizedMessage);
  const asksLocalWhy = /why|למה|איך יודעים|איפה מכניסים|מה המשמעות/.test(normalizedMessage);

  // Simulate delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (workMode === "Temporary Chat") {
    responseContent = `זה צ'אט זמני. אענה נקודתית בלי לעדכן זיכרון קבוע או ידע אקדמי. מצב עלות: ${costMode}.`;
  } else if (asksLocalWhy) {
    stoppedAfterLocalAnswer = true;
    responseContent = "התשובה המקומית היא שהרעיון כאן תלוי בתפקיד של המספר: הוא יוצר מרחק בין המסורת לבין המבט המודרני. אני עוצר כאן ולא מוסיף תרגול או המשך פתרון.";
  } else if (workMode === "Practice" || asksForHint) {
    responseContent = `זוהי תגובת תרגול. הנה רמז ללא פתרון מלא: חפש קודם את נקודת המתח המרכזית, ואז בדוק איך הניסוח בטקסט תומך בה. מצב עלות: ${costMode}.`;
    internalUpdates.push({
      id: uuidv4(),
      observation: "User requested practice; provided hint without full solution.",
      timestamp: new Date(),
      confidence: 0.78,
      state: "candidate",
      source: "conversation",
      appliesToWorkMode: workMode,
    });
  } else if (workMode === "Research") {
    retrievalScope = costMode === "Deep Research" ? "workspace" : "topic";
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

  return {
    message,
    internalUpdates: internalUpdates.length > 0 ? internalUpdates : undefined,
    mockRouting: {
      workMode,
      costMode,
      retrievalScope,
      usedWebSearch,
      memoryWrite: internalUpdates.length > 0 ? "candidate" : "none",
      stoppedAfterLocalAnswer,
    },
  };
}
