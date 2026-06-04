# Structural Retrieval v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route retrieval to the right part of the active file when the learner refers to `שאלה N` / `סעיף <letter>` / `עמוד N`, using semantic search only when structural matching fails.

**Architecture:** A new `structuralRetrievalService.ts` parses structural references and resolves them to chunk IDs via document artifacts (`DetectedQuestionArtifact` and `DocumentPageArtifact`, both of which carry `sourceChunkIds`). `executeRetrievalForTutorResponse` gains an additive structural pre-step: on a positive match it fetches those exact chunks and runs them through the existing `executeChunkRetrieval` path (so citations/grounding/decision-log are identical); on no match it falls through to the existing semantic/keyword retrieval, unchanged. This keeps the C5D contracts intact.

**Tech Stack:** Next.js, TypeScript, Vitest. Firestore-backed repositories are injected, so the resolver is unit-testable without Firestore.

**Spec:** `docs/superpowers/specs/2026-06-04-structural-retrieval-v1-design.md`

---

## File Structure

- `src/server/workspaces/structuralRetrievalService.ts` — NEW. Owns reference parsing + artifact→chunkId resolution. Also becomes the new home for the parsing helpers moved out of `sessionMessageApiService.ts`.
- `src/server/workspaces/sessionMessageApiService.ts` — MODIFY. Import parsers from the new module (refactor); add the structural pre-step in `executeRetrievalForTutorResponse`; populate citation `pageNumber`/`sectionLabel` for structural matches.
- `src/server/workspaces/fileChunkRetrievalService.ts` — MODIFY (1 line). Add `"structural"` to the `RetrievedFileChunk.retrievalMethod` union.
- `tests/server/workspaces/structuralRetrievalService.test.ts` — NEW. Unit tests for the resolver.
- `tests/server/workspaces/sessionMessageApiService.test.ts` — MODIFY. Integration tests for routing + fallback + C5D regression.

---

## Task 1: Structural resolver module (parsing + artifact→chunk resolution)

**Files:**
- Create: `src/server/workspaces/structuralRetrievalService.ts`
- Modify: `src/server/workspaces/sessionMessageApiService.ts` (move parsers out, re-import)
- Test: `tests/server/workspaces/structuralRetrievalService.test.ts`

### Context for the implementer

The parsing helpers currently live in `src/server/workspaces/sessionMessageApiService.ts`:
- `extractRequestedPages(message: string): number[]` — matches `עמוד\s+(\d+)`.
- `extractArtifactGroundingSignals(message: string): ArtifactGroundingSignal[]` — matches `(?:שאלה|תרגיל|סעיף|מקטע|question|exercise|problem)\s+(\d+)` → `{number}` and `(?:סעיף|מקטע)\s+([א-ת])[׳'"]?` → `{letter}`.
- `matchesArtifactGroundingSignals(label, signals): boolean`.
- `normalizeHebrewGroundingLetter(...)` (helper used by the above).
- `type ArtifactGroundingSignal` (shape: `{ number?: string; letter?: string }`).

Read those exact current definitions before moving them so you preserve their behavior verbatim. They are used by `maybeBuildArtifactAwareGroundingInstruction` in the same file — after moving, import them back there.

The artifact types (in `src/types/index.ts`) you resolve against:
- `DetectedQuestionArtifact { questionId; fileId; label; questionNumber?; pageStart?; pageEnd?; charStart; charEnd; sourceChunkIds: string[]; subsections: DetectedQuestionSubsection[]; ... }`
- `DetectedQuestionSubsection { label; charStart; charEnd; sourceChunkIds: string[]; ... }`
- `DocumentPageArtifact { pageId; fileId; pageNumber; sourceChunkIds: string[]; ... }`

Repository reads (signatures, already used in `sessionMessageApiService.ts`):
- `listDetectedQuestions(userId: string, fileId: string): Promise<DetectedQuestionArtifact[]>`
- `listDocumentPages(userId: string, fileId: string): Promise<DocumentPageArtifact[]>`

- [ ] **Step 1: Write the failing unit tests**

