# PDF Reading Batch 8A — Deep PDF Runtime + Tutor Behavior Fit Check

## 1. Branch name and HEAD commit
- Branch: `repair/artifact-aware-question-grounding`
- HEAD: `4bf7365 docs: add PDF reading runtime validation report`

## 2. Current Deep PDF readiness status
Current runtime readiness is **high enough for a small controlled Batch 8B**, because the supporting foundation is already in place:
- file metadata already carries `deepPdfStatus`, `understandingStatus`, `extractionQuality`, `storagePath`, `pageCount`, `detectedQuestionCount`, and `outlineTitle`
- text-only understanding already runs after chunking in a best-effort way
- document artifacts already persist through the orchestration layer
- the quality gate already computes a recommendation and never auto-runs today
- the Gemini provider already exists behind an isolated boundary and already supports either inline `pdfBytes` or an injected `PdfBytesLoader`

Product decision update from Nevo:
- many uploaded academic PDFs are expected to be math-heavy
- `Normal Learning` should be allowed to auto-run a **controlled one-time Deep PDF pass** for clearly weak/math-heavy/visual-dependent PDFs
- the target behavior is **run once when needed, persist the result, and reuse it**, not repeated Gemini execution

What is **not** ready yet:
- no server-side Firebase Storage PDF bytes loader exists
- no controlled Deep PDF orchestration entrypoint exists
- no provider-aware persistence policy exists for how Deep PDF should update/replace text-only artifacts
- persistence metadata is still missing for safe reprocessing / cache invalidation
- tutor behavior contract is not yet codified enough for weak-text vs deep-PDF-recommended states

## 3. Exact recommended trigger point
### Recommended trigger
The safest runtime trigger for controlled Deep PDF is:

**immediately after successful text-only understanding, when the quality gate clearly recommends advanced understanding, inside the same post-chunking best-effort lifecycle — but as a separate guarded branch that runs once, persists artifacts, and reuses them later.**

### Exact location
The best seam is the existing post-chunking flow in:
- `src/server/workspaces/uploadedFileApiService.ts`
- specifically after `runTextOnlyUnderstanding(...)` succeeds and after `evaluateDocumentQualityGate(...)` returns a recommendation

Today that seam already updates:
- `deepPdfStatus = "recommended"`

Batch 8B should extend **that exact branch**, not tutor-question runtime, for first controlled execution.

### Why this trigger is safest
- it reuses the existing best-effort lifecycle model
- it avoids running Deep PDF on every tutor question
- it avoids introducing Gemini into the message path before storage / persistence / fallback behavior are proven
- it keeps tutor latency stable
- it lets us gate on metadata that already exists (`extractionQuality`, `understandingStatus`, `storagePath`, `deepPdfStatus`)

### Recommendation
For Batch 8B, use **post-text-only-understanding controlled execution** as the primary path for new uploads, not on-demand tutor-question execution.

For existing older files, keep execution lazy: only trigger Deep PDF when the user actually studies/asks about that file.

## 4. Required guards
Batch 8B should require **all** of the following before Deep PDF runs automatically:

### File / artifact guards
- `sourceType === "pdf"`
- `storagePath` exists
- `extractionStatus === "completed"`
- `chunkingStatus === "completed"`
- `understandingStatus === "completed"`
- `deepPdfStatus === "recommended"`
- `deepPdfStatus !== "pending"`
- `deepPdfStatus !== "completed"` unless an explicit reprocessing guard says the cache is stale
- file already has text-only artifacts persisted

### Quality guards
- `extractionQuality === "poor"` OR clearly weak `"partial"`
- quality gate decision is `recommend_advanced_understanding` or `requires_user_confirmation_or_higher_cost_mode`
- prefer auto-run only when quality gate reasons include one of:
  - `math_heavy`
  - `weak_extracted_text`
  - `scanned_like`
  - `visual_reference` only if future visual support is relevant; not needed for the first narrow Batch 8B

### Runtime / environment guards
- `process.env.GEMINI_API_KEY` exists
- a server-side `PdfBytesLoader` is configured
- PDF bytes load succeeds and size is within an explicit safe limit
- no in-flight run already exists for this file (`deepPdfStatus !== "pending"`)

### Cost-mode guards
- `Cheap Practice` → never auto-run
- `Normal Learning` → auto-run only for clearly poor extraction / math-heavy PDFs and only if all config + size guards pass
- `Deep Research` → auto-run when quality gate recommends and all config + size guards pass

### Concurrency / dedupe guards
- update `deepPdfStatus` to `pending` before provider execution begins
- abort if another worker already changed it to `pending` / `completed`
- do not run if the current file snapshot no longer matches eligible status
- do not rerun if `deepPdfStatus === "completed"` and the original file identity is unchanged and the stored Deep PDF artifact/provider version is still current

## 5. Firebase Storage bytes-loader recommendation
### Current state
A reusable interface already exists in:
- `src/server/workspaces/documentUnderstandingProvider.ts`

