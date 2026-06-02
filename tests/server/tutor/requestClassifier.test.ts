import { describe, expect, it } from "vitest";
import {
  classifyTutorRequest,
  type TutorRequestIntent,
} from "../../../src/server/tutor/requestClassifier";

function intent(message: string): TutorRequestIntent {
  return classifyTutorRequest(message).intent;
}

describe("classifyTutorRequest — file_access_status", () => {
  it("classifies 'אתה רואה את הקובץ?' as file_access_status", () => {
    expect(intent("אתה רואה את הקובץ?")).toBe("file_access_status");
  });

  it("classifies 'יש לך גישה ל-PDF?' as file_access_status", () => {
    expect(intent("יש לך גישה ל-PDF?")).toBe("file_access_status");
  });

  it("classifies 'האם אתה יכול לראות את הקובץ?' as file_access_status", () => {
    expect(intent("האם אתה יכול לראות את הקובץ?")).toBe("file_access_status");
  });

  it("classifies 'הקובץ נטען?' as file_access_status", () => {
    expect(intent("הקובץ נטען?")).toBe("file_access_status");
  });

  it("classifies 'האם הקובץ זמין?' as file_access_status", () => {
    expect(intent("האם הקובץ זמין?")).toBe("file_access_status");
  });

  it("classifies 'can you see the PDF?' as file_access_status", () => {
    expect(intent("can you see the PDF?")).toBe("file_access_status");
  });

  it("classifies 'do you have access to the file?' as file_access_status", () => {
    expect(intent("do you have access to the file?")).toBe("file_access_status");
  });
});

describe("classifyTutorRequest — file_content_inventory", () => {
  it("classifies 'איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?' as file_content_inventory", () => {
    expect(intent("איזה קבצים העליתי לסביבת העבודה הזאת ומה יש בהם?")).toBe(
      "file_content_inventory"
    );
  });

  it("classifies 'איזה קבצים העליתי?' as file_content_inventory", () => {
    expect(intent("איזה קבצים העליתי?")).toBe("file_content_inventory");
  });

  it("classifies 'אילו קבצים העליתי?' as file_content_inventory", () => {
    expect(intent("אילו קבצים העליתי?")).toBe("file_content_inventory");
  });

  it("classifies 'איזה קבצים יש לי בסביבת העבודה?' as file_content_inventory", () => {
    expect(intent("איזה קבצים יש לי בסביבת העבודה?")).toBe("file_content_inventory");
  });

  it("classifies 'מה יש בקבצים שהעליתי?' as file_content_inventory", () => {
    expect(intent("מה יש בקבצים שהעליתי?")).toBe("file_content_inventory");
  });

  it("classifies 'תראה לי את הקבצים שהעליתי' as file_content_inventory", () => {
    expect(intent("תראה לי את הקבצים שהעליתי")).toBe("file_content_inventory");
  });

  it("classifies 'תגיד לי איזה קבצים העליתי ומה התוכן שלהם' as file_content_inventory", () => {
    expect(intent("תגיד לי איזה קבצים העליתי ומה התוכן שלהם")).toBe(
      "file_content_inventory"
    );
  });

  it("classifies 'איזה שאלות אתה יכול לראות בקובץ?' as file_content_inventory", () => {
    expect(intent("איזה שאלות אתה יכול לראות בקובץ?")).toBe("file_content_inventory");
  });

  it("classifies 'איזה שאלות יש בקובץ?' as file_content_inventory", () => {
    expect(intent("איזה שאלות יש בקובץ?")).toBe("file_content_inventory");
  });

  it("classifies 'איזה תרגילים יש במטלה?' as file_content_inventory", () => {
    expect(intent("איזה תרגילים יש במטלה?")).toBe("file_content_inventory");
  });

  it("classifies 'תן לי רשימת שאלות מהקובץ' as file_content_inventory", () => {
    expect(intent("תן לי רשימת שאלות מהקובץ")).toBe("file_content_inventory");
  });

  it("classifies 'what questions are in the file?' as file_content_inventory", () => {
    expect(intent("what questions are in the file?")).toBe("file_content_inventory");
  });

  it("classifies 'list the exercises in the file' as file_content_inventory", () => {
    expect(intent("list the exercises in the file")).toBe("file_content_inventory");
  });

  it("classifies 'מה השאלות שיש בקובץ' as file_content_inventory", () => {
    expect(intent("מה השאלות שיש בקובץ")).toBe("file_content_inventory");
  });

  it("classifies 'תראה לי את השאלות מהמטלה' as file_content_inventory", () => {
    expect(intent("תראה לי את השאלות מהמטלה")).toBe("file_content_inventory");
  });
});

describe("classifyTutorRequest — file_summary_request", () => {
  it("classifies 'תסכם את הקובץ' as file_summary_request", () => {
    expect(intent("תסכם את הקובץ")).toBe("file_summary_request");
  });

  it("classifies 'מה הנושאים המרכזיים במטלה?' as file_summary_request", () => {
    expect(intent("מה הנושאים המרכזיים במטלה?")).toBe("file_summary_request");
  });

  it("classifies 'summarize the file' as file_summary_request", () => {
    expect(intent("summarize the file")).toBe("file_summary_request");
  });

  it("classifies 'תן לי סיכום של הקובץ' as file_summary_request", () => {
    expect(intent("תן לי סיכום של הקובץ")).toBe("file_summary_request");
  });
});