Create `tests/server/workspaces/structuralRetrievalService.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { resolveStructuralChunkTargets } from "../../../src/server/workspaces/structuralRetrievalService";
import type { DetectedQuestionArtifact, DocumentPageArtifact } from "../../../src/types";

function question(over: Partial<DetectedQuestionArtifact>): DetectedQuestionArtifact {
  return {
    questionId: "q",
    fileId: "file-A",
    label: "שאלה 2",
    questionNumber: 2,
    charStart: 0,
    charEnd: 10,
    sourceChunkIds: ["q2-c1", "q2-c2"],
    subsections: [],
    confidence: 1,
    ...over,
  };
}

function page(over: Partial<DocumentPageArtifact>): DocumentPageArtifact {
  return {
    pageId: "p",
    fileId: "file-A",
    pageNumber: 3,
    extractedText: "",
    textQuality: "good",
    charCount: 0,
    sourceChunkIds: ["p3-c1"],
    ...over,
  };
}

function makeDeps(over: Partial<{
  questions: DetectedQuestionArtifact[];
  pages: DocumentPageArtifact[];
}> = {}) {
  return {
    listDetectedQuestions: vi.fn(async () => over.questions ?? []),
    listDocumentPages: vi.fn(async () => over.pages ?? []),
  };
}

describe("resolveStructuralChunkTargets", () => {
  it("returns [] when the message has no structural signal", async () => {
    const deps = makeDeps({ questions: [question({})] });
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "מה הרעיון המרכזי?");
    expect(result).toEqual([]);
    expect(deps.listDetectedQuestions).not.toHaveBeenCalled();
  });

  it("routes 'שאלה 2' to that question's chunks", async () => {
    const deps = makeDeps({ questions: [question({ sourceChunkIds: ["q2-c1", "q2-c2"] })] });
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "תפתור את שאלה 2");
    expect(result).toEqual([
      { fileId: "file-A", chunkIds: ["q2-c1", "q2-c2"], matchKind: "question", matchLabel: "שאלה 2" },
    ]);
  });

  it("routes 'תרגיל 2' and 'exercise 2' to the same question", async () => {
    const deps = makeDeps({ questions: [question({})] });
    const a = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "תרגיל 2");
    const b = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "solve exercise 2");
    expect(a[0]?.chunkIds).toEqual(["q2-c1", "q2-c2"]);
    expect(b[0]?.chunkIds).toEqual(["q2-c1", "q2-c2"]);
  });

  it("routes 'עמוד 3' to that page's chunks", async () => {
    const deps = makeDeps({ pages: [page({ pageNumber: 3, sourceChunkIds: ["p3-c1"] })] });
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "מה כתוב בעמוד 3?");
    expect(result).toEqual([
      { fileId: "file-A", chunkIds: ["p3-c1"], matchKind: "page", matchLabel: "עמוד 3" },
    ]);
  });

  it("routes 'שאלה 2 סעיף ב' to the subsection's chunks", async () => {
    const deps = makeDeps({
      questions: [
        question({
          subsections: [
            { label: "סעיף א", charStart: 0, charEnd: 1, sourceChunkIds: ["q2-a"] },
            { label: "סעיף ב", charStart: 2, charEnd: 3, sourceChunkIds: ["q2-b"] },
          ],
        }),
      ],
    });
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "תסביר שאלה 2 סעיף ב");
    expect(result[0]?.matchKind).toBe("subsection");
    expect(result[0]?.chunkIds).toEqual(["q2-b"]);
  });

  it("returns [] when a signal is present but no artifact matches", async () => {
    const deps = makeDeps({ questions: [question({ questionNumber: 2, label: "שאלה 2" })] });
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A"], "תפתור את שאלה 9");
    expect(result).toEqual([]);
  });

  it("first active file with a match wins", async () => {
    const deps = {
      listDetectedQuestions: vi.fn(async (_u: string, fileId: string) =>
        fileId === "file-B" ? [question({ fileId: "file-B", sourceChunkIds: ["B-q2"] })] : []
      ),
      listDocumentPages: vi.fn(async () => []),
    };
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A", "file-B"], "שאלה 2");
    expect(result).toEqual([
      { fileId: "file-B", chunkIds: ["B-q2"], matchKind: "question", matchLabel: "שאלה 2" },
    ]);
  });

  it("skips a file whose artifact read throws, does not reject", async () => {
    const deps = {
      listDetectedQuestions: vi.fn(async (_u: string, fileId: string) => {
        if (fileId === "file-A") throw new Error("boom");
        return [question({ fileId: "file-B", sourceChunkIds: ["B-q2"] })];
      }),
      listDocumentPages: vi.fn(async () => []),
    };
    const result = await resolveStructuralChunkTargets(deps, "u", ["file-A", "file-B"], "שאלה 2");
    expect(result[0]?.fileId).toBe("file-B");
  });

  it("returns [] when there are no active files", async () => {
    const deps = makeDeps({ questions: [question({})] });
    const result = await resolveStructuralChunkTargets(deps, "u", [], "שאלה 2");
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/server/workspaces/structuralRetrievalService.test.ts`
Expected: FAIL — module `structuralRetrievalService` does not exist yet.

