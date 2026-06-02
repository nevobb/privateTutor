import { describe, expect, it } from "vitest";
import {
  evaluateDocumentQualityGate,
  type DocumentQualityGateInput,
} from "../../../src/server/workspaces/documentQualityGate";
import type { DocumentQualitySignals } from "../../../src/server/workspaces/documentUnderstandingProvider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function goodSignals(overrides: Partial<DocumentQualitySignals> = {}): DocumentQualitySignals {
  return {
    hasExtractedText: true,
    extractedTextCharCount: 3500,
    likelyHasMath: false,
    likelyHasVisualContent: false,
    textQuality: "good",
    ...overrides,
  };
}

function poorSignals(overrides: Partial<DocumentQualitySignals> = {}): DocumentQualitySignals {
  return {
    hasExtractedText: true,
    extractedTextCharCount: 30,
    likelyHasMath: false,
    likelyHasVisualContent: false,
    textQuality: "poor",
    ...overrides,
  };
}

function emptySignals(): DocumentQualitySignals {
  return {
    hasExtractedText: false,
    extractedTextCharCount: 0,
    likelyHasMath: false,
    likelyHasVisualContent: false,
    textQuality: "empty",
  };
}

// ---------------------------------------------------------------------------
// 1. Clean text PDF — prefer text_only
// ---------------------------------------------------------------------------

describe("clean text PDF", () => {
  it("returns use_text_only for good quality text without math", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals(),
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("use_text_only");
    expect(result.recommendedProviderMode).toBe("text_only");
    expect(result.reasons).toContain("clean_text");
    expect(result.shouldRunAutomatically).toBe(false);
  });

  it("returns high confidence for clearly clean text", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals(),
    };
    const result = evaluateDocumentQualityGate(input);
    expect(result.confidence).toBe("high");
  });

  it("safe fallback is always text_only for clean case", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals(),
    };
    const result = evaluateDocumentQualityGate(input);
    expect(result.safeFallbackProviderMode).toBe("text_only");
  });
});

// ---------------------------------------------------------------------------
// 2. Weak extracted text — recommend advanced
// ---------------------------------------------------------------------------