describe("classifyTutorRequest — specific_file_question", () => {
  it("classifies 'תסביר לי שאלה 3' as specific_file_question", () => {
    expect(intent("תסביר לי שאלה 3")).toBe("specific_file_question");
  });

  it("classifies 'מה כתוב בשאלה על קיבול?' as specific_file_question", () => {
    expect(intent("מה כתוב בשאלה על קיבול?")).toBe("specific_file_question");
  });

  it("classifies 'איך פותרים את הסעיף הראשון?' as specific_file_question", () => {
    expect(intent("איך פותרים את הסעיף הראשון?")).toBe("specific_file_question");
  });

  it("classifies 'help me with question 3' as specific_file_question", () => {
    expect(intent("help me with question 3")).toBe("specific_file_question");
  });
});

describe("classifyTutorRequest — visual_reference_request", () => {
  it("classifies 'מה רואים בגרף?' as visual_reference_request", () => {
    expect(intent("מה רואים בגרף?")).toBe("visual_reference_request");
  });

  it("classifies 'תסביר את המעגל בתמונה' as visual_reference_request", () => {
    expect(intent("תסביר את המעגל בתמונה")).toBe("visual_reference_request");
  });

  it("classifies 'מה מופיע באיור?' as visual_reference_request", () => {
    expect(intent("מה מופיע באיור?")).toBe("visual_reference_request");
  });

  it("classifies 'מה רואים בגרף בעמוד 2?' as visual_reference_request", () => {
    expect(intent("מה רואים בגרף בעמוד 2?")).toBe("visual_reference_request");
  });

  it("classifies 'describe the circuit in the figure' as visual_reference_request", () => {
    expect(intent("describe the circuit in the figure")).toBe("visual_reference_request");
  });
});

describe("classifyTutorRequest — general_tutor_question", () => {
  it("classifies 'מה הנגזרת של sin(x)?' as general_tutor_question", () => {
    expect(intent("מה הנגזרת של sin(x)?")).toBe("general_tutor_question");
  });

  it("classifies 'תסביר לי אינטגרציה בהצבה' as general_tutor_question", () => {
    expect(intent("תסביר לי אינטגרציה בהצבה")).toBe("general_tutor_question");
  });

  it("classifies 'explain electric potential' as general_tutor_question", () => {
    expect(intent("explain electric potential")).toBe("general_tutor_question");
  });

  it("does not classify generic file theory question as file_content_inventory", () => {
    expect(intent("איך מסבירים תוכן של קובץ טוב יותר?")).toBe("general_tutor_question");
  });
});

describe("classifyTutorRequest — routing flags", () => {
  it("file_content_inventory: shouldUseFileInventory=true, shouldAnswerFromSystemState=false", () => {
    const result = classifyTutorRequest("איזה שאלות יש בקובץ?");
    expect(result.shouldUseFileInventory).toBe(true);
    expect(result.shouldAnswerFromSystemState).toBe(false);
    expect(result.shouldUseRetrieval).toBe(false);
  });

  it("file_access_status: shouldAnswerFromSystemState=true, shouldUseFileInventory=false", () => {
    const result = classifyTutorRequest("אתה רואה את הקובץ?");
    expect(result.shouldAnswerFromSystemState).toBe(true);
    expect(result.shouldUseFileInventory).toBe(false);
  });

  it("specific_file_question: shouldUseRetrieval=true", () => {
    const result = classifyTutorRequest("תסביר לי שאלה 3");
    expect(result.shouldUseRetrieval).toBe(true);
    expect(result.shouldUseFileInventory).toBe(false);
  });

  it("visual_reference_request: shouldUseRetrieval=false, shouldUseFileInventory=false", () => {
    const result = classifyTutorRequest("מה רואים בגרף?");
    expect(result.shouldUseRetrieval).toBe(false);
    expect(result.shouldUseFileInventory).toBe(false);
  });

  it("general_tutor_question: shouldUseRetrieval=false, shouldUseFileInventory=false", () => {
    const result = classifyTutorRequest("מה הנגזרת של sin(x)?");
    expect(result.shouldUseRetrieval).toBe(false);
    expect(result.shouldUseFileInventory).toBe(false);
  });

  it("file_summary_request: shouldUseRetrieval=true, shouldUseFileInventory=false", () => {
    const result = classifyTutorRequest("תסכם את הקובץ");
    expect(result.shouldUseRetrieval).toBe(true);
    expect(result.shouldUseFileInventory).toBe(false);
  });

  it("all results include a non-empty reason string", () => {
    const messages = [
      "איזה שאלות יש בקובץ?",
      "אתה רואה את הקובץ?",
      "תסביר לי שאלה 3",
      "מה רואים בגרף?",
      "תסכם את הקובץ",
      "תסביר לי אינטגרציה בהצבה",
    ];
    for (const msg of messages) {
      expect(classifyTutorRequest(msg).reason.length).toBeGreaterThan(0);
    }
  });
});
