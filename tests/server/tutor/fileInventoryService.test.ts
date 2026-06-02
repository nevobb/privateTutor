import { describe, expect, it } from "vitest";
import {
  buildFileInventory,
  formatFileInventoryResponse,
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
  it("starts with text-based extraction disclaimer", () => {
    const result = buildFileInventory("f.pdf", [makeChunk(0, "שאלה 1\nתוכן")]);
    const text = formatFileInventoryResponse(result);
    expect(text).toMatch(/טקסט שחולץ/);
    expect(text).toMatch(/חזותית/i);
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

  it("when no sections found, still does not claim inability — offers text-based help", () => {
    const result = buildFileInventory("f.pdf", [
      makeChunk(0, "חלק זה דן בתאוריה הכללית..."),
    ]);
    const text = formatFileInventoryResponse(result);
    expect(text).not.toMatch(/אני לא יכול לתת רשימה/i);
    expect(text).toMatch(/טקסט שחולץ/);
  });

  it("includes invite to start with a specific question at the end", () => {
    const chunks = [
      makeChunk(0, "שאלה 1\nתוכן"),
      makeChunk(1, "שאלה 2\nתוכן"),
    ];
    const result = buildFileInventory("f.pdf", chunks);
    const text = formatFileInventoryResponse(result);
    expect(text).toMatch(/שאלה|נתחיל|תרצה/);
  });
});