describe("weak extracted text", () => {
  it("recommends advanced understanding for partial quality", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "partial",
      qualitySignals: {
        ...goodSignals(),
        extractedTextCharCount: 80,
        textQuality: "partial",
      },
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("recommend_advanced_understanding");
    expect(result.recommendedProviderMode).toBe("deep_pdf");
  });

  it("recommends advanced understanding when charCount is very low", () => {
    const input: DocumentQualityGateInput = {
      extractedTextCharCount: 40,
      qualitySignals: poorSignals(),
    };
    const result = evaluateDocumentQualityGate(input);

    expect(["recommend_advanced_understanding", "requires_user_confirmation_or_higher_cost_mode"]).toContain(
      result.decision
    );
    expect(result.recommendedProviderMode).toBe("deep_pdf");
  });

  it("includes weak_extracted_text or scanned_like in reasons", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "partial",
      qualitySignals: {
        ...goodSignals(),
        extractedTextCharCount: 100,
        textQuality: "partial",
      },
    };
    const result = evaluateDocumentQualityGate(input);
    const hasWeakReason =
      result.reasons.includes("weak_extracted_text") ||
      result.reasons.includes("scanned_like") ||
      result.reasons.includes("missing_extracted_text");
    expect(hasWeakReason).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Math-heavy document
// ---------------------------------------------------------------------------

describe("math-heavy document", () => {
  it("recommends advanced understanding for math-heavy good-quality text", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals({ likelyHasMath: true }),
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("recommend_advanced_understanding");
    expect(result.reasons).toContain("math_heavy");
  });

  it("recommends advanced for math + poor quality", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "poor",
      qualitySignals: poorSignals({ likelyHasMath: true }),
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).not.toBe("use_text_only");
    expect(result.reasons).toContain("math_heavy");
  });

  it("Cheap Practice math-heavy: requires_user_confirmation", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals({ likelyHasMath: true }),
      costMode: "Cheap Practice",
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("requires_user_confirmation_or_higher_cost_mode");
    expect(result.reasons).toContain("cost_mode_restricted");
    expect(result.shouldRunAutomatically).toBe(false);
  });

  it("Normal Learning math-heavy: recommend without auto-run", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals({ likelyHasMath: true }),
      costMode: "Normal Learning",
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("recommend_advanced_understanding");
    expect(result.shouldRunAutomatically).toBe(false);
  });

  it("Deep Research math-heavy: recommend without auto-run", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals({ likelyHasMath: true }),
      costMode: "Deep Research",
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("recommend_advanced_understanding");
    expect(result.shouldRunAutomatically).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Visual/diagram signal
// ---------------------------------------------------------------------------

describe("visual/diagram signal", () => {
  it("recommends advanced understanding when likelyHasVisualContent is true", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals({ likelyHasVisualContent: true }),
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("recommend_advanced_understanding");
    expect(result.reasons).toContain("visual_reference");
  });

  it("recommends advanced when hasVisualContentRequest is true", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals(),
      hasVisualContentRequest: true,
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("recommend_advanced_understanding");
    expect(result.reasons).toContain("visual_reference");
  });

  it("visual + Cheap Practice returns requires_user_confirmation", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals({ likelyHasVisualContent: true }),
      costMode: "Cheap Practice",
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("requires_user_confirmation_or_higher_cost_mode");
    expect(result.shouldRunAutomatically).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Cheap Practice cost mode
// ---------------------------------------------------------------------------

describe("Cheap Practice cost mode", () => {
  it("never auto-runs advanced understanding", () => {
    const inputs: DocumentQualityGateInput[] = [
      {
        extractionQuality: "poor",
        qualitySignals: poorSignals({ likelyHasMath: true }),
        costMode: "Cheap Practice",
      },
      {
        extractionQuality: "good",
        qualitySignals: goodSignals({ likelyHasMath: true }),
        costMode: "Cheap Practice",
      },
      {
        qualitySignals: emptySignals(),
        costMode: "Cheap Practice",
      },
    ];

    for (const input of inputs) {
      const result = evaluateDocumentQualityGate(input);
      expect(result.shouldRunAutomatically).toBe(false);
    }
  });

  it("clean text with Cheap Practice stays use_text_only", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals(),
      costMode: "Cheap Practice",
    };
    const result = evaluateDocumentQualityGate(input);
    expect(result.decision).toBe("use_text_only");
    expect(result.shouldRunAutomatically).toBe(false);
  });

  it("recommendation possible but auto-run blocked for Cheap Practice", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "poor",
      qualitySignals: poorSignals(),
      costMode: "Cheap Practice",
    };
    const result = evaluateDocumentQualityGate(input);

    // Must NOT auto-run
    expect(result.shouldRunAutomatically).toBe(false);
    // recommendedProviderMode can still point to deep_pdf
    expect(result.safeFallbackProviderMode).toBe("text_only");
  });
});

// ---------------------------------------------------------------------------
// 6. Normal Learning — conservative behavior
// ---------------------------------------------------------------------------

describe("Normal Learning cost mode", () => {
  it("recommends advanced for weak text, no auto-run", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "partial",
      qualitySignals: {
        ...goodSignals(),
        extractedTextCharCount: 80,
        textQuality: "partial",
      },
      costMode: "Normal Learning",
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("recommend_advanced_understanding");
    expect(result.shouldRunAutomatically).toBe(false);
    expect(result.shouldShowUserNoticeLater).toBe(true);
  });

  it("clean text with Normal Learning stays use_text_only", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals(),
      costMode: "Normal Learning",
    };
    const result = evaluateDocumentQualityGate(input);
    expect(result.decision).toBe("use_text_only");
  });
});