```ts
export interface PdfBytesLoader {
  loadPdfBytes(input: Pick<DocumentUnderstandingInput, ...>): Promise<Uint8Array>;
}
```

The Gemini provider already supports:
- inline `pdfBytes`
- or injected loader fallback via `pdfBytesLoader`

What does **not** exist yet:
- a server-side Firebase Storage loader implementation for app-managed files

### Recommendation
Add a narrow server-only loader, for example:
- `src/server/workspaces/firebaseStoragePdfBytesLoader.ts`

Responsibilities only:
- validate app-owned `storagePath`
- download bytes from Firebase Storage using server credentials
- return `Uint8Array`
- enforce maximum size guard
- never log raw bytes or content

### Why this is the right boundary
- keeps Firebase Storage out of tutor runtime logic
- fits the existing provider interface cleanly
- keeps Gemini provider reusable and testable
- avoids leaking storage concerns into orchestration or tutor code

### Do not do in Batch 8B
- do not use client `getDownloadURL()` flow
- do not add browser-side loading
- do not make Gemini Files API the system of record

## 6. Deep PDF artifact persistence strategy
### Recommendation
For Batch 8B, **supplement and overwrite the same artifact collections with provider-upgraded content, while preserving text-only fallback through metadata/status rather than parallel collections. Deep PDF should be treated as a cached upgrade pass, not a per-conversation computation.**

### Concretely
Reuse the existing artifact stores:
- `pages`
- `documentOutline/v1`
- `detectedQuestions`

When Deep PDF succeeds:
- replace those artifacts with Deep PDF-derived artifacts
- update file metadata to reflect the improved state

### Why not provider-versioned collections yet
Provider-versioned collections are cleaner long-term, but they increase surface area and rollback complexity.
For the smallest safe Batch 8B:
- keep the same artifact paths
- treat Deep PDF as an upgrade of the canonical understanding layer
- rely on file metadata/status to describe which understanding level is active

### Required metadata update recommendation
Strictly speaking, the current metadata fields are not enough for safe cache reuse and reprocessing guards.

### Recommendation
Batch 8B should add at least:
- `understandingMode?: "text_only" | "deep_pdf"`
- `deepPdfProviderName?: string`
- `deepPdfModel?: string`
- `deepPdfInputHash?: string` **or** `deepPdfStorageGeneration?: string`
- `deepPdfArtifactVersion?: string`
- `deepPdfCompletedAt?: Date | null`
- `deepPdfUpdatedAt?: Date | null`
- `deepPdfErrorCode?: string | null`

These fields give the runtime enough information to decide:
- whether Deep PDF already ran
- whether the result is still current for this exact uploaded file version
- whether a future provider/prompt/artifact schema change should invalidate the cache

## 7. `deepPdfStatus` lifecycle recommendation
### Current enum
Already present and sufficient:
- `not_started`
- `recommended`
- `pending`
- `completed`
- `failed`
- `skipped`

### Recommendation
Do **not** add more states in Batch 8B. The current enum is good enough; the missing piece is richer metadata, not more status labels.

### Suggested meaning
- `not_started` — no Deep PDF recommendation/run yet
- `recommended` — quality gate says deeper reading would help, but not started
- `pending` — Deep PDF runtime currently running
- `completed` — Deep PDF artifacts successfully persisted
- `failed` — Deep PDF attempted but failed
- `skipped` — optional future explicit policy skip; not necessary to exercise in first Batch 8B behavior

This lifecycle is already good enough.

## 8. Cost mode policy recommendation
### Recommended policy
#### Cheap Practice
- never auto-run
- may mark `deepPdfStatus = "recommended"`
- tutor may mention that deeper reading would help, but should still give one practical text-based next action

#### Normal Learning
- auto-run when all of the following are true:
  - `sourceType === "pdf"`
  - `deepPdfStatus === "recommended"`
  - `understandingStatus === "completed"`
  - quality gate clearly indicates weak extraction / math-heavy PDF / visual-dependent document
  - `storagePath` present
  - API key present
  - bytes-loader present
  - size/config safe
  - no current cached Deep PDF result already matches the same file identity + artifact/provider version
- this should be the default controlled-runtime mode for Batch 8B for **new uploads**

#### Deep Research
- auto-run when the quality gate recommends and the same config/size/concurrency guards pass
- if future policy expands, this mode can become the least restrictive without changing the rest of the design

### Why this is the right policy
It matches the current product direction:
- no noisy always-on per-conversation Deep PDF
- still cost-aware
- gives `Normal Learning` the expected default help for math-heavy PDFs
- preserves the key caching rule: run once when needed, then reuse persisted artifacts

## 9. Tutor Behavior Contract
### Core contract
For file/PDF answers, the tutor should behave like a real Hebrew tutor:
- calm
- concise
- user-centered
- learning-task first
- no backend lifecycle narration unless the user explicitly asks about processing

