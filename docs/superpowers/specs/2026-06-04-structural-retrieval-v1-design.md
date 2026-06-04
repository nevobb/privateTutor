# Structural Retrieval v1 — Design

Date: 2026-06-04
Status: Approved (design)
Roadmap step: 5/6 (Improve retrieval for academic references)

## Problem

When the learner refers to a structural location — `שאלה 3`, `סעיף ב`, `עמוד 3` —
the tutor should answer from THAT part of the active file. Today it does not route
retrieval there. The current flow:

1. `executeRetrievalForTutorResponse` retrieves chunks by semantic/keyword
   similarity to the raw user message, with the active/selected files prioritized
   (`prioritizedFileIds`).
2. `maybeBuildArtifactAwareGroundingInstruction` then appends a textual HINT to the
   grounding prompt ("the learner likely refers to question 2 on page 3 …"),
   matched against the file's detected questions / pages.

The hint helps the model, but the retrieved chunks are still chosen by similarity
to a message like `תפתור את שאלה 3` — whose words barely match the target content.
The right chunks may never be retrieved. The plan requires structural references to
**route retrieval to the right area**, using semantic search **only after**
structural matching fails.

## What already exists (reuse, do not rebuild)

- `extractRequestedPages(message)` → page numbers from `עמוד N`.
- `extractArtifactGroundingSignals(message)` → `{number}` / `{letter}` from
  `שאלה|תרגיל|סעיף|מקטע|question|exercise|problem N` and `סעיף|מקטע <hebrew-letter>`.
- `matchesArtifactGroundingSignals(label, signals)` → matches a detected-question
  label against those signals.
- Artifacts carry chunk mappings (the key enabler):
  - `DetectedQuestionArtifact.sourceChunkIds: string[]` (+ `questionNumber`, `label`,
    `pageStart/End`, `charStart/End`, and `subsections[]` each with `label` +
    `sourceChunkIds`).
  - `DocumentPageArtifact.sourceChunkIds: string[]` (+ `pageNumber`).
- Repository reads: `listDetectedQuestions(userId, fileId)`,
  `listDocumentPages(userId, fileId)`, `listFileChunks(userId, workspaceId, fileId)`.
- The grounding-hint path (`maybeBuildArtifactAwareGroundingInstruction`) stays — it
  remains useful as supplemental context.

## Scope decision

**v1 = structural-first retrieval routing for explicit references, with safe
semantic fallback. Additive and C5D-safe.**

In scope:
- `עמוד N` → chunks of `DocumentPageArtifact` with `pageNumber === N`.
- `שאלה N` / `תרגיל N` / `question|exercise|problem N` → chunks of the matching
  `DetectedQuestionArtifact`.
- `סעיף <letter>` / `מקטע <letter>` → chunks of the matching subsection (within a
  matched/!any question), else the question.
- Resolution is restricted to the active selected files first (the
  `prioritizedFileIds` / `attachedFileIds` scope). If there is no active file, the
  existing C5D clarification path already handles vague structural asks
  (`תפתור את שאלה 3` → "which material?") — unchanged.
- If structural resolution yields chunks, retrieval uses them and skips semantic
  search. If it yields nothing (no artifacts, ref not found, file not understood),
  fall through to the EXISTING semantic/keyword retrieval, unchanged.

Out of scope (documented fast-follow):
- Relative references (`התרגיל הבא` / "next exercise", "the previous one") — require
  tracking the current-exercise position in conversation state. Not in v1; these
  fall through to existing behavior safely.
- Cross-file structural refs when multiple files are active beyond first-match.
- Changing semantic scoring, budgets, grounding-hint wording, or the C5D
  no-whole-course / clarification contracts.

## Design

### New unit: structural chunk resolver

New file: `src/server/workspaces/structuralRetrievalService.ts`.

A pure-ish resolver that, given the user message and a per-file artifact accessor,
returns the target chunk IDs (and which files they belong to), or empty when there
is no structural match.

```ts
export interface StructuralRetrievalDeps {
  listDetectedQuestions: (userId: string, fileId: string) => Promise<DetectedQuestionArtifact[]>;
  listDocumentPages: (userId: string, fileId: string) => Promise<DocumentPageArtifact[]>;
}

export interface StructuralMatch {
  fileId: string;
  chunkIds: string[];
  matchKind: "page" | "question" | "subsection";
  matchLabel: string; // e.g. "עמוד 3", "שאלה 2", "סעיף ב" — for logging/citations
}

// Returns [] when the message has no structural signal, or no artifact matches.
export async function resolveStructuralChunkTargets(
  deps: StructuralRetrievalDeps,
  userId: string,
  fileIds: string[],          // active/eligible files, in priority order
  userMessage: string
): Promise<StructuralMatch[]>;
```

Behavior:
- Parse signals with the EXISTING extractors (export them from
  `sessionMessageApiService.ts` or move the trio into the new module and re-import —
  see "Refactor" below).
- For each file in `fileIds` (priority order), resolve in this order:
  question/subsection signals against `listDetectedQuestions`, then page signals
  against `listDocumentPages`. Stop at the first file that produces a non-empty
  match (v1: first-match wins; keeps it simple and honest).
