import { describe, expect, it } from "vitest";
import {
  buildArtifactAwareFileInventory,
  buildFileInventory,
  formatArtifactAwareFileInventoryResponse,
  formatFileInventoryResponse,
  isLowQualityMathExtractionPreview,
} from "../../../src/server/tutor/fileInventoryService";

function makeChunk(chunkIndex: number, text: string) {
  return {
    chunkId: `chunk_${String(chunkIndex).padStart(4, "0")}`,
    userId: "u1",
    workspaceId: "ws-1",
    fileId: "f-1",
    text,
    chunkIndex,
    charStart: chunkIndex * 1000,
    charEnd: chunkIndex * 1000 + text.length,
    tokenEstimate: Math.ceil(text.length / 4),
    source: "extracted_text" as const,
    createdAt: new Date(),
  };
}

function makeDetectedQuestion(overrides: Record<string, unknown> = {}) {
  return {
    questionId: "q-1",
    userId: "u1",
    fileId: "f-1",
    label: "שאלה 1",
    questionNumber: 1,
    summary: "חשב את הפוטנציאל החשמלי.",
    pageStart: 2,
    pageEnd: 2,
    charStart: 0,
    charEnd: 40,
    sourceChunkIds: [],
    subsections: [],
    confidence: 0.92,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeOutlineSection(overrides: Record<string, unknown> = {}) {
  return {
    sectionId: "s-1",
    label: "שאלה 1",
    title: "פוטנציאל חשמלי",
    charStart: 0,
    charEnd: 40,
    sourceChunkIds: [],
    subsections: [],
    confidence: 0.9,
    ...overrides,
  };
}

function makeOutline(overrides: Record<string, unknown> = {}) {
  return {
    outlineId: "v1",
    userId: "u1",
    fileId: "f-1",
    title: "מטלה 5",
    sections: [makeOutlineSection()],
    confidence: "high" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("buildFileInventory — question detection", () => {
  it("detects Hebrew numbered questions (שאלה N)", () => {
    const chunks = [
      makeChunk(0, "שאלה 1\nחשב את הפוטנציאל החשמלי..."),
      makeChunk(1, "שאלה 2\nמצא את עוצמת השדה..."),
    ];
    const result = buildFileInventory("physics.pdf", chunks);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading).toMatch(/שאלה\s*1/);
    expect(result.sections[1].heading).toMatch(/שאלה\s*2/);
  });

  it("detects Hebrew exercise markers (תרגיל N)", () => {
    const chunks = [
      makeChunk(0, "תרגיל 1\nפתור את המשוואה..."),
      makeChunk(1, "תרגיל 3\nמצא את הנגזרת..."),
    ];
    const result = buildFileInventory("hw.pdf", chunks);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading).toMatch(/תרגיל\s*1/);
  });

  it("detects Arabic-numeral prefix patterns (1. 2. 3.)", () => {
    const chunks = [
      makeChunk(0, "1. A charged particle moves in a magnetic field..."),
      makeChunk(1, "2. Calculate the capacitance of the system..."),
      makeChunk(2, "3. Find the electric field..."),
    ];
    const result = buildFileInventory("exam.pdf", chunks);
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].heading).toMatch(/^1\./);
  });

  it("detects English Question/Exercise/Problem markers", () => {
    const chunks = [
      makeChunk(0, "Question 1\nA particle moves..."),
      makeChunk(1, "Problem 2\nFind the voltage..."),
      makeChunk(2, "Exercise 3\nCompute the current..."),
    ];
    const result = buildFileInventory("sheet.pdf", chunks);
    expect(result.sections).toHaveLength(3);
  });

  it("detects Hebrew letter markers (א. ב. or (א) (ב))", () => {
    const chunks = [
      makeChunk(0, "(א) חשב את הטמפרטורה..."),
      makeChunk(1, "(ב) מה קורה כאשר הנפח..."),
    ];
    const result = buildFileInventory("thermo.pdf", chunks);
    expect(result.sections.length).toBeGreaterThanOrEqual(1);
  });

  it("returns isBestEffort=true even for well-structured files", () => {
    const chunks = [makeChunk(0, "שאלה 1\nתוכן")];
    const result = buildFileInventory("f.pdf", chunks);
    expect(result.isBestEffort).toBe(true);
  });

  it("returns sections in document order (by chunkIndex)", () => {
    const chunks = [
      makeChunk(2, "שאלה 3\nנושא ג"),
      makeChunk(0, "שאלה 1\nנושא א"),
      makeChunk(1, "שאלה 2\nנושא ב"),
    ];
    const result = buildFileInventory("f.pdf", chunks);
    const indexes = result.sections.map((s) => s.chunkIndex);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it("does not detect section boundaries in the middle of continuous prose", () => {
    const chunks = [
      makeChunk(0, "בפרק זה נדון בעקרונות היסוד של תרמודינמיקה. חוק ראשון..."),
      makeChunk(1, "חוק שני של תרמודינמיקה קובע כי..."),
    ];
    const result = buildFileInventory("lecture.pdf", chunks);
    expect(result.sections).toHaveLength(0);
  });

  it("caps sections at a reasonable maximum to avoid huge responses", () => {
    const chunks = Array.from({ length: 60 }, (_, i) =>
      makeChunk(i, `שאלה ${i + 1}\nמה הוא...`)
    );
    const result = buildFileInventory("big.pdf", chunks);
    expect(result.sections.length).toBeLessThanOrEqual(30);
  });

  it("includes file name in result", () => {
    const result = buildFileInventory("physics.pdf", [makeChunk(0, "שאלה 1\nתוכן")]);
    expect(result.fileName).toBe("physics.pdf");
  });
});

describe("formatFileInventoryResponse", () => {
  it("detects garbled formula-like extraction preview as low quality", () => {
    expect(isLowQualityMathExtractionPreview("0 0 1 2  a B I ")).toBe(true);
  });

  it("opens in natural tutor phrasing instead of backend status language", () => {
    const result = buildFileInventory("f.pdf", [makeChunk(0, "שאלה 1\nתוכן")]);
    const text = formatFileInventoryResponse(result);
    expect(text).toMatch(/כן, אני רואה|נראה שזה קובץ/);
    expect(text).not.toMatch(/הקובץ זוהה והטקסט חולץ/);
    expect(text).not.toMatch(/אני עובד עם הטקסט שחולץ/);
    expect(text).not.toMatch(/תצוגה חזותית|חזותית/);
  });

  it("lists detected sections by number", () => {
    const chunks = [
      makeChunk(0, "שאלה 1\nפוטנציאל חשמלי"),
      makeChunk(1, "שאלה 2\nשדה מגנטי"),
    ];
    const result = buildFileInventory("f.pdf", chunks);
    const text = formatFileInventoryResponse(result);
    expect(text).toContain("1.");
    expect(text).toContain("2.");
  });

  it("does not say 'אני לא יכול' or 'I cannot' when sections found", () => {
    const chunks = [makeChunk(0, "שאלה 1\nתוכן")];
    const result = buildFileInventory("f.pdf", chunks);
    const text = formatFileInventoryResponse(result);
    expect(text).not.toMatch(/אני לא יכול/i);
    expect(text).not.toMatch(/I cannot/i);
  });

  it("does not say 'שאל אותי שאלה ספציפית' when sections found", () => {
    const chunks = [makeChunk(0, "שאלה 1\nתוכן")];
    const result = buildFileInventory("f.pdf", chunks);
    const text = formatFileInventoryResponse(result);
    expect(text).not.toMatch(/שאל אותי שאלה ספציפית/i);
  });

  it("does not expose raw broken formula snippet in inventory preview", () => {
    const result = buildFileInventory("f.pdf", [
      makeChunk(0, "שאלה 1\n0 0 1 2  a B I "),
    ]);
    const text = formatFileInventoryResponse(result);
    expect(text).not.toContain("0 0 1 2  a B I ");
  });

  it("explains weak extraction conversationally when math extraction looks garbled", () => {
    const result = buildFileInventory("f.pdf", [
      makeChunk(0, "שאלה 1\n0 0 1 2  a B I "),
    ]);
    const text = formatFileInventoryResponse(result);
    expect(text).toMatch(/חלק מהנוסחאות.*לא חולצו מספיק טוב/);
    expect(text).toMatch(/אני לא רוצה להציג אותן כאילו הן ודאיות/);
    expect(text).not.toMatch(/הקובץ זוהה והטקסט חולץ|מקטעים שזוהו חלקית/);
  });

  it("does not insert low-quality placeholder mid-sentence in the broken preview line", () => {
    const result = buildFileInventory("f.pdf", [
      makeChunk(0, "שאלה 1\n0 0 1 2  a B I "),
    ]);
    const text = formatFileInventoryResponse(result);
    expect(text).not.toContain("תצוגת הנוסחה/הסימון הושמטה");
  });

  it("when no sections found, still does not claim inability — offers text-based help", () => {
    const result = buildFileInventory("f.pdf", [
      makeChunk(0, "חלק זה דן בתאוריה הכללית..."),
    ]);
    const text = formatFileInventoryResponse(result);
    expect(text).not.toMatch(/אני לא יכול לתת רשימה/i);
    expect(text).toMatch(/אם תרצה, אפשר ללכת לפי נושא|אפשר לבחור/);
  });

  it("ends with one practical tutor-style next step", () => {
    const chunks = [
      makeChunk(0, "שאלה 1\nתוכן"),
      makeChunk(1, "שאלה 2\nתוכן"),
    ];
    const result = buildFileInventory("f.pdf", chunks);
    const text = formatFileInventoryResponse(result);
    expect(text).toMatch(/הכי טוב לבחור|אפשר לבחור|עדיף לבחור/);
    expect(text).toMatch(/שאלה|סעיף|עמוד|ציטוט/);
  });

  it("keeps clean extracted Hebrew/English preview visible when text is readable", () => {
    const result = buildFileInventory("f.pdf", [
      makeChunk(0, "שאלה 1\nחשב את הפוטנציאל החשמלי של המטען."),
      makeChunk(1, "Question 2\nFind the electric field near the origin."),
    ]);
    const text = formatFileInventoryResponse(result);
    expect(text).toContain("חשב את הפוטנציאל החשמלי");
    expect(text).toContain("Find the electric field");
  });

  it("uses structured partially-detected heading for noisy Hebrew letter sections", () => {
    const result = buildFileInventory("f.pdf", [
      makeChunk(0, "ג. האם קיימים ערכים של a ו- b עבורם מתאפס הש דה המגנטי\n0 0 1 2  a B I "),
    ]);
    const text = formatFileInventoryResponse(result);
    expect(text).toContain("מקטע");
    expect(text).not.toContain("תצוגת הנוסחה/הסימון הושמטה");
  });

  it("suppresses the exact smoke-failure chunk snippets instead of presenting them as clean sections", () => {
    const result = buildFileInventory("f.pdf", [
      makeChunk(0, "ג.\nא ת השטף המגנטי"),
      makeChunk(1, "ג.\nפרמטרים,,, a b R I"),
    ]);
    const text = formatFileInventoryResponse(result);
    expect(text).not.toContain("א ת השטף המגנטי");
    expect(text).not.toContain("פרמטרים,,, a b R I");
    expect(text).toMatch(/חלק מהנוסחאות.*לא חולצו מספיק טוב|אני לא רוצה להציג/);
    expect(text.match(/מקטע ג׳/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it("keeps clean chunk fallback summaries visible when the extracted text is readable", () => {
    const result = buildFileInventory("f.pdf", [
      makeChunk(0, "ג.\nחשב את השטף המגנטי דרך המסגרת."),
      makeChunk(1, "ד.\nמצא את הזרם הדרוש כדי לאפס את השדה."),
    ]);
    const text = formatFileInventoryResponse(result);
    expect(text).toContain("חשב את השטף המגנטי דרך המסגרת");
    expect(text).toContain("מצא את הזרם הדרוש כדי לאפס את השדה");
    expect(text).not.toMatch(/איכות החילוץ לא מספיקה כדי להציג אותם כסיכום אמין/);
    expect(text).toMatch(/כן, אני רואה|נראה שזה קובץ/);
  });
});

describe("artifact-aware inventory", () => {
  it("builds artifact-aware inventory from detected questions when completed artifacts exist", () => {
    const result = buildArtifactAwareFileInventory({
      fileName: "פיזיקה 2 מטלה 5.pdf",
      pageCount: 4,
      outlineTitle: "מטלה 5",
      detectedQuestionCount: 2,
      extractionQuality: "good",
      deepPdfStatus: "not_started",
      outline: makeOutline(),
      detectedQuestions: [
        makeDetectedQuestion(),
        makeDetectedQuestion({
          questionId: "q-2",
          label: "שאלה 2",
          questionNumber: 2,
          summary: "מצא את עוצמת השדה.",
          pageStart: 3,
          pageEnd: 3,
          charStart: 41,
          charEnd: 80,
        }),
      ],
    });

    expect(result).not.toBeNull();
    expect(result?.items).toHaveLength(2);
    expect(result?.items[0].label).toBe("שאלה 1");
    expect(result?.items[0].detail).toContain("חשב את הפוטנציאל החשמלי");
  });

  it("returns null when artifact data is too empty to be useful", () => {
    const result = buildArtifactAwareFileInventory({
      fileName: "f.pdf",
      outline: null,
      detectedQuestions: [],
    });

    expect(result).toBeNull();
  });

  it("formats cleaner artifact-aware inventory without raw noisy chunk preview", () => {
    const inventory = buildArtifactAwareFileInventory({
      fileName: "f.pdf",
      pageCount: 3,
      outlineTitle: "מטלה בפיזיקה",
      detectedQuestionCount: 1,
      extractionQuality: "good",
      deepPdfStatus: "not_started",
      outline: makeOutline(),
      detectedQuestions: [
        makeDetectedQuestion({
          summary: "השאלה עוסקת בשדה מגנטי ובפוטנציאל.",
        }),
      ],
    });

    const text = formatArtifactAwareFileInventoryResponse(inventory!);
    expect(text).toMatch(/כן, אני רואה|נראה שזה קובץ/);
    expect(text).toContain("שאלה 1");
    expect(text).not.toContain("0 0 1 2  a B I ");
  });

  it("includes honest quality warning for partial/poor artifact extraction", () => {
    const inventory = buildArtifactAwareFileInventory({
      fileName: "f.pdf",
      extractionQuality: "poor",
      outline: makeOutline(),
      detectedQuestions: [
        makeDetectedQuestion({
          summary: undefined,
          topic: "שדה מגנטי",
          confidence: 0.55,
          extractionNotes: "math_garbled",
        }),
      ],
    });

    const text = formatArtifactAwareFileInventoryResponse(inventory!);
    expect(text).toMatch(/חלק מהנוסחאות.*לא חולצו מספיק טוב/);
    expect(text).toMatch(/אלה הדברים שאני מצליח להוציא ממנו בזהירות/);
  });

  it("includes deepPdfStatus recommendation wording without claiming Gemini already ran", () => {
    const inventory = buildArtifactAwareFileInventory({
      fileName: "f.pdf",
      extractionQuality: "partial",
      deepPdfStatus: "recommended",
      outline: makeOutline(),
      detectedQuestions: [makeDetectedQuestion()],
    });

    const text = formatArtifactAwareFileInventoryResponse(inventory!);
    expect(text).toMatch(/אם יש שם נוסחה או תרשים|עדיף לבחור שאלה או סעיף מסוים/);
    expect(text).not.toMatch(/Gemini|נותח כבר|נותח באמצעות/);
  });

  it("suppresses broken Hebrew artifact snippets instead of presenting them as useful sections", () => {
    const inventory = buildArtifactAwareFileInventory({
      fileName: "f.pdf",
      pageCount: 4,
      detectedQuestionCount: 1,
      extractionQuality: "poor",
      outline: makeOutline(),
      detectedQuestions: [
        makeDetectedQuestion({
          label: "מקטע ג׳",
          summary: "א ת השטף המגנטי",
          confidence: 0.52,
          extractionNotes: "spacing_corruption",
        }),
      ],
    });

    const text = formatArtifactAwareFileInventoryResponse(inventory!);
    expect(text).not.toContain("א ת השטף המגנטי");
    expect(text).toMatch(/החילוץ לא מספיק נקי כדי להציג אותם כסיכום בטוח/);
  });

  it("de-duplicates duplicate low-quality labels like 'מקטע ג׳'", () => {
    const inventory = buildArtifactAwareFileInventory({
      fileName: "f.pdf",
      pageCount: 4,
      detectedQuestionCount: 2,
      extractionQuality: "partial",
      outline: makeOutline(),
      detectedQuestions: [
        makeDetectedQuestion({
          questionId: "q-1",
          label: "מקטע ג׳",
          summary: "א ת השטף המגנטי",
          confidence: 0.5,
          extractionNotes: "spacing_corruption",
        }),
        makeDetectedQuestion({
          questionId: "q-2",
          label: "מקטע ג׳",
          summary: "פרמטרים,,, a b R I",
          confidence: 0.48,
          extractionNotes: "punctuation_corruption",
        }),
      ],
    });

    expect(inventory?.items).toHaveLength(0);
    const text = formatArtifactAwareFileInventoryResponse(inventory!);
    expect(text.match(/מקטע ג׳/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it("suppresses corrupted parameter-list artifacts with repeated punctuation", () => {
    const inventory = buildArtifactAwareFileInventory({
      fileName: "f.pdf",
      pageCount: 4,
      detectedQuestionCount: 1,
      extractionQuality: "partial",
      outline: makeOutline(),
      detectedQuestions: [
        makeDetectedQuestion({
          label: "שאלה 4",
          summary: "פרמטרים,,, a b R I",
          confidence: 0.61,
          extractionNotes: "punctuation_corruption",
        }),
      ],
    });

    const text = formatArtifactAwareFileInventoryResponse(inventory!);
    expect(text).not.toContain("פרמטרים,,, a b R I");
    expect(text).toMatch(/החילוץ לא מספיק נקי כדי להציג אותם כסיכום בטוח/);
  });

  it("keeps clean artifacts visible normally", () => {
    const inventory = buildArtifactAwareFileInventory({
      fileName: "f.pdf",
      pageCount: 3,
      detectedQuestionCount: 1,
      extractionQuality: "good",
      outline: makeOutline(),
      detectedQuestions: [
        makeDetectedQuestion({
          label: "שאלה 3",
          summary: "חשב את השטף המגנטי דרך הלולאה.",
          confidence: 0.93,
        }),
      ],
    });

    const text = formatArtifactAwareFileInventoryResponse(inventory!);
    expect(text).toContain("חשב את השטף המגנטי דרך הלולאה");
    expect(text).not.toMatch(/איכות החילוץ לא מספיקה/);
  });
});