### Rules
#### Always
- answer in a natural Hebrew tutor voice
- focus on the learner’s task, not pipeline internals
- show only useful structure/content
- give one practical next action

#### Never
- dump weak snippets as if they are useful
- sound like a processing log
- claim visual understanding unless Deep PDF actually completed and runtime is using those artifacts
- claim Gemini ran unless it actually did
- say “I extracted text” / “processing complete” / similar backend status language unless the user asked about processing state

#### When text-only extraction is weak and Deep PDF is only recommended
- if policy allows, the system should trigger the controlled deeper read instead of repeatedly telling the user only that extraction is weak
- if policy does not allow immediate run, say briefly that deeper reading is needed before giving a reliable summary
- do not apologize in loops
- do not list broken snippets
- still offer one next step the learner can take immediately

#### When Deep PDF is pending
- do not narrate internals unless needed
- say briefly that a deeper read is being prepared / is still running, then give a short temporary text-based next action

#### When Deep PDF completed
- reuse the saved Deep PDF artifacts
- behave more confidently about page/question structure
- still do not overclaim visual reasoning unless the Deep PDF result actually supports it

## 10. Inventory behavior matrix by state
| State | Desired inventory behavior |
|---|---|
| Clean text-only artifacts | Natural tutor response; brief orientation; useful list of detected questions/sections; one next step |
| Weak text-only artifacts + `deepPdfStatus = recommended` | For new uploads in allowed policy modes, controlled Deep PDF should usually start automatically; until then, do **not** show weak snippets and say briefly that deeper reading is needed for reliable formulas/notation |
| `deepPdfStatus = pending` | Briefly say deeper reading is still being prepared/running; avoid fake summaries; offer a short question/page-based next step |
| `deepPdfStatus = completed` | Prefer persisted Deep PDF-backed outline/question artifacts; give cleaner structured inventory; still concise and tutor-like |
| `deepPdfStatus = failed` | Fall back to best available text-only artifacts/chunks; stay honest that some parts are unclear; avoid backend blame wording |
| Old files without artifacts | Fall back safely to chunk-based inventory; no crashes; no false visual/Gemini claims |

## 11. Section/page Q&A behavior matrix by state
| State | Desired section/page Q&A behavior |
|---|---|
| Matching clean artifact | Use artifact-aware grounding to steer to the right part; answer from retrieved chunk evidence in normal tutor voice |
| Weak artifact | Do not quote broken artifact text; use cautious locator guidance only; rely on chunk evidence |
| Deep PDF recommended but not run | If policy allows, trigger the controlled deeper read; otherwise say briefly that deeper reading is needed before a reliable answer and offer one practical question-specific next step |
| Deep PDF completed | Reuse saved upgraded artifacts to guide section/page grounding more confidently; still cite/ground from actual retrieved evidence path |
| No artifacts | Fall back to existing chunk-only retrieval and grounding |

## 12. Recommended Batch 8B implementation scope
### Smallest safe Batch 8B
1. Add a server-only Firebase Storage `PdfBytesLoader`
2. Add a narrow Deep PDF orchestration method, separate from text-only orchestration
3. Trigger it only from the existing post-text-only-understanding + quality-gate recommendation seam in `uploadedFileApiService.ts`
4. Auto-run for **new uploads** in `Normal Learning` when the quality gate clearly says the PDF is weak/math-heavy/visual-dependent and all guards pass
5. Auto-run in `Deep Research` when recommended and guards pass
6. Never auto-run in `Cheap Practice`
7. Reuse existing artifact collections and replace them on Deep PDF success
8. Add cache/reprocessing metadata (`understandingMode`, provider/model/input/version timestamps/error)
9. Do **not** change tutor runtime/UI routing yet beyond metadata/state recognition if strictly necessary
10. Keep existing files lazy: no bulk backfill; process when the user actually studies/asks about them

### Explicitly not in Batch 8B
- no tutor-question-triggered Gemini runtime
- no UI toggle
- no visual PDF claims
- no OCR
- no multi-provider artifact versioning redesign
- no retrieval redesign

## 13. Risks / open decisions
- whether `understandingMode` should be required immediately in Batch 8B or can land alongside the first runtime pass
- whether file-size guard should be strict and fail-fast or soft-skip to `recommended`/`failed`
- the exact cache identity rule: `deepPdfInputHash` vs Storage generation vs both
- whether Deep PDF failure should reset to `recommended` or stay `failed` until explicit retry policy exists

## 14. Clear answer: Ready for Batch 8B?
- **YES**

## 15. Confirmation that no code was changed
Confirmed: no source/runtime code was changed for this Batch 8A fit check.

## 16. Confirmation that no git add / commit / push was run
Confirmed:
- no `git add`
- no `git commit`
- no `git push`

## 17. Confirmation that no git pull was run
Confirmed:
- no `git pull`