- [ ] **Step 3: Create the module (move parsers in, implement resolver)**

Create `src/server/workspaces/structuralRetrievalService.ts`. First, MOVE these from `sessionMessageApiService.ts` verbatim (copy their current bodies exactly): `ArtifactGroundingSignal` (type), `normalizeHebrewGroundingLetter`, `extractRequestedPages`, `extractArtifactGroundingSignals`, `matchesArtifactGroundingSignals`. Export all five. Then add the resolver below.

```ts
import type { DetectedQuestionArtifact, DocumentPageArtifact } from "../../types";

// ── moved verbatim from sessionMessageApiService.ts ──
export interface ArtifactGroundingSignal {
  number?: string;
  letter?: string;
}

// (paste the exact current normalizeHebrewGroundingLetter body here and `export` it)
// (paste the exact current extractRequestedPages body here and `export` it)
// (paste the exact current extractArtifactGroundingSignals body here and `export` it)
// (paste the exact current matchesArtifactGroundingSignals body here and `export` it)

// ── new resolver ──
export interface StructuralRetrievalDeps {
  listDetectedQuestions: (userId: string, fileId: string) => Promise<DetectedQuestionArtifact[]>;
  listDocumentPages: (userId: string, fileId: string) => Promise<DocumentPageArtifact[]>;
}

export interface StructuralMatch {
  fileId: string;
  chunkIds: string[];
  matchKind: "page" | "question" | "subsection";
  matchLabel: string;
}

const HEBREW_LETTERS = "אבגדהוזחטיכלמנסעפצקרשת";

function extractSubsectionLetter(message: string): string | undefined {
  const m = message.match(new RegExp(`(?:סעיף|מקטע)\\s+([${HEBREW_LETTERS}])[׳'\"]?`));
  return m ? normalizeHebrewGroundingLetter(m[1]) : undefined;
}

export async function resolveStructuralChunkTargets(
  deps: StructuralRetrievalDeps,
  userId: string,
  fileIds: string[],
  userMessage: string
): Promise<StructuralMatch[]> {
  if (fileIds.length === 0) return [];

  const pageRefs = extractRequestedPages(userMessage);
  const signals = extractArtifactGroundingSignals(userMessage);
  const questionNumber = signals.find((s) => s.number)?.number;
  const subsectionLetter = extractSubsectionLetter(userMessage);

  if (pageRefs.length === 0 && !questionNumber && !subsectionLetter) {
    return [];
  }

  for (const fileId of fileIds) {
    // 1) question / subsection
    if (questionNumber || subsectionLetter) {
      let questions: DetectedQuestionArtifact[] = [];
      try {
        questions = await deps.listDetectedQuestions(userId, fileId);
      } catch {
        questions = [];
      }

      const matchedQuestion = questionNumber
        ? questions.find(
            (q) =>
              String(q.questionNumber ?? "") === questionNumber ||
              matchesArtifactGroundingSignals(q.label, [{ number: questionNumber }])
          )
        : undefined;

      if (subsectionLetter) {
        const searchIn = matchedQuestion ? [matchedQuestion] : questions;
        for (const q of searchIn) {
          const sub = q.subsections.find(
            (s) =>
              normalizeHebrewGroundingLetter(
                s.label.match(new RegExp(`[${HEBREW_LETTERS}]`))?.[0] ?? ""
              ) === subsectionLetter
          );
          if (sub && sub.sourceChunkIds.length > 0) {
            return [
              { fileId, chunkIds: dedupe(sub.sourceChunkIds), matchKind: "subsection", matchLabel: sub.label },
            ];
          }
        }
      }

      if (matchedQuestion && matchedQuestion.sourceChunkIds.length > 0) {
        return [
          {
            fileId,
            chunkIds: dedupe(matchedQuestion.sourceChunkIds),
            matchKind: "question",
            matchLabel: matchedQuestion.label,
          },
        ];
      }
    }

    // 2) page
    if (pageRefs.length > 0) {
      let pages: DocumentPageArtifact[] = [];
      try {
        pages = await deps.listDocumentPages(userId, fileId);
      } catch {
        pages = [];
      }
      const matchedPage = pages.find((p) => pageRefs.includes(p.pageNumber));
      if (matchedPage && matchedPage.sourceChunkIds.length > 0) {
        return [
          {
            fileId,
            chunkIds: dedupe(matchedPage.sourceChunkIds),
            matchKind: "page",
            matchLabel: `עמוד ${matchedPage.pageNumber}`,
          },
        ];
      }
    }
  }

  return [];
}

