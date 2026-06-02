# PDF Reading Batch 3 — Provider Boundary Report

## 1. Branch name
`repair/pdf-document-understanding-provider-boundary`

## 2. Files changed
New files created:
- `src/server/workspaces/documentUnderstandingProvider.ts`
- `src/server/workspaces/documentUnderstandingOrchestrationService.ts`
- `tests/server/workspaces/documentUnderstandingProvider.test.ts`
- `tests/server/workspaces/documentUnderstandingOrchestrationService.test.ts`

Memory/docs created:
- `agent-memory/PDF_READING_BATCH_3_PROVIDER_BOUNDARY_REPORT.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md` (sync entry appended)

No existing source files modified.

## 3. Provider interface added
`DocumentUnderstandingProvider` in `documentUnderstandingProvider.ts`:

```ts
export interface DocumentUnderstandingProvider {
  readonly name: string;
  readonly mode: DocumentUnderstandingMode;
  run(input: DocumentUnderstandingInput): Promise<DocumentUnderstandingOutput>;
}
```

## 4. Provider input/output shape

### Input — `DocumentUnderstandingInput`
```ts
{
  userId: string;
  workspaceId: string;
  fileId: string;
  fileName: string;
  storagePath: string;
  sourceType: "pdf" | "docx";
  extractedText?: string;
  extractedTextCharCount?: number;
  mode: "text_only" | "deep_pdf";
  // Optional future policy context — not used for routing decisions yet
  costMode?: CostMode;
  extractionQuality?: ExtractionQuality;
}
```

### Output — `DocumentUnderstandingOutput`
```ts
{
  providerName: string;
  providerMode: "text_only" | "deep_pdf";
  pageCount: number;
  pages: DocumentPageArtifact[];
  outline: DocumentOutlineArtifact | null;
  detectedQuestions: DetectedQuestionArtifact[];
  qualitySignals: DocumentQualitySignals;
  extractionQuality: ExtractionQuality | null;
  confidence: "high" | "medium" | "low";
  warnings: string[];
  errors: string[];
}
```

### Quality signals — `DocumentQualitySignals`
```ts
{
  hasExtractedText: boolean;
  extractedTextCharCount: number;
  likelyHasMath: boolean;
  likelyHasVisualContent: boolean;
  textQuality: "good" | "partial" | "poor" | "empty";
}
```

## 5. Providers added

### PdfParseOutlineProvider (`pdf_parse_outline`, mode: `text_only`)
- Fully implemented, deterministic, no external dependencies.
- Computes quality signals (printable ratio, char count, math symbol detection).
- Detects question boundaries via regex patterns for Hebrew and English academic formats:
  - `שאלה N`, `תרגיל N` (Hebrew)
  - `Question N`, `Exercise N`, `Problem N` (English)
  - `N. <text>` (numbered list)
- Builds `DetectedQuestionArtifact[]` with charStart/charEnd boundaries.
- Builds `DocumentOutlineArtifact` (outlineId = "v1") with sections mapped from detected questions.
- Builds a single `DocumentPageArtifact` (page_0001) from the full extracted text.
- On empty/missing extractedText: returns empty result with `extractionQuality: null` and `confidence: "low"`.
- No I/O, no Gemini calls, no network requests.

### GeminiPdfUnderstandingProvider (`gemini_pdf_understanding`, mode: `deep_pdf`)
- Placeholder/stub only.
- `run()` resolves immediately with `errors: ["not_implemented: ..."]`.
- Returns empty pages, null outline, empty detectedQuestions.
- No network calls, no Gemini API calls, no Firebase Storage reads.

## 6. How the boundary supports future automatic provider selection

The `DocumentUnderstandingInput` carries:
- `mode: "text_only" | "deep_pdf"` — future selection can switch mode based on signals.
- `costMode?: CostMode` — present but not used for routing yet; Batch 4 can gate on it.
- `extractionQuality?: ExtractionQuality` — present; can be read by a future quality gate to escalate from text_only to deep_pdf.
- `qualitySignals` in the output — contains `likelyHasMath`, `likelyHasVisualContent`, `textQuality`, and `extractedTextCharCount` — precisely the signals a Batch 4 quality gate needs.

A Batch 4 quality gate can inspect `output.qualitySignals` from the text-only provider and decide whether to re-run with `GeminiPdfUnderstandingProvider` based on:
- `likelyHasMath` && `textQuality !== "good"` → escalate
- `extractedTextCharCount < threshold` → escalate
- `costMode === "Deep Research"` → allow escalation

The interface is intentionally generic so that neither the provider interface nor the orchestration service encodes the selection logic.

## 7. How the boundary supports future LocalPdfUnderstandingProvider

Adding a future `LocalPdfUnderstandingProvider` requires:
1. Implement `DocumentUnderstandingProvider`.
2. Set `readonly mode: "text_only" | "deep_pdf"` (whichever is appropriate).
3. Inject it into the orchestration service via the `textOnlyProvider` or a new `deepProvider` dependency slot.

No interface changes needed. The orchestration service's `Dependencies` interface can gain an optional `deepProvider` slot in Batch 4 without breaking existing usages.

## 8. Lifecycle/orchestration behavior

`DocumentUnderstandingOrchestrationService` (in `documentUnderstandingOrchestrationService.ts`):

