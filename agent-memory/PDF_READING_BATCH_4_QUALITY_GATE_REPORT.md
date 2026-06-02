# PDF Reading Batch 4 — Automatic Document Quality Gate Report

## 1. Branch name
`repair/pdf-document-quality-gate`

## 2. Files changed
New files created:
- `src/server/workspaces/documentQualityGate.ts`
- `tests/server/workspaces/documentQualityGate.test.ts`

Memory/docs created:
- `agent-memory/PDF_READING_BATCH_4_QUALITY_GATE_REPORT.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md` (sync entry appended)

No existing source files modified.

## 3. Quality gate input/output shape

### Input — `DocumentQualityGateInput`
```ts
{
  // From uploaded file metadata (may be undefined for old files)
  extractionQuality?: ExtractionQuality | null;
  extractedTextCharCount?: number;
  pageCount?: number;
  detectedQuestionCount?: number;
  sourceType?: "pdf" | "docx" | "note" | "other";
  // From provider qualitySignals (may be absent if understanding not yet run)
  qualitySignals?: DocumentQualitySignals;
  // Policy context
  costMode?: CostMode;
  // User/session signals (future use — present but not required)
  hasVisualContentRequest?: boolean;
}
```

All fields are optional. Old files with no new metadata fields produce valid output without crashing.

### Output — `DocumentQualityGateOutput`
```ts
{
  decision: QualityGateDecision;
  recommendedProviderMode: "text_only" | "deep_pdf";
  reasons: QualityGateReason[];
  confidence: "high" | "medium" | "low";
  extractionQuality: ExtractionQuality | null;
  shouldRunAutomatically: boolean;
  shouldShowUserNoticeLater: boolean;
  safeFallbackProviderMode: "text_only" | "deep_pdf";
}
```

`safeFallbackProviderMode` is always `"text_only"` — callers can safely use text-only if they choose to ignore the recommendation.

## 4. Decision policy

### Decisions:
| Decision | When |
|---|---|
| `use_text_only` | Extraction quality is good, no math/visual signals, charCount sufficient |
| `recommend_advanced_understanding` | Weak/poor text, math-heavy, visual signals present, cost mode allows |
| `requires_user_confirmation_or_higher_cost_mode` | Advanced is indicated but `Cheap Practice` blocks auto-recommendation |
| `insufficient_input` | No extractionQuality, no qualitySignals, no charCount — cannot evaluate |

### Reasons (one or more per output):
| Reason | Signal |
|---|---|
| `clean_text` | extractionQuality = good, charCount ≥ 200, no math/visual |
| `weak_extracted_text` | charCount < 200 but ≥ 50, not scanned-like |
| `math_heavy` | `likelyHasMath = true` |
| `visual_reference` | `likelyHasVisualContent = true` OR `hasVisualContentRequest = true` |
| `scanned_like` | sourceType = pdf AND charCount < 50 |
| `missing_extracted_text` | `hasExtractedText = false` OR charCount = 0 |
| `cost_mode_restricted` | Cheap Practice mode blocked auto-recommendation |

### Thresholds:
- `WEAK_TEXT_CHAR_THRESHOLD = 200`: below this, extraction is considered weak
- `POOR_TEXT_CHAR_THRESHOLD = 50`: below this (PDF only), document is likely scanned/image-only

## 5. Cost mode behavior

| Cost mode | Auto-run advanced | Recommendation | Result |
|---|---|---|---|
| `Cheap Practice` | Never | Blocked | `requires_user_confirmation_or_higher_cost_mode` |
| `Normal Learning` | Never (Batch 4) | Allowed | `recommend_advanced_understanding` |
| `Deep Research` | Never (Batch 4) | Allowed | `recommend_advanced_understanding` |
| `undefined` | Never (Batch 4) | Allowed | `recommend_advanced_understanding` |

`costModeAllowsAutoRun()` is defined as a named function that returns `false` in all cases. This is a deliberate placeholder — Batch 5 replaces this single function to enable actual auto-run without changing the surrounding decision logic.

## 6. How this supports automatic provider selection later

The gate is designed for easy Batch 5 extension:

1. `costModeAllowsAutoRun(costMode)` is a named, isolated function — Batch 5 changes it to return `true` for `"Normal Learning"` (small files) and `"Deep Research"` (any weak extraction) without touching any other logic.

2. `shouldRunAutomatically` is already in the output shape — callers can act on it immediately once Batch 5 flips the function.

3. `shouldShowUserNoticeLater` is already propagated — UI can surface a notice without any more logic changes.

