# Sources UI v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make answer source cards read like academic citations — real file name, readable excerpt, page/section only when genuinely present, zero raw IDs, Hebrew RTL.

**Architecture:** Three additive changes. (1) Server: set `originalFileName` on chunk-derived citations from the file name already carried on each chunk (`chunk.sourceLabel`) — no new plumbing, no retrieval/grounding change. (2) Type: add optional `pageNumber` / `sectionLabel` to `SourceCitation` so the UI can render them when present (left `undefined` in v1). (3) UI: rewrite `SourcesSection` to a compact citation line with Hebrew header and honest omission of missing metadata.

**Tech Stack:** Next.js, TypeScript, React (server-rendered components tested via `renderToStaticMarkup`), Vitest.

**Planning note (refinement of spec):** The spec assumed `executeChunkRetrieval` had the uploaded-file list in scope to build a `fileId → name` map. It does not. Each `RetrievedFileChunk` already carries `sourceLabel = file.name` (set in `fileChunkRetrievalService.ts`), and `file.name` is the human filename (e.g. `Agnon_Stories.pdf`; `originalFileName` is usually absent). So we use `chunk.sourceLabel` directly. Same user-visible result, zero plumbing, and **no edit to any C5D-touched retrieval file**.

---

## File Structure

- `src/types/index.ts` — `SourceCitation` gains optional `pageNumber` / `sectionLabel`. Contract between server producers and UI.
- `src/server/workspaces/sessionMessageApiService.ts` — `executeChunkRetrieval` sets `originalFileName` on each citation. Display-name only; no scope/grounding/decision-log change.
- `src/components/tutor/TutorConversation.tsx` — `SourcesSection` + `formatSourceLabel` rewritten for the compact line layout. Presentation only.
- `tests/server/workspaces/sessionMessageApiService.test.ts` — assert chunk citations carry `originalFileName`.
- `tests/components/tutor/TutorConversation.test.tsx` — update Hebrew labels; add page/section render + omission + no-ID tests.

---

## Task 1: Server wires file name into chunk citations

**Files:**
- Modify: `src/server/workspaces/sessionMessageApiService.ts:905-909`
- Test: `tests/server/workspaces/sessionMessageApiService.test.ts:863-869`

- [ ] **Step 1: Strengthen the existing chunk-citation test to require the file name**

In `tests/server/workspaces/sessionMessageApiService.test.ts`, the test
"…executes chunk retrieval…" already asserts `assistantMsg.citations![0]`. Update
its type annotation and add an `originalFileName` expectation. The matching chunks
in that test set `sourceLabel: "Physics.pdf"` (lines ~794, ~807).

Replace the block at lines 863-869:

```ts
      const assistantMsg = result.assistantMessage as { citations?: Array<{ id: string; sourceId: string; referenceText: string; originalFileName?: string }> };
      expect(assistantMsg.citations).toBeDefined();
      expect(assistantMsg.citations![0]).toMatchObject({
        id: "ck-1",
        sourceId: "file-A:ck-1",
        referenceText: expect.stringContaining("Newton"),
        originalFileName: "Physics.pdf",
      });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts -t "chunk"`
Expected: FAIL — `citations[0]` has no `originalFileName` property (currently undefined).

- [ ] **Step 3: Set `originalFileName` from the chunk's sourceLabel**

In `src/server/workspaces/sessionMessageApiService.ts`, replace the citation map at
lines 905-909:

```ts
  const citations = chunks.map((chunk) => ({
    id: chunk.chunkId,
    sourceId: `${chunk.fileId}:${chunk.chunkId}`,
    referenceText: chunk.text.length > 200 ? chunk.text.slice(0, 200) + "…" : chunk.text,
    originalFileName: chunk.sourceLabel?.trim() ? chunk.sourceLabel.trim() : undefined,
  }));
```

