# Task Log

## Recent tasks

### Step 23 — Semantic/Vector retrieval architecture decision
- Branch: `codex/phase23-semantic-retrieval-decision`
- Status: completed on branch
- Result:
  - Added `docs/SEMANTIC_RETRIEVAL_DECISION.md`
  - Recommended staged hybrid architecture (embedding lifecycle first, semantic execution second)
  - Defined embedding lifecycle fields/statuses and stale rules
  - Defined Firestore-neutral embedding storage strategy and migration path
  - Defined hybrid semantic+keyword retrieval approach with fallback and cost-mode behavior
- Notes:
  - Planning-only scope. No runtime behavior changed.
  - No embeddings/vector DB/semantic execution implemented.

### Phase 20 — MVP validation and behavior regression
- Branch: `codex/phase20-mvp-validation`
- PR: #53
- Status: merged

### Phase 19 — Grounded tutor answer
- Branch: `codex/phase19-grounded-tutor-answer`
- PR: #52
- Status: merged