function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids));
}
```

Then in `sessionMessageApiService.ts`: delete the moved definitions and add an import:
```ts
import {
  extractRequestedPages,
  extractArtifactGroundingSignals,
  matchesArtifactGroundingSignals,
  resolveStructuralChunkTargets,
} from "./structuralRetrievalService";
import type { StructuralMatch } from "./structuralRetrievalService";
```
(Keep `normalizeHebrewGroundingLetter` import too if any remaining code there references it; otherwise it now lives only in the new module.)

- [ ] **Step 4: Run the resolver tests to verify they pass**

Run: `npx vitest run tests/server/workspaces/structuralRetrievalService.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Verify the grounding-hint path still compiles and passes**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts`
Expected: PASS (the moved parsers behave identically; the hint path is unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/server/workspaces/structuralRetrievalService.ts src/server/workspaces/sessionMessageApiService.ts tests/server/workspaces/structuralRetrievalService.test.ts
git commit -m "feat: structural reference resolver (refs to chunk IDs via artifacts)"
```

---

## Task 2: Wire structural pre-step into retrieval

**Files:**
- Modify: `src/server/workspaces/fileChunkRetrievalService.ts` (add `"structural"` to `retrievalMethod` union)
- Modify: `src/server/workspaces/sessionMessageApiService.ts` (`executeRetrievalForTutorResponse`; add `listFileChunks` to deps if not already present there; populate citation page/section for structural matches)
- Test: `tests/server/workspaces/sessionMessageApiService.test.ts`

### Context for the implementer

`executeRetrievalForTutorResponse` currently (around lines 674-735) computes `prioritizedFileIds`, then for non-web scope calls `repositories.retrieveFileChunks({ ..., prioritizedFileIds })` and routes the result through `executeChunkRetrieval(...)` (which builds citations from `chunk.sourceLabel` → `originalFileName`, sets `internalUpdate.retrieval`, and pushes a decision-log event). `RetrievedFileChunk` is defined in `fileChunkRetrievalService.ts` with fields `{ chunkId, fileId, workspaceId, text, chunkIndex, tokenEstimate, score, sourceLabel, retrievalMethod? }`. The repositories object already exposes `listUploadedFiles`, `listDocumentPages`, `listDetectedQuestions`; confirm whether it exposes `listFileChunks` — the file-chunk retrieval service uses it internally, but `Repositories` in `sessionMessageApiService.ts` may need it added (inject `defaultListFileChunks` the same way the others are injected). Read the `Repositories` interface and its default wiring (around lines 70-125) before editing.

The structural pre-step must run only for non-web scope, only when `prioritizedFileIds.length > 0`, and must short-circuit ONLY on a positive match.

- [ ] **Step 1: Add the integration tests (failing)**

Add to `tests/server/workspaces/sessionMessageApiService.test.ts` a new `describe("structural retrieval routing", ...)`. Use the existing test helpers in that file (`makeRepos`, `baseMessage`, `tutorResponse`, etc. — read how the existing chunk-retrieval test around line 780 builds `makeRepos` and an active-file scenario, and mirror it). The three tests:

```ts
describe("structural retrieval routing", () => {
  it("routes 'תפתור את שאלה 3' to that question's chunks without calling the semantic retriever when a file is active", async () => {
    // Arrange: one active attached file "file-A" that is understood, with a
    // DetectedQuestion labelled "שאלה 3" whose sourceChunkIds are ["q3-c1"],
    // and a file chunk "q3-c1" with text. Provide listDetectedQuestions,
    // listFileChunks, and a retrieveFileChunks spy.
    // Act: send userMessage "תפתור את שאלה 3" with attachedFileIds=["file-A"].
    // Assert:
    //   - retrieveFileChunks (semantic) was NOT called
    //   - result.internalUpdate.retrieval.why contains "structural"
    //   - citations are the question's chunk(s) and carry originalFileName
  });

  it("falls back to semantic retrieval when the structural reference matches no artifact", async () => {
    // Active file, but no DetectedQuestion matches "שאלה 99".
    // Assert retrieveFileChunks (semantic) WAS called.
  });

  it("does not route structurally and keeps the C5D clarification when no file is active", async () => {
    // No attachedFileIds. userMessage "תפתור את שאלה 3".
    // Assert: existing C5D clarification response (asks which material), no structural routing.
  });
});
```