4. The gate is a pure function (`evaluateDocumentQualityGate`) — it can be called from:
   - The orchestration service after a text-only pass.
   - An upload lifecycle hook after extraction completes.
   - A background job reading stored file metadata.
   - No changes to the gate itself are needed for any of these integrations.

5. `hasVisualContentRequest` is already in the input — the tutor request classifier can pass `true` when intent is `visual_reference_request`, enabling on-demand escalation without changing the gate logic.

## 7. Tests added/updated

### `tests/server/workspaces/documentQualityGate.test.ts` (35 tests)

**Clean text PDF:**
- `use_text_only` for good quality + no math.
- High confidence for clean text.
- `safeFallbackProviderMode` always `text_only`.

**Weak extracted text:**
- `recommend_advanced_understanding` for partial quality.
- `recommend_advanced_understanding` for very low charCount.
- Reasons include `weak_extracted_text` or `scanned_like`.

**Math-heavy document:**
- Recommends advanced for math-heavy good-quality text.
- Recommends advanced for math + poor quality.
- Cheap Practice math-heavy: `requires_user_confirmation_or_higher_cost_mode`.
- Normal Learning math-heavy: recommend, no auto-run.
- Deep Research math-heavy: recommend, no auto-run.

**Visual/diagram signal:**
- Recommends advanced when `likelyHasVisualContent = true`.
- Recommends advanced when `hasVisualContentRequest = true`.
- Visual + Cheap Practice: `requires_user_confirmation`.

**Cheap Practice:**
- Never auto-runs for any input.
- Clean text stays `use_text_only`.
- Poor text: no auto-run, safeFallback is text_only.

**Normal Learning:**
- Recommends advanced for weak text, no auto-run.
- Clean text stays `use_text_only`.

**Deep Research:**
- Recommends advanced for math-heavy, no auto-run.
- Recommends advanced for poor quality, no auto-run.

**Missing extracted text:**
- Empty input → `insufficient_input` or `recommend_advanced_understanding`.
- Fully absent signals → `insufficient_input`.
- Empty quality signals → not `use_text_only`, reasons include `missing_extracted_text`.
- `safeFallbackProviderMode = text_only` even when text missing.

**Backward compatibility:**
- Empty input doesn't crash.
- Partial old-file metadata doesn't crash.
- Any input produces a valid output shape.
- Old file with only `extractionQuality: "good"` — safe result without crash.

**Output consistency:**
- `shouldRunAutomatically` always `false` in Batch 4.
- `recommendedProviderMode = deep_pdf` whenever decision recommends advanced.
- `safeFallbackProviderMode` always `text_only`.
- `use_text_only` decision never sets `shouldShowUserNoticeLater`.

**Scanned-like PDF:**
- PDF with charCount < 50 gets `scanned_like` reason.
- DOCX with tiny text does NOT get `scanned_like`.

## 8. Validation results
- `npx tsc --noEmit` — ✅ passed
- `npx vitest run` — ✅ 63 files passed, 18 skipped; 683 tests passed, 121 skipped
- `npm run build` — ✅ passed
- `git diff --check` — ✅ passed
- `graphify update .` — ✅ 3715 nodes, 5147 edges, 257 communities

## 9. What was intentionally not implemented
- No live Gemini calls.
- No actual Deep PDF execution.
- No automatic escalation to advanced provider (auto-run always false).
- No tutor runtime integration.
- No file inventory changes.
- No upload/extract/chunk changes.
- No UI changes.
- No user-facing toggle.
- No Firestore writes.
- No migration of old files.
- `costModeAllowsAutoRun()` deliberately returns `false` — Batch 5 will implement.

## 10. Risks / open decisions
- `likelyHasVisualContent` from `PdfParseOutlineProvider` is always `false` (text-only provider can't detect visuals). The gate's `hasVisualContentRequest` input field provides an alternative path from the tutor classifier.
- `WEAK_TEXT_CHAR_THRESHOLD = 200` is heuristic. Hebrew math PDFs may have denser text; measurement against real files is needed before tuning.
- `POOR_TEXT_CHAR_THRESHOLD = 50` (scanned-like) applies only to PDFs. DOCX with tiny text is treated as `weak_extracted_text`, not `scanned_like`.
- The gate is a pure function with no Firestore read — callers must pass the right metadata. A wrapping service that reads file metadata and calls the gate is not yet implemented.
- `detectedQuestionCount` and `pageCount` are in the input shape for future use but are not evaluated by the current logic. Batch 5 can add heuristics like "0 detected questions on a 20-page file → likely layout-complex".

## 11. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`

## 12. Confirmation that no git pull was run
Confirmed:
- No `git pull`
