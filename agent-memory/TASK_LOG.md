# Task Log

## Recent tasks

### Step 25 — Semantic retrieval execution
- Branch: `codex/phase25-semantic-retrieval-execution`
- Status: completed on branch
- Result:
  - Added semantic retrieval service over existing deterministic/mock embeddings.
  - Added cosine similarity ranking and safe tie-breakers.
  - Added hybrid semantic-first flow with keyword fallback.
  - Preserved existing grounding and citation behavior.
  - Added focused semantic + regression tests.
- Notes:
  - No real embedding provider or vector DB added.
  - Retrieval remains cost-bound and policy-bound through existing flow.

### Step 24 — Embedding lifecycle boundary
- PR: #56
- Status: merged

### Phase 21 — Real parser foundation
- PR: #55
- Status: merged