Fill in each test body using the file's existing mocking patterns. The first test must assert the semantic `retrieveFileChunks` mock was not called (`expect(repos.retrieveFileChunks).not.toHaveBeenCalled()`), that `internalUpdate.retrieval.why` contains `"structural"`, and that `citations[0].originalFileName` is the file name.

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts -t "structural retrieval routing"`
Expected: FAIL — structural routing not wired yet (semantic retriever is called; `why` has no `"structural"`).

- [ ] **Step 3: Add `"structural"` to the retrievalMethod union**

In `src/server/workspaces/fileChunkRetrievalService.ts`, change:
```ts
  retrievalMethod?: "semantic" | "keyword_fallback" | "keyword_only";
```
to:
```ts
  retrievalMethod?: "semantic" | "keyword_fallback" | "keyword_only" | "structural";
```

- [ ] **Step 4: Implement the structural pre-step**

In `sessionMessageApiService.ts`, ensure `Repositories` includes `listFileChunks: typeof defaultListFileChunks` and wire its default (mirror the existing injected repos). Then, in `executeRetrievalForTutorResponse`, immediately AFTER the web-scope early return and BEFORE the `try { ... retrieveFileChunks ... }` block, insert:

```ts
  if (prioritizedFileIds.length > 0) {
    const structuralMatches = await resolveStructuralChunkTargets(
      { listDetectedQuestions: repositories.listDetectedQuestions, listDocumentPages: repositories.listDocumentPages },
      userId,
      prioritizedFileIds,
      userMessage
    );
    if (structuralMatches.length > 0) {
      const structuralChunks = await loadStructuralChunks(repositories, userId, workspaceId, structuralMatches);
      if (structuralChunks.length > 0) {
        return executeChunkRetrieval(
          tutorResponse,
          decision,
          { chunks: structuralChunks, eligibleFileCount: structuralMatches.length },
          Math.max(structuralChunks.length, 1),
          decision.max_tokens
        );
      }
    }
  }
```

Add the helper (near `executeChunkRetrieval`):

```ts
async function loadStructuralChunks(
  repositories: Repositories,
  userId: string,
  workspaceId: string,
  matches: StructuralMatch[]
): Promise<RetrievedFileChunk[]> {
  const out: RetrievedFileChunk[] = [];
  for (const match of matches) {
    let fileChunks: Awaited<ReturnType<typeof repositories.listFileChunks>> = [];
    try {
      fileChunks = await repositories.listFileChunks(userId, workspaceId, match.fileId);
    } catch {
      continue;
    }
    const file = (await safeListUploadedFiles(repositories, userId, workspaceId)).find(
      (f) => String(f.id) === match.fileId
    );
    const sourceLabel = String(file?.originalFileName ?? file?.name ?? match.fileId);
    const byId = new Map(fileChunks.map((c) => [c.chunkId, c]));
    for (const chunkId of match.chunkIds) {
      const c = byId.get(chunkId);
      if (!c) continue;
      out.push({
        chunkId: c.chunkId,
        fileId: match.fileId,
        workspaceId,
        text: c.text,
        chunkIndex: c.chunkIndex,
        tokenEstimate: c.tokenEstimate,
        score: 1,
        finalScore: 1,
        sourceLabel,
        retrievalMethod: "structural",
      });
    }
  }
  return out;
}

