# Current Task

## Active task
Step 23 — Semantic/Vector retrieval architecture decision.

## Status
Completed on branch `codex/phase23-semantic-retrieval-decision`.

## What was implemented
- Added architecture decision document:
  - `docs/SEMANTIC_RETRIEVAL_DECISION.md`
- Document defines:
  - options analysis (Firestore-only vs external vector DB vs local index vs staged hybrid)
  - recommended staged hybrid approach
  - chunk embedding lifecycle design (`not_started|pending|completed|failed|stale`)
  - provider-neutral storage strategy and migration path
  - hybrid semantic+keyword retrieval strategy with fallback
  - cost-mode behavior and failure policy
  - next phases (Step 24 and Step 25)

## Explicit boundaries preserved
- No runtime retrieval changes.
- No embeddings implemented.
- No vector DB code.
- No parser/extraction/provider prompt changes.
- No package/Firebase rules/config changes.

## Validation executed
- `git diff --check` ✅
- `npm run build` ✅

## Recommended next phase
Step 24 — Embedding Lifecycle Boundary (data model + provider interface + deterministic/mock embedding flow; no semantic execution yet).