- `runTextOnlyUnderstanding(userId, fileId)` — single public method.
- Guards:
  - `file_not_found` if file doesn't exist.
  - `invalid_transition` if `understandingStatus === "pending"` or `"completed"`.
- Lifecycle transitions:
  - `not_started` / `failed` → `pending` → `completed` (success)
  - `not_started` / `failed` → `pending` → `failed` (provider throws)
- On success:
  - Persists pages via `replaceDocumentPages`.
  - Persists outline via `saveDocumentOutline`.
  - Persists detected questions via `replaceDetectedQuestions`.
  - Updates uploaded file metadata: `understandingStatus`, `understandingErrorCode`, `understandingUpdatedAt`, `pageCount`, `outlineTitle`, `detectedQuestionCount`, `extractionQuality`.
- On failure:
  - Marks `understandingStatus: "failed"` with `understandingErrorCode: "understanding_lifecycle_failed"`.
  - Returns `{ ok: false, code: "provider_error" }`.
- Dependency injection via `createDocumentUnderstandingOrchestrationService(deps?)` — follows existing service factory pattern.

## 9. Tests added/updated

### `tests/server/workspaces/documentUnderstandingProvider.test.ts`

**Provider contract tests (all providers):**
- Each provider has a non-empty name.
- Each provider has a valid mode.
- `run()` returns a promise.
- Output has required shape (providerName, providerMode, pageCount, pages, detectedQuestions, warnings, errors, qualitySignals, confidence).

**PdfParseOutlineProvider tests:**
- Empty extractedText → no-text partial result with warnings.
- Missing extractedText → same.
- Hebrew questions (`שאלה 1/2/3`) → outline + detected questions (≥3).
- English `Question N` patterns → detected (≥3).
- `Exercise` and `Problem` patterns → detected (≥2).
- Numbered list `1. 2. 3.` → detected (≥3).
- charStart/charEnd within text boundaries.
- Short garbled text → extractionQuality `poor`.
- Math symbols detected in `likelyHasMath`.
- No Gemini/external call — resolves in <1s.
- Prose text (no markers) → zero questions, medium confidence.
- Outline sections count matches detectedQuestions count.
- Outline outlineId = "v1".
- Page artifact has correct fileId.

**GeminiPdfUnderstandingProvider tests:**
- Name is `gemini_pdf_understanding`.
- Mode is `deep_pdf`.
- `run()` resolves without throwing.
- Errors array contains `not_implemented`.
- Empty pages, null outline, zero questions.
- Resolves in <500ms (no network).
- providerName matches name field.
- providerMode is `deep_pdf`.

### `tests/server/workspaces/documentUnderstandingOrchestrationService.test.ts`

**Lifecycle tests:**
- pending → completed on success.
- pending → failed when provider throws.
- `file_not_found` when file missing.
- `invalid_transition` when status is `pending`.
- `invalid_transition` when status is `completed`.
- Uploaded file metadata updates after success (detectedQuestionCount, extractionQuality, pageCount).
- Pages persisted via replaceDocumentPages.
- Outline persisted via saveDocumentOutline (outlineId = "v1").
- Detected questions persisted via replaceDetectedQuestions.
- Files with `not_started` can run.
- Files with `failed` status can re-run.

**Regression tests:**
- Does not call createUploadedFile or touch extraction/chunking.
- Does not set extractionStatus or chunkingStatus.

## 10. Validation results
- `npx tsc --noEmit` — ✅ passed
- `npx vitest run` — ✅ 62 files passed, 18 skipped; 648 tests passed, 121 skipped
- `npm run build` — ✅ passed
- `git diff --check` — ✅ passed
- `graphify update .` — ✅ 3671 nodes, 5082 edges, 260 communities

## 11. What was intentionally not implemented
- No live Gemini API calls.
- No Firebase Storage reads.
- No Gemini Files API usage.
- No automatic provider selection / quality gate.
- No Deep PDF mode execution.
- No tutor runtime routing changes.
- No UI changes.
- No file inventory behavior changes.
- No upload/extract/chunk behavior changes.
- No page-image rendering or OCR.
- No migration of old files.
- No user-facing Deep PDF toggle.
- No costMode-based routing.

## 12. Risks / open decisions
- `PdfParseOutlineProvider` runs on the full `extractedText` blob (no page-split). Page artifacts are single-page only. Accurate page numbers require Batch 4+ (either pdf-parse page split or Gemini deep PDF).
- Quality signal thresholds (textQuality: poor < 20 chars, partial < 200 chars) are heuristic. Real Hebrew math PDFs should be measured against these thresholds once real extraction data is available.
- Deduplication threshold (< 5 chars) handles same-position multi-pattern matches but does not handle semantic duplicates.
- The orchestration service does not yet gate on `extractionStatus === "completed"`. It accepts any file. A future guard could require extraction before running.
- `likelyHasVisualContent` is always `false` in the text-only provider. A Batch 4 quality gate may need a different signal source for visual content detection.
- `GeminiPdfUnderstandingProvider` throws no error — it returns an error in the `errors` array. This is intentional (graceful placeholder), but callers should check `output.errors` before treating the output as valid.

## 13. Confirmation that no git add / commit / push was run
Confirmed:
- No `git add`
- No `git commit`
- No `git push`

## 14. Confirmation that no git pull was run
Confirmed:
- No `git pull`
