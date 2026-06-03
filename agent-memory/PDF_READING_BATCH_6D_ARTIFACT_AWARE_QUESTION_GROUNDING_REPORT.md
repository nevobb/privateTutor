# PDF Reading Batch 6D — Artifact-aware Question Grounding

## Branch
- `repair/artifact-aware-question-grounding`

## Scope
- Narrow runtime augmentation only for the existing normal tutor grounding path.
- No Gemini runtime connection.
- No upload/extract/chunk changes.
- No UI changes.
- No file inventory behavior changes.

## Root goal
Use persisted document-understanding artifacts as optional grounding hints for normal tutor questions like section/page references, without replacing the existing chunk retrieval path and without exposing weak artifact text.

## Files changed
- `src/server/workspaces/sessionMessageApiService.ts`
- `src/server/tutor/deepseekGroundingPrompt.ts`
- `tests/server/workspaces/sessionMessageApiService.test.ts`
- `tests/server/tutor/deepseekProviderGrounding.test.ts`

## Implementation summary
- Replaced the direct `buildGroundingContextFromChunks(...)` call in the grounded-provider branch with `buildArtifactAwareGroundingContext(...)`.
- Kept chunk retrieval unchanged; the new helper starts from the existing chunk grounding context and only appends extra instruction text when there is a useful artifact match.
- Added a narrow artifact instruction builder that:
  - looks only at files already involved in retrieved chunks
  - only considers files with `understandingStatus === "completed"`
  - looks for explicit section/question/page cues in the user message
  - loads only `listDetectedQuestions(...)` and `listDocumentPages(...)` as needed
  - suppresses weak artifact snippets before they can enter the grounding instruction
  - adds extraction-quality caution for `partial` / `poor`
  - adds a conservative advanced-understanding warning when `deepPdfStatus === "recommended"`
- Updated `buildGroundingSection(...)` so the provider prompt actually includes the grounding instruction text, not just the `[SOURCE ...]` chunk blocks.

## Grounding integration point
- Existing integration point remains the second provider call inside `sendMessageForUser(...)` after chunk retrieval succeeds.
- Exact seam: `src/server/workspaces/sessionMessageApiService.ts` in the `retrievalExecution.retrievedChunks.length > 0` branch.
- Behavior stays additive: retrieved chunks remain the evidence path; artifact hints only help steer the model toward the right section/page.

## Artifact selection policy
- Trigger only when the user message includes explicit page or section/question cues.
- Restrict candidate files to those already represented in retrieved chunks.
- Restrict artifact usage to files with `understandingStatus === "completed"`.
- Prefer matched detected-question artifacts.
- Use page artifacts only for explicit page references and only when no better detected-question hint is already selected.

## Quality handling
- Weak artifact text is suppressed before entering grounding when it looks like:
  - broken Hebrew spacing fragments
  - repeated punctuation corruption
  - corrupted single-letter parameter lists
  - very short / not-clean-enough fragments
- For weak artifacts, the grounding instruction keeps only a cautious locator note instead of quoting broken text.
- For `extractionQuality === "partial" | "poor"`, the instruction explicitly tells the model to rely on retrieved chunk text for actual claims.

## Fallback behavior
- If there are no retrieved chunks, behavior is unchanged: no grounded second provider call.
- If there are retrieved chunks but no useful artifact match, behavior falls back to the existing chunk-only grounding instruction.
- Existing chunk retrieval fallback remains intact.

## Gemini isolation check
- `GeminiPdfUnderstandingProvider` still has no runtime callers in tutor/session/UI/API routes.
- `geminiPdfUnderstandingClient` remains isolated behind `src/server/workspaces/documentUnderstandingProvider.ts` and its tests.
- This batch does not call Gemini, does not load PDF bytes, and does not touch Deep PDF execution.

## Runtime safety check
- Upload/extract/chunk files were not modified.
- UI files were not modified.
- File inventory files were not modified.
- The only runtime behavior change is augmentation of the existing normal grounded tutor path after chunks are already retrieved.

## Tests added/updated
- `tests/server/tutor/deepseekProviderGrounding.test.ts`
  - verifies custom grounding instruction text is included in the prompt section
- `tests/server/workspaces/sessionMessageApiService.test.ts`
  - verifies a Hebrew section reference adds artifact-aware question hints to grounding
  - verifies weak artifact snippets are suppressed from grounding while a cautious note remains

## Validation
- `git branch --show-current` → `repair/artifact-aware-question-grounding`
- `git status --short` → only expected Batch 6D changes before report/log write
- `git diff --name-only` → only grounding prompt/service and their tests before report/log write
- `npx vitest run tests/server/tutor/deepseekProviderGrounding.test.ts tests/server/workspaces/sessionMessageApiService.test.ts` → passed (`2` files, `67` tests)
- `npx tsc --noEmit` → passed
- `npx vitest run` → passed (`63` files passed, `18` skipped; `719` tests passed, `121` skipped)
- `npm run build` → passed
- `git diff --check` → passed
- `graphify update .` → passed

## Risks / open decisions
- Artifact matching is intentionally narrow; it currently helps explicit section/page references more than broad topical questions.
- Quality filtering is heuristic, so future real PDFs may justify one more small tightening pass.
- Artifact hints are instruction-only in this batch; user-visible page/question citations remain for later work.

## Ready for Batch 7
- YES

## Safety
- I did not call Gemini.
- I did not connect Gemini to runtime.
- I did not change upload/extract/chunk.
- I did not change UI.
- I did not change file inventory behavior.
- I did not run `git add`.
- I did not commit.
- I did not push.
- I did not run `git pull`.