Do not change `id`, `sourceId`, `referenceText`, the `internalUpdate.retrieval`
block, or the decision-log event. `pageNumber` / `sectionLabel` are intentionally
not set here (v1).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts -t "chunk"`
Expected: PASS.

- [ ] **Step 5: Run the full server test file to confirm no C5D regression**

Run: `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts`
Expected: PASS (all existing C5D / no-whole-course / grounding tests still green).

- [ ] **Step 6: Commit**

```bash
git add src/server/workspaces/sessionMessageApiService.ts tests/server/workspaces/sessionMessageApiService.test.ts
git commit -m "feat: wire file name into chunk-derived source citations"
```

---

## Task 2: Add optional page/section fields to the citation type

**Files:**
- Modify: `src/types/index.ts:321-326`

- [ ] **Step 1: Extend `SourceCitation`**

Replace lines 321-326:

```ts
export interface SourceCitation {
  id: string;
  referenceText: string;
  sourceId: string;
  originalFileName?: string;
  pageNumber?: number;    // render only if present and > 0
  sectionLabel?: string;  // question/section label; render only if non-empty
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (additive optional fields break nothing).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add optional page/section fields to SourceCitation"
```

---

## Task 3: Rewrite SourcesSection as a compact Hebrew citation line

**Files:**
- Modify: `src/components/tutor/TutorConversation.tsx:1023-1063` (`SourcesSection`), `:1086-1089` (`formatSourceLabel`)
- Test: `tests/components/tutor/TutorConversation.test.tsx:276-333`

- [ ] **Step 1: Update existing label tests to Hebrew and add new behavior tests**

In `tests/components/tutor/TutorConversation.test.tsx`, replace the two `describe`
blocks at lines 277-333 with the following. This updates the English-label
assertions (`Sources (1)` → `מקורות (1)`, `Source N` → `מקור N`) and adds page /
section / icon / no-ID coverage.

```tsx
describe("source rendering", () => {
  it("deduplicates identical citations and keeps distinct duplicates", () => {
    const result = normalizeCitations([
      { id: "chunk_0001", sourceId: "fileA:chunk_0001", referenceText: "same text" },
      { id: "chunk_0001", sourceId: "fileA:chunk_0001", referenceText: "same text" },
      { id: "chunk_0001", sourceId: "fileA:chunk_0001", referenceText: "different text" },
    ]);

    expect(result).toHaveLength(2);
    expect(new Set(result.map((item) => item.renderKey)).size).toBe(2);
  });

  it("renders sources in a collapsible Hebrew section (closed by default)", () => {
    const normalized = normalizeCitations([
      { id: "chunk_0001", sourceId: "fileA:chunk_0001", referenceText: "example snippet" },
    ]);

    const html = renderToStaticMarkup(<SourcesSection citations={normalized} />);
    expect(html).toContain("<details");
    expect(html).toContain("מקורות (1)");
    expect(html).not.toContain("<details open");
  });

  it("renders the file name and excerpt for a file-backed citation", () => {
    const normalized = normalizeCitations([
      {
        id: "chunk_0001",
        sourceId: "fileA:chunk_0001",
        referenceText: "Newton second law",
        originalFileName: "Physics.pdf",
      },
    ]);

    const html = renderToStaticMarkup(<SourcesSection citations={normalized} />);
    expect(html).toContain("Physics.pdf");
    expect(html).toContain("Newton second law");
    expect(html).toContain("📄");
  });

  it("renders page and section only when present", () => {
    const normalized = normalizeCitations([
      {
        id: "chunk_0001",
        sourceId: "fileA:chunk_0001",
        referenceText: "text",
        originalFileName: "Physics.pdf",
        pageNumber: 3,
        sectionLabel: "שאלה 2",
      },
    ]);

    const html = renderToStaticMarkup(<SourcesSection citations={normalized} />);
    expect(html).toContain("עמ׳ 3");
    expect(html).toContain("שאלה 2");
  });

  it("omits page when pageNumber is absent or not positive", () => {
    const normalized = normalizeCitations([
      {
        id: "chunk_0001",
        sourceId: "fileA:chunk_0001",
        referenceText: "text",
        originalFileName: "Physics.pdf",
        pageNumber: 0,
      },
    ]);

    const html = renderToStaticMarkup(<SourcesSection citations={normalized} />);
    expect(html).not.toContain("עמ׳");
  });

  it("never renders raw sourceId / chunk IDs", () => {
    const normalized = normalizeCitations([
      { id: "chunk_0001", sourceId: "abc-123-def:chunk_0001", referenceText: "text" },
    ]);

    const html = renderToStaticMarkup(<SourcesSection citations={normalized} />);
    expect(html).not.toContain("abc-123-def");
    expect(html).not.toContain("chunk_0001");
    expect(html).not.toContain("abc-123-def:chunk_0001");
  });
});

describe("source label formatting", () => {
  it("shows ordinal מקור N when originalFileName is absent", () => {
    const result = normalizeCitations([
      { id: "chunk_0001", sourceId: "fileA:chunk_0001", referenceText: "some text" },
      { id: "chunk_0002", sourceId: "fileB:chunk_0002", referenceText: "other text" },
    ]);
    expect(result[0].sourceLabel).toBe("מקור 1");
    expect(result[1].sourceLabel).toBe("מקור 2");
  });

  it("shows originalFileName when provided", () => {
    const result = normalizeCitations([
      {
        id: "chunk_0001",
        sourceId: "fileA:chunk_0001",
        referenceText: "some text",
        originalFileName: "lecture-notes.pdf",
      },
    ]);
    expect(result[0].sourceLabel).toBe("lecture-notes.pdf");
  });

  it("does not show raw UUID-style IDs in source labels", () => {
    const result = normalizeCitations([
      { id: "chunk_0001", sourceId: "abc-123-def:chunk_0001", referenceText: "text" },
    ]);
    expect(result[0].sourceLabel).not.toContain("abc-123-def");
    expect(result[0].sourceLabel).not.toContain("chunk_0001");
    expect(result[0].sourceLabel).toBe("מקור 1");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/tutor/TutorConversation.test.tsx -t "source"`
Expected: FAIL — current output says `Sources (1)` / `Source 1`, no `📄`, no `עמ׳`.

- [ ] **Step 3: Rewrite `formatSourceLabel` to a Hebrew fallback**

In `src/components/tutor/TutorConversation.tsx`, replace lines 1086-1089:

```tsx
function formatSourceLabel(citation: SourceCitation, index: number): string {
  if (citation.originalFileName?.trim()) return citation.originalFileName.trim();
  return `מקור ${index + 1}`;
}
```

- [ ] **Step 4: Rewrite `SourcesSection` to the compact line layout**

Replace `SourcesSection` at lines 1023-1063:

```tsx
export function SourcesSection({ citations }: { citations: NormalizedCitation[] }) {
  return (
    <details className="group">
      <summary
        className="cursor-pointer select-none text-[11px] font-semibold tracking-wide"
        style={{ color: "var(--tutor-text-muted)" }}
        dir="rtl"
      >
        מקורות ({citations.length})
      </summary>
      <div className="mt-2 space-y-2">
        {citations.map((cite) => {
          const hasFileName = Boolean(cite.originalFileName?.trim());
          const hasPage = typeof cite.pageNumber === "number" && cite.pageNumber > 0;
          const hasSection = Boolean(cite.sectionLabel?.trim());
          return (
            <div
              key={cite.renderKey}
              className="text-[11px] px-3 py-2.5 rounded-xl space-y-1"
              style={{
                background: "var(--tutor-bg-elevated)",
                border: "1px solid var(--tutor-border-subtle)",
                color: "var(--tutor-text-secondary)",
              }}
              dir="rtl"
            >
              <div
                className="text-[11px] font-medium flex items-center gap-1.5 flex-wrap"
                style={{ color: "var(--tutor-text-secondary)" }}
              >
                {hasFileName && <span aria-hidden>📄</span>}
                <span>{cite.sourceLabel}</span>
                {hasPage && (
                  <span style={{ color: "var(--tutor-text-muted)" }}>· עמ׳ {cite.pageNumber}</span>
                )}
                {hasSection && (
                  <span style={{ color: "var(--tutor-text-muted)" }}>· {cite.sectionLabel!.trim()}</span>
                )}
              </div>
              <div
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                &ldquo;{cite.referenceText}&rdquo;
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
```

- [ ] **Step 5: Run the component tests to verify they pass**

Run: `npx vitest run tests/components/tutor/TutorConversation.test.tsx -t "source"`
Expected: PASS.

- [ ] **Step 6: Run the full component test file**

Run: `npx vitest run tests/components/tutor/TutorConversation.test.tsx`
Expected: PASS (no other assertions depended on the old English labels).

- [ ] **Step 7: Commit**

```bash
git add src/components/tutor/TutorConversation.tsx tests/components/tutor/TutorConversation.test.tsx
git commit -m "feat: compact Hebrew source cards with honest page/section display"
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all suites green, including C5D grounding / no-whole-course tests.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke (per repo protocol)**

Start the app with emulators (`Start Tutor.command` or `npm run dev`), open a
session with a ready course file selected, ask a question that retrieves chunks,
and confirm in the rendered sources:
- header reads `מקורות (N)`
- each card shows `📄 <filename>` and a quoted excerpt
- no `fileId:chunkId` / raw ID text appears
- with no page metadata, no `עמ׳` is shown (honest omission)

Capture a screenshot of the sources card as evidence.

- [ ] **Step 5: Append to the agent sync log**

Add an entry to `agent-memory/DUAL_AGENT_SYNC_LOG.md` summarizing Sources UI v1
(files changed, tests, smoke result), then commit:

```bash
git add agent-memory/DUAL_AGENT_SYNC_LOG.md
git commit -m "docs: log Sources UI v1 completion"
```

---

## Self-Review

**Spec coverage:**
- "Show file name" → Task 1 (server wires `originalFileName`) + Task 3 (renders it).
- "Show short excerpt" → Task 3 (clamped `referenceText`, already present, kept).
- "Show page when available" → Task 2 (type field) + Task 3 (`עמ׳ N` when `> 0`).
- "Show question/section when available" → Task 2 + Task 3 (`sectionLabel` when non-empty).
- "Remove raw IDs" → Task 3 render never emits `sourceId`/`id`; test asserts it.
- "Academic-citation feel / readable" → Task 3 compact line layout, Hebrew header.
- "Honest when metadata missing" → Task 3 omits page/section; `מקור N` fallback; no icon without filename.
- "No grounding/retrieval regression (C5D)" → Task 1 leaves scope/grounding/decision-log untouched; Tasks 1 & 4 re-run the full server suite.

**Placeholder scan:** none — every code/test step shows full content and exact commands.

**Type consistency:** `pageNumber: number` and `sectionLabel: string` defined in Task 2 are used identically in Task 3 (`cite.pageNumber > 0`, `cite.sectionLabel?.trim()`). `originalFileName` (existing field) set in Task 1, read in Task 3. `formatSourceLabel(citation, index)` signature unchanged; only its fallback string changes. `NormalizedCitation` spreads `...cite`, so `pageNumber`/`sectionLabel` flow to the render without a separate interface change.
