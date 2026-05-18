import { describe, expect, it } from "vitest";
import { decideRetrievalBoundary } from "../../../src/server/tutor/retrievalDecisionBoundary";

describe("retrieval decision boundary matrix", () => {
  it("simple fact -> no retrieval", () => {
    const decision = decideRetrievalBoundary({
      message: "מה הנגזרת של x^2?",
      workMode: "Learning",
      costMode: "Normal Learning",
    });

    expect(decision.needs_retrieval).toBe(false);
    expect(decision.retrieval_scope).toBe("none");
    expect(decision.should_ask_clarification_first).toBe(false);
  });

  it("broad question -> clarification first and no retrieval", () => {
    const decision = decideRetrievalBoundary({
      message: "תסביר הכול על אלגברה לינארית",
      workMode: "Learning",
      costMode: "Normal Learning",
    });

    expect(decision.needs_retrieval).toBe(false);
    expect(decision.should_ask_clarification_first).toBe(true);
  });

  it("active context question -> retrieval needed", () => {
    const decision = decideRetrievalBoundary({
      message: "from the file we uploaded, what is theorem 2?",
      workMode: "Learning",
      costMode: "Normal Learning",
    });

    expect(decision.needs_retrieval).toBe(true);
    expect(decision.retrieval_scope).toBe("session");
    expect(decision.max_chunks).toBeGreaterThan(0);
  });

  it("cheap practice -> lower budget", () => {
    const decision = decideRetrievalBoundary({
      message: "Based on my notes, give one quick practice hint",
      workMode: "Practice",
      costMode: "Cheap Practice",
    });

    expect(decision.max_chunks).toBe(2);
    expect(decision.max_tokens).toBe(700);
  });

  it("deep research -> higher budget and broader scope", () => {
    const decision = decideRetrievalBoundary({
      message: "Compare these two approaches with context from the material",
      workMode: "Research",
      costMode: "Deep Research",
    });

    expect(decision.needs_retrieval).toBe(true);
    expect(decision.retrieval_scope).toBe("workspace");
    expect(decision.max_chunks).toBe(8);
    expect(decision.max_tokens).toBe(2800);
  });
});
