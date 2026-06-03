# Sources UI v1 — Design

Date: 2026-06-04
Status: Approved (design)
Roadmap step: 3 (Improve source display)

## Problem

Answer sources are not readable. Today, chunk-derived citations are built as:

```ts
{ id: chunk.chunkId, sourceId: `${fileId}:${chunkId}`, referenceText: text.slice(0, 200) }
```

`originalFileName` is never set on chunk citations, so the UI (`SourcesSection` in
`TutorConversation.tsx`) falls back to an English `Source N` label plus a clamped
excerpt. The user cannot tell which file an answer came from. The collapsible
header reads `Sources (N)` in English inside an otherwise Hebrew RTL app.

Rich metadata (page number, section, detected question) exists only as **document
artifacts** (`listDocumentPages`, `listDetectedQuestions`, `getDocumentOutline`)
for files whose `understandingStatus === "completed"` (deep-PDF processed). It is
**not** present on regular `RetrievedFileChunk` / `FileChunk` records. Therefore
"show page/section when available" cannot be satisfied from chunks alone today.

## Goal

Make source cards read like academic citations, not debug output:

- Show the real file name.
- Show a short relevant excerpt.
- Show page / section **only when genuinely available** (no overclaiming).
- Never show raw IDs.
- Stay honest when metadata is missing.

## Scope decision

**v1 = Display layer + filename wiring (low risk).**

- Wire real filename + excerpt into chunk citations.
- Redesign the source card (compact citation line, Hebrew header).
- Add optional `pageNumber` / `sectionLabel` fields to the citation type so the UI
  can render them **if** a citation already carries them. Chunk citations will not
  populate page/section in v1 (they stay `undefined`, and the UI omits them).
- Guarantee no raw IDs reach the UI.

**Explicitly out of scope (fast-follow / later steps):**

- Joining chunks to document artifacts to populate page/section badges for
  understood files. (Real page/section enrichment — separate task.)
- Web-search citation icons / URL formatting.
- Clear Context behavior (roadmap step 4).

Rationale: this avoids touching the C5D grounding / retrieval contract
(`sessionMessageApiService` grounding path, `fileChunkRetrievalService` strict
prioritization). The only server change is additive: setting a display name on
citations that are already being produced.

## Design

### 1. Type change — `src/types/index.ts`

Extend `SourceCitation` with two optional display fields:

```ts
export interface SourceCitation {
  id: string;
  referenceText: string;
  sourceId: string;
  originalFileName?: string;
  pageNumber?: number;    // NEW — render only if present and valid (> 0)
  sectionLabel?: string;  // NEW — question/section label, render only if non-empty
}
```

These are optional and additive. No existing producer is required to set them.
They future-proof the artifact-join fast-follow without a second type change.

### 2. Citation mapping — `src/server/workspaces/sessionMessageApiService.ts`

In the chunk → citation mapping (currently around line 905, the function that maps
`chunks.map((chunk) => ({ id, sourceId, referenceText }))`):

- Build a `fileId → displayName` lookup from the uploaded files already listed in
  that retrieval path. Prefer `originalFileName`, fall back to `name`.
- Set `originalFileName` on each chunk citation from that map.
- Do **not** set `pageNumber` / `sectionLabel` in v1 (left `undefined`).
- Do **not** change `referenceText`, `id`, `sourceId`, scope, grounding, decision
  log events, or retrieval method selection.

If a citation's `fileId` has no matching uploaded file (defensive), leave
`originalFileName` unset; the UI falls back to a neutral label.

No other citation-producing path (web search, file-summary, mock passthrough)
changes behavior in v1.

### 3. UI rewrite — `SourcesSection` in `src/components/tutor/TutorConversation.tsx`

Compact citation line layout. The component stays a collapsible `<details>`.

- Header: `Sources (N)` → `מקורות (N)`. Set `dir="rtl"` (was `dir="ltr"`).
- Each card renders one metadata line then the excerpt:
  - Metadata line: `📄 {filename}`
    - append ` · עמ׳ {pageNumber}` **only if** `pageNumber` is a number `> 0`
    - append ` · {sectionLabel}` **only if** `sectionLabel` is a non-empty string
  - Excerpt: existing 3-line clamp, wrapped in `“…”`.
- Filename source: `originalFileName` (trimmed). Fallback when absent:
  `מקור {index + 1}` (Hebrew) — replaces the English `Source N`.
- The 📄 icon is shown only when we have a filename (i.e. a file-backed citation).
  When falling back to `מקור N` (e.g. web citations with no filename), omit the
  icon so we do not imply a file we cannot name.
- Never render `sourceId`, `id`, or any `fileId:chunkId` string.
- Keep existing dedupe logic in `normalizeCitations`.

`formatSourceLabel` is updated: return trimmed `originalFileName` when present,
otherwise `מקור ${index + 1}`.

### Honesty guarantees

- No page available → no page rendered. Never `עמ׳ ?` or a guessed number.
- No section available → no section rendered.
- No filename → neutral `מקור N`, never a raw ID.
- Excerpt is the real retrieved chunk text (clamped), not synthesized.

## Components & boundaries

- **`SourceCitation` (type):** the contract between server citation producers and
  the UI. Additive optional fields; existing consumers unaffected.
- **Citation mapping (server):** owns turning chunks into citations, including the
  display name. Depends on the uploaded-file list already in scope.
- **`SourcesSection` (UI):** owns presentation only. Pure function of
  `NormalizedCitation[]`. No data fetching. Testable in isolation.

## Data flow

```
retrieved chunks
  → citation mapping (sets originalFileName from fileId→name map; page/section undefined)
  → SourceCitation[] persisted on the tutor message
  → normalizeCitations() (dedupe + label)
  → SourcesSection (compact line; renders page/section only if present)
```

## Error / edge handling

- Missing uploaded-file match for a `fileId`: `originalFileName` stays unset → UI
  shows `מקור N`, no icon.
- `pageNumber` present but `<= 0` or non-numeric: treated as absent, omitted.
- `sectionLabel` present but empty/whitespace: treated as absent, omitted.
- Web-search citations (no `fileId`): unchanged; render excerpt with `מקור N`
  fallback, no file icon, no page.
- Zero citations: `SourcesSection` not rendered (existing guard
  `normalizedSources.length > 0`).

## Testing

`tests/components/tutor/TutorConversation.test.tsx`:

- Renders the real filename when `originalFileName` is set.
- Renders `· עמ׳ N` when `pageNumber > 0` is present.
- Omits page when `pageNumber` is absent / `<= 0`.
- Renders `· {sectionLabel}` when present; omits when empty.
- Falls back to `מקור N` (Hebrew) when no filename; no 📄 icon in that case.
- Never renders any `fileId:chunkId` / raw `sourceId` string.
- Header reads `מקורות (N)`.

`tests/server/workspaces/sessionMessageApiService.test.ts`:

- Chunk-derived citations now carry `originalFileName` resolved from the uploaded
  file list.
- Citations still omit `pageNumber` / `sectionLabel` (v1: undefined).
- Existing C5D grounding / no-whole-course assertions remain green (regression
  guard).

## Done when

- A file-backed answer shows the file name and a readable excerpt.
- Page / section appear only when genuinely available; otherwise omitted cleanly.
- No raw IDs appear anywhere in the sources UI.
- Header and labels are Hebrew, consistent with the RTL app.
- All existing tests stay green; new tests cover the above.