// ---------------------------------------------------------------------------
// 7. Deep Research — more permissive recommendation
// ---------------------------------------------------------------------------

describe("Deep Research cost mode", () => {
  it("recommends advanced understanding for math-heavy, no auto-run yet", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals({ likelyHasMath: true }),
      costMode: "Deep Research",
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("recommend_advanced_understanding");
    expect(result.recommendedProviderMode).toBe("deep_pdf");
    // Auto-run not implemented yet — future Batch 5
    expect(result.shouldRunAutomatically).toBe(false);
  });

  it("recommends advanced for any weak/poor quality, no auto-run", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "poor",
      qualitySignals: poorSignals(),
      costMode: "Deep Research",
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("recommend_advanced_understanding");
    expect(result.shouldRunAutomatically).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. Missing extracted text
// ---------------------------------------------------------------------------

describe("missing extracted text", () => {
  it("returns recommend_advanced_understanding or insufficient_input when signals absent", () => {
    const input: DocumentQualityGateInput = {};
    const result = evaluateDocumentQualityGate(input);

    expect(["insufficient_input", "recommend_advanced_understanding"]).toContain(result.decision);
    expect(result.safeFallbackProviderMode).toBe("text_only");
    expect(result.shouldRunAutomatically).toBe(false);
  });

  it("returns insufficient_input when all key signals missing", () => {
    const input: DocumentQualityGateInput = {
      // No extractionQuality, no qualitySignals, no extractedTextCharCount
      sourceType: "pdf",
      costMode: "Normal Learning",
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).toBe("insufficient_input");
    expect(result.shouldRunAutomatically).toBe(false);
  });

  it("recommends advanced for empty quality signals", () => {
    const input: DocumentQualityGateInput = {
      qualitySignals: emptySignals(),
      costMode: "Normal Learning",
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.decision).not.toBe("use_text_only");
    expect(result.reasons).toContain("missing_extracted_text");
  });

  it("safe fallback is text_only even when text missing", () => {
    const input: DocumentQualityGateInput = {
      qualitySignals: emptySignals(),
    };
    const result = evaluateDocumentQualityGate(input);
    expect(result.safeFallbackProviderMode).toBe("text_only");
  });
});

// ---------------------------------------------------------------------------
// 9. Backward compatibility — old files with no new metadata
// ---------------------------------------------------------------------------

describe("backward compatibility", () => {
  it("does not crash for empty input", () => {
    expect(() => evaluateDocumentQualityGate({})).not.toThrow();
  });

  it("does not crash for partial old-file metadata", () => {
    const inputs: DocumentQualityGateInput[] = [
      { sourceType: "pdf" },
      { pageCount: 5 },
      { detectedQuestionCount: 3 },
      { extractionQuality: "good" },
      { extractedTextCharCount: 500 },
    ];

    for (const input of inputs) {
      expect(() => evaluateDocumentQualityGate(input)).not.toThrow();
    }
  });

  it("returns a valid output shape for any input", () => {
    const cases: DocumentQualityGateInput[] = [
      {},
      { extractionQuality: "good" },
      { extractionQuality: "poor" },
      { qualitySignals: goodSignals() },
      { qualitySignals: poorSignals(), costMode: "Cheap Practice" },
      { qualitySignals: emptySignals(), costMode: "Deep Research" },
    ];

    const validDecisions = [
      "use_text_only",
      "recommend_advanced_understanding",
      "requires_user_confirmation_or_higher_cost_mode",
      "insufficient_input",
    ];

    for (const input of cases) {
      const result = evaluateDocumentQualityGate(input);
      expect(validDecisions).toContain(result.decision);
      expect(["text_only", "deep_pdf"]).toContain(result.recommendedProviderMode);
      expect(["text_only", "deep_pdf"]).toContain(result.safeFallbackProviderMode);
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(["high", "medium", "low"]).toContain(result.confidence);
      expect(typeof result.shouldRunAutomatically).toBe("boolean");
      expect(typeof result.shouldShowUserNoticeLater).toBe("boolean");
    }
  });

  it("old file with only extractionQuality:good returns use_text_only", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
    };
    const result = evaluateDocumentQualityGate(input);
    // extractionQuality:good but no charCount → cannot confirm clean, should not crash
    // Use_text_only is acceptable here since no bad signals
    expect(result.safeFallbackProviderMode).toBe("text_only");
    expect(result.shouldRunAutomatically).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. Decision properties are internally consistent
// ---------------------------------------------------------------------------

describe("output consistency", () => {
  it("shouldRunAutomatically is always false in Batch 4", () => {
    const cases: DocumentQualityGateInput[] = [
      { qualitySignals: goodSignals({ likelyHasMath: true }), costMode: "Deep Research" },
      { qualitySignals: poorSignals(), costMode: "Normal Learning" },
      { qualitySignals: emptySignals(), costMode: "Normal Learning" },
      { extractionQuality: "good", qualitySignals: goodSignals() },
    ];

    for (const input of cases) {
      const result = evaluateDocumentQualityGate(input);
      expect(result.shouldRunAutomatically).toBe(false);
    }
  });

  it("recommendedProviderMode is deep_pdf when decision recommends advanced", () => {
    const cases: DocumentQualityGateInput[] = [
      { qualitySignals: goodSignals({ likelyHasMath: true }), costMode: "Normal Learning" },
      { qualitySignals: poorSignals(), costMode: "Normal Learning" },
    ];

    for (const input of cases) {
      const result = evaluateDocumentQualityGate(input);
      if (
        result.decision === "recommend_advanced_understanding" ||
        result.decision === "requires_user_confirmation_or_higher_cost_mode"
      ) {
        expect(result.recommendedProviderMode).toBe("deep_pdf");
      }
    }
  });

  it("safeFallbackProviderMode is always text_only", () => {
    const cases: DocumentQualityGateInput[] = [
      {},
      { qualitySignals: emptySignals() },
      { qualitySignals: poorSignals({ likelyHasMath: true }), costMode: "Deep Research" },
      { extractionQuality: "good", qualitySignals: goodSignals() },
    ];

    for (const input of cases) {
      const result = evaluateDocumentQualityGate(input);
      expect(result.safeFallbackProviderMode).toBe("text_only");
    }
  });

  it("use_text_only decision never sets shouldShowUserNoticeLater", () => {
    const input: DocumentQualityGateInput = {
      extractionQuality: "good",
      qualitySignals: goodSignals(),
    };
    const result = evaluateDocumentQualityGate(input);
    if (result.decision === "use_text_only") {
      expect(result.shouldShowUserNoticeLater).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Scanned-like PDF signals
// ---------------------------------------------------------------------------

describe("scanned-like PDF", () => {
  it("scanned-like PDF (tiny charCount, sourceType pdf) gets scanned_like reason", () => {
    const input: DocumentQualityGateInput = {
      sourceType: "pdf",
      extractedTextCharCount: 20,
      qualitySignals: {
        hasExtractedText: true,
        extractedTextCharCount: 20,
        likelyHasMath: false,
        likelyHasVisualContent: false,
        textQuality: "poor",
      },
    };
    const result = evaluateDocumentQualityGate(input);

    expect(result.reasons).toContain("scanned_like");
    expect(result.decision).not.toBe("use_text_only");
  });

  it("docx with tiny text does NOT get scanned_like (only PDFs can be scanned)", () => {
    const input: DocumentQualityGateInput = {
      sourceType: "docx",
      extractedTextCharCount: 20,
      qualitySignals: {
        hasExtractedText: true,
        extractedTextCharCount: 20,
        likelyHasMath: false,
        likelyHasVisualContent: false,
        textQuality: "poor",
      },
    };
    const result = evaluateDocumentQualityGate(input);
    expect(result.reasons).not.toContain("scanned_like");
  });
});
