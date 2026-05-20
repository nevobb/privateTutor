import { describe, expect, it } from "vitest";
import {
  TUTOR_TEACHING_CONTRACT,
  PUBLIC_TEACHING_CONTRACT_SUMMARY,
  isInstructionAwarenessQuestion,
} from "../../../src/server/tutor/teachingContract";

// ── Public summary content ────────────────────────────────────────────────────

describe("PUBLIC_TEACHING_CONTRACT_SUMMARY — required content", () => {
  it("includes Hebrew-first language rule", () => {
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).toMatch(/עברית/);
  });

  it("includes mechanism before formula", () => {
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).toMatch(/מנגנון לפני נוסחה/);
  });

  it("includes explicit instruction modes", () => {
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).toMatch(/רמז/);
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).toMatch(/פתרון מלא/);
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).toMatch(/תשובה סופית/);
  });

  it("includes local conceptual question behavior", () => {
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).toMatch(/שאלות מושגיות מקומיות/i);
  });

  it("includes no confident guessing", () => {
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).toMatch(/ניחוש/i);
  });

  it("includes LaTeX expectation", () => {
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).toMatch(/LaTeX/i);
  });

  it("includes new topic structure mention", () => {
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).toMatch(/נושא חדש/i);
  });

  it("includes foundation rebuild mode", () => {
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).toMatch(/בנייה מחדש/i);
  });
});

// ── Public summary must NOT expose internals ──────────────────────────────────

describe("PUBLIC_TEACHING_CONTRACT_SUMMARY — must not expose internals", () => {
  it("does not contain .env", () => {
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).not.toMatch(/\.env/i);
  });

  it("does not contain API key patterns", () => {
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).not.toMatch(/api.?key/i);
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).not.toMatch(/sk-/i);
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).not.toMatch(/DEEPSEEK/i);
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).not.toMatch(/GEMINI/i);
  });

  it("does not expose provider internals", () => {
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).not.toMatch(/deepseek/i);
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).not.toMatch(/gemini/i);
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).not.toMatch(/openai/i);
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).not.toMatch(/chain.of.thought/i);
  });

  it("does not mention system prompt wording", () => {
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).not.toMatch(/system.?prompt/i);
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).not.toMatch(/hidden.?instruction/i);
    expect(PUBLIC_TEACHING_CONTRACT_SUMMARY).not.toMatch(/TUTOR_TEACHING_CONTRACT/);
  });
});

// ── Runtime contract content ──────────────────────────────────────────────────

describe("TUTOR_TEACHING_CONTRACT — required content for prompt injection", () => {
  it("exists and is non-empty", () => {
    expect(TUTOR_TEACHING_CONTRACT.trim().length).toBeGreaterThan(100);
  });

  it("includes identity section", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/Identity/i);
  });

  it("includes explicit instruction wins rule", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/Explicit Instruction Always Wins/i);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/רק תשובה סופית/);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/פתרון מלא/);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/רק רמז/);
  });

  it("includes new topic structure", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/מה כדאי לדעת לפני/);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/הרעיון המרכזי/);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/סיכום למחברת/);
  });

  it("includes local question supremacy", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/Local Conceptual Question Supremacy/i);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/חזרה למסלול/);
  });

  it("includes no confident guessing rule", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/No Confident Guessing/i);
  });

  it("includes Hebrew language rule", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/Hebrew by default/i);
  });

  it("includes LaTeX rule", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/LaTeX/i);
  });

  it("includes hint mode rules", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/Guidance.*Hint/i);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/do NOT.*calculate/i);
  });
});

// ── Instruction awareness detection ──────────────────────────────────────────

describe("isInstructionAwarenessQuestion", () => {
  it("detects Hebrew teaching-style question", () => {
    expect(isInstructionAwarenessQuestion("איך אתה אמור ללמד אותי?")).toBe(true);
  });

  it("detects instructions question", () => {
    expect(isInstructionAwarenessQuestion("לפי איזה הוראות אתה עובד?")).toBe(true);
  });

  it("detects teaching style question", () => {
    expect(isInstructionAwarenessQuestion("מה סגנון ההוראה שלך?")).toBe(true);
  });

  it("detects hint decision question", () => {
    expect(isInstructionAwarenessQuestion("איך אתה מחליט אם לתת רמז?")).toBe(true);
  });

  it("detects English teaching style question", () => {
    expect(isInstructionAwarenessQuestion("what is your teaching style?")).toBe(true);
  });

  it("does not match regular subject questions", () => {
    expect(isInstructionAwarenessQuestion("תסביר לי אינטגרציה בהצבה")).toBe(false);
  });

  it("does not match mid-exercise questions", () => {
    expect(isInstructionAwarenessQuestion("למה אפשר להחליף משתנה כאן?")).toBe(false);
  });

  it("does not match greetings", () => {
    expect(isInstructionAwarenessQuestion("היי, איך שלומך?")).toBe(false);
  });

  it("does not match hint requests", () => {
    expect(isInstructionAwarenessQuestion("תן לי רק רמז")).toBe(false);
  });
});

// ── Behavior mode expectations (contract-level, no LLM call) ─────────────────

describe("teaching contract — behavior mode declarations", () => {
  it("hint mode: contract explicitly forbids calculation", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/do NOT.*calculate/i);
  });

  it("hint mode: contract explicitly forbids revealing final answer", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/no.*final answer/i);
  });

  it("full solution: contract requires what/why/calculation/result per step", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/what is being done/i);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/why/i);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/calculation/i);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/what came out/i);
  });

  it("local question: contract explicitly forbids auto-continuation", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/do NOT continue solving automatically/i);
  });

  it("new topic: mandatory notebook summary declared", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/MANDATORY/i);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/מתכון/);
  });

  it("no confident guessing: requires explicit assumption or clarification", () => {
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/explicit assumption/i);
    expect(TUTOR_TEACHING_CONTRACT).toMatch(/one clarification/i);
  });
});
