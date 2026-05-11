import { CostMode, WorkMode, TutorResponse, TutorMessage, LearnerMemoryObservation } from "../types";
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

  // Simulate delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (workMode === "Practice") {
    responseContent = "זוהי תגובת תרגול. אני שם לב שאתה מתרגל את הנושא. הנה רמז ללא פתרון מלא: שים לב לשורש הפועל.";
    internalUpdates.push({
      id: uuidv4(),
      observation: "User requested practice; provided hint without full solution.",
      timestamp: new Date(),
    });
  } else if (workMode === "Research") {
    responseContent = "במצב מחקר, אנו מסתמכים על המקורות. הטקסט מציין את הדיכוטומיה בין מסורת ומודרניות.";
    citations.push({
      id: uuidv4(),
      referenceText: "הטקסט מציין את הדיכוטומיה",
      sourceId: "f-1",
    });
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
  };
}