async function safeListUploadedFiles(
  repositories: Repositories,
  userId: string,
  workspaceId: string
) {
  try {
    return await repositories.listUploadedFiles(userId, workspaceId);
  } catch {
    return [];
  }
}
```

Then, so the structural citations also populate the Sources UI v1 page/section fields, set them in `executeChunkRetrieval` ONLY when the chunk came from a structural match. Simplest approach that avoids threading match metadata through: leave `executeChunkRetrieval` as-is for v1 (citations still get `originalFileName` + excerpt, which satisfies the done-criteria); populating `pageNumber`/`sectionLabel` from the match is a nice-to-have — if straightforward, pass the `StructuralMatch[]` into `executeChunkRetrieval` via an optional parameter and set `pageNumber`/`sectionLabel` on the matching citations; if it complicates the shared function, SKIP it and note as DONE_WITH_CONCERNS (fast-follow). Do not overbuild.

`internalUpdate.retrieval.why` for the structural path: `executeChunkRetrieval` derives `why` from `retrievalMethod`. Since chunks now have `retrievalMethod: "structural"`, update the `why` derivation in `executeChunkRetrieval` to include a structural branch, e.g.:
```ts
    why:
      retrievalMethod === "structural"
        ? `structural_retrieval_executed_${chunks.length}_file_chunks`
        : retrievalMethod === "semantic"
          ? `semantic_retrieval_executed_selected_${chunks.length}_file_chunks`
          : retrievalMethod === "keyword_fallback"
            ? `keyword_fallback_retrieval_executed_selected_${chunks.length}_file_chunks`
            : `retrieval_executed_selected_${chunks.length}_file_chunks`,
```

- [ ] **Step 5: Run the new integration tests to verify they pass**

Run: `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts -t "structural retrieval routing"`
Expected: PASS.

- [ ] **Step 6: Run the full server test file (C5D regression guard)**

Run: `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts`
Expected: PASS — all existing C5D / no-whole-course / grounding / chunk-retrieval tests stay green.

- [ ] **Step 7: Commit**

```bash
git add src/server/workspaces/sessionMessageApiService.ts src/server/workspaces/fileChunkRetrievalService.ts tests/server/workspaces/sessionMessageApiService.test.ts
git commit -m "feat: route retrieval by structural reference before semantic search"
```

---

## Task 3: Full verification + smoke + log

**Files:** `agent-memory/DUAL_AGENT_SYNC_LOG.md`

- [ ] **Step 1: Type-check** — Run: `npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 2: Full suite** — Run: `npx vitest run` — Expected: PASS (all green).
- [ ] **Step 3: Build** — Run: `npm run build` — Expected: succeeds.
- [ ] **Step 4: Manual smoke** — Start emulators + app. With an active, understood file that has a detected question, ask `תפתור את שאלה 3` (use a question number the file actually has) and confirm the answer is grounded in that question's content and its source card cites that file (and page/section if populated). Confirm a structural ref that matches nothing still answers via the normal path. Screenshot.
- [ ] **Step 5: Sync log** — Append a Structural Retrieval v1 entry to `agent-memory/DUAL_AGENT_SYNC_LOG.md` (files, tests, smoke result, fast-follow notes: relative refs, optional citation page/section), then:
```bash
git add agent-memory/DUAL_AGENT_SYNC_LOG.md
git commit -m "docs: log Structural Retrieval v1 completion"
```

---

## Self-Review

**Spec coverage:**
- "route שאלה/סעיף/עמוד to the right area" → Task 1 resolver + Task 2 wiring.
- "semantic only after structural fails" → Task 2 short-circuit only on positive match; else unchanged semantic path; integration test asserts semantic not called on match and called on miss.
- "תפתור את שאלה 3 works when file active" → Task 2 test 1.
- "missing metadata falls back safely" → resolver returns [] on no match / error / no artifacts (Task 1 tests) → semantic fallback; no-active-file → C5D clarification (Task 2 test 3).
- "covered by tests" → Task 1 unit tests + Task 2 integration tests.
- "structural citations carry file name" → `loadStructuralChunks` sets `sourceLabel`; `executeChunkRetrieval` maps it to `originalFileName` (Sources UI v1).
- C5D stability → structural step gated on `prioritizedFileIds.length > 0` and positive match; existing semantic/clarification paths unchanged; full-file regression run in Task 2 step 6 and Task 3.

**Placeholder scan:** Task 1 has full resolver code and full test code. Task 2 leaves the integration test BODIES to be filled from the file's existing mocking patterns (the assertions are specified exactly) because they depend on in-file helpers (`makeRepos`) that the implementer must read — this is intentional, not a placeholder; the implementer has the exact assertions and the helper location. The optional citation page/section population is explicitly marked skip-if-complex (YAGNI), not a vague TODO.

**Type consistency:** `StructuralMatch` (Task 1) is consumed by `loadStructuralChunks` (Task 2). `resolveStructuralChunkTargets` signature matches between definition and call site. `retrievalMethod: "structural"` added to the union (Task 2 step 3) before it is assigned (step 4). `StructuralRetrievalDeps` fields (`listDetectedQuestions`, `listDocumentPages`) match the `Repositories` members passed at the call site.