- A `סעיף <letter>` signal: if a question is also referenced, match the subsection
  within that question; otherwise match any subsection whose label matches the
  letter. If only a question number is referenced, return the question's
  `sourceChunkIds`.
- Deduplicate chunkIds, preserve order.
- Never throw: on repository error for a file, skip that file (best-effort).

### Refactor (small, in service of this work)

Move `extractRequestedPages`, `extractArtifactGroundingSignals`,
`matchesArtifactGroundingSignals`, `normalizeHebrewGroundingLetter`, and the
`ArtifactGroundingSignal` type out of `sessionMessageApiService.ts` into the new
`structuralRetrievalService.ts`, and re-import them where the grounding-hint path
uses them. This keeps the parsing logic in one place and shrinks the already-large
`sessionMessageApiService.ts`. No behavior change to the hint path.

### Wiring into retrieval

In `executeRetrievalForTutorResponse` (`sessionMessageApiService.ts`), BEFORE the
existing `retrieveFileChunks` semantic call, add a structural pre-step **only when**
there are active/eligible files (the same `prioritizedFileIds` already computed):

1. `const matches = await resolveStructuralChunkTargets(deps, userId, prioritizedFileIds, userMessage);`
2. If `matches` is non-empty: load the referenced chunks via `listFileChunks` for the
   matched file(s), filter to the matched `chunkIds` (preserving artifact order),
   map into `RetrievedFileChunk[]` (reuse the existing chunk→RetrievedFileChunk
   shape; `sourceLabel = file name`, `retrievalMethod = "structural"` — add this
   variant to the union), and return them through the SAME
   `executeChunkRetrieval(...)` path so citations/grounding/decision-log all work
   identically. Set `internalUpdate.retrieval.why = "structural_retrieval_<kind>_<label>"`.
3. If `matches` is empty: proceed to the existing semantic/keyword retrieval path,
   completely unchanged.

This makes structural routing an additive short-circuit. The C5D path (no active
file → clarify; selected-file empty → honest fallback; no-whole-course) is
untouched, because the structural step only runs within the active-file scope and
only short-circuits on a positive match.

`RetrievedFileChunk.retrievalMethod` union gains `"structural"`. Citation building
(`executeChunkRetrieval`) already reads `sourceLabel` → `originalFileName` (Sources
UI v1), so structural citations get the file name for free. Page/question metadata
can also be set on citations here (`pageNumber` / `sectionLabel` from the match) —
this is where the Sources UI v1 optional fields finally populate for the structural
case. (Nice, honest payoff; only set them from a real artifact match.)

### Honesty / fallback

- No structural signal in message → resolver returns [] → existing behavior.
- Structural signal but file not understood / no artifacts / ref not found →
  resolver returns [] → existing semantic retrieval (which, if it also finds
  nothing in the selected file, triggers the C5D honest "not enough in selected
  file, search rest?" path). No overclaiming.
- Relative ref (`התרגיל הבא`) → not parsed → [] → existing behavior.

## Components & boundaries

- `structuralRetrievalService.ts` — owns ref parsing + artifact→chunkId resolution.
  Pure logic over injected repository reads; unit-testable without Firestore.
- `executeRetrievalForTutorResponse` — orchestrates: structural pre-step, else
  semantic. Thin wiring.
- `executeChunkRetrieval` — unchanged contract; now also receives structural chunks.

## Data flow

```
user message + active fileIds
  → resolveStructuralChunkTargets (parse refs → match artifacts → chunkIds)
  → if match: listFileChunks → filter to chunkIds → RetrievedFileChunk[] (method="structural")
             → executeChunkRetrieval → citations (+page/section) / grounding / decisionlog
  → if no match: existing semantic/keyword retrieveFileChunks (unchanged)
```

## Testing

New `tests/server/workspaces/structuralRetrievalService.test.ts`:
- `עמוד 3` → returns the page-3 artifact's chunkIds.
- `שאלה 2` / `תרגיל 2` / `question 2` → returns that question's chunkIds.
- `סעיף ב` within a referenced question → returns that subsection's chunkIds.
- `סעיף ב` alone → matches subsection by letter.
- No structural signal → returns [].
- Signal present but no matching artifact → returns [].
- File not understood / repository error → skipped, no throw.
- First-match-wins across multiple active files.

`tests/server/workspaces/sessionMessageApiService.test.ts` (integration):
- With an active file that has a detected `שאלה 3`, sending `תפתור את שאלה 3` routes
  retrieval to that question's chunks (assert `retrieval.why` contains `structural`
  and citations are the question's chunks), WITHOUT calling the semantic retriever.
- With an active file but a structural ref that matches nothing, falls back to the
  existing semantic path (semantic retriever IS called).
- No active file + `תפתור את שאלה 3` → unchanged C5D clarification (regression).
- Existing C5D / no-whole-course / grounding tests stay green.

## Done when

- `תפתור את שאלה 3` with an active understood file routes to question 3's chunks.
- Section/page references route to the right chunks.
- Missing metadata / relative refs fall back safely (no overclaim, no crash).
- Semantic search runs only after structural matching fails.
- Structural citations carry file name (and page/section where the match provides
  them).
- New resolver unit tests + integration tests pass; full suite + build green; manual
  smoke confirms a `שאלה N` answer is grounded in that question's content.
