# Semantic/Vector Retrieval Architecture Decision

## 1. Current state
privateTutor currently supports:
- File upload metadata + Storage path linkage.
- Extraction lifecycle boundary (`extractionStatus`) with placeholder extraction source.
- Chunking lifecycle boundary (`chunkingStatus`) with persisted deterministic chunks.
- Deterministic keyword retrieval over chunk text using token overlap scoring.
- Grounding context injection into provider prompt from retrieved chunks.
- Cost-mode and work-mode guardrails for retrieval scope and budgets.

Current retrieval behavior is keyword-based only. There are no embeddings, no vector index, and no semantic ranking.

## 2. Problem
Keyword overlap retrieval is predictable and simple, but weak for paraphrases, synonyms, and cross-language variation. As parser quality improves, chunk content quality will improve, and retrieval quality will become the next limiting factor.

The project needs a semantic retrieval architecture that:
- preserves current deterministic fallback,
- keeps costs controlled,
- stays compatible with Firebase/Firestore-first MVP constraints,
- avoids locking into an irreversible vector infrastructure decision too early.

## 3. Constraints
- No runtime retrieval behavior changes in this step.
- No parser changes in this step.
- Firebase/Firestore is the current data backbone.
- MVP remains controlled/personal testing, not production-scale deployment.
- Hebrew/English academic material must be supported.
- Existing keyword retrieval fallback must remain available.
- Future parser metadata may become richer; design should not assume final parser shape now.

## 4. Options considered

### Option A — Firestore-only embedding arrays on chunk docs
Pros:
- minimal infrastructure change
- simple data locality

Cons:
- poor fit for scalable nearest-neighbor similarity
- heavy document payload growth and read costs
- hard to optimize later without migration pressure

### Option B — External vector database first
Pros:
- strong semantic retrieval capabilities
- operationally mature query patterns

Cons:
- introduces immediate ops and vendor commitment
- increases complexity before lifecycle boundary is stabilized
- higher cost/risk for MVP stage

### Option C — Local/dev in-memory vector index
Pros:
- easy experimentation

Cons:
- not durable
- not multi-session safe
- not appropriate as foundation for real lifecycle

### Option D — Staged hybrid (recommended)
Pros:
- implement embedding lifecycle and provider interface first
- persist provider-neutral embedding records under current Firestore ownership model
- keep semantic retrieval behind interface and disabled until execution phase
- preserve keyword fallback as reliable baseline
- defer vector DB commitment until quality/cost evidence exists

Cons:
- two-step delivery (lifecycle first, retrieval execution second)

## 5. Recommended approach
Recommend **Option D (staged hybrid)**.

Decision:
1. Next coding phase adds embedding lifecycle boundary and provider interface only.
2. Persist embeddings in provider-neutral Firestore records scoped by user/workspace/file/chunk.
3. Keep semantic retrieval execution disabled until a dedicated follow-up phase.
4. When enabled later, run hybrid retrieval: semantic candidates + keyword fallback/reranking.
5. Defer external vector DB decision until real parser output and retrieval quality metrics are available.

## 6. Embedding lifecycle
Add chunk-level embedding lifecycle metadata (planned fields):
- `embeddingStatus`: `not_started | pending | completed | failed | stale`
- `embeddingProvider`: string
- `embeddingModel`: string
- `embeddingDimension`: number
- `embeddingUpdatedAt`: timestamp
- `embeddingErrorCode`: string | null
- `embeddingSourceTextHash`: string

Lifecycle rules:
- On chunk creation/replacement: initialize `embeddingStatus=not_started`.
- On embedding run start: `pending`.
- On success: store vector + metadata, set `completed`.
- On provider error: set `failed` with `embeddingErrorCode`.
- Mark `stale` when chunk text hash changes (re-extraction/re-chunking).
- File deletion must cascade delete chunk embeddings.
- Retry policy in boundary phase: manual/endpoint-triggered retry from `failed|stale|not_started`.

Staleness triggers:
- re-extraction changed `extractedText`
- re-chunking replaced chunk set
- embedding model/provider migration policy marks older vectors stale

## 7. Storage strategy
Recommended neutral storage path:
- `users/{userId}/workspaces/{workspaceId}/files/{fileId}/chunks/{chunkId}/embedding/current`

Why subdocument (not inline array on chunk doc):
- isolates large vector payload from core chunk reads
- lowers risk of chunk doc bloat and future document-size pressure
- cleaner lifecycle updates and migration metadata
- easier future mirror/sync to external vector DB

Future migration compatibility:
- keep Firestore embedding record as source-of-truth metadata
- external vector DB (if adopted) can mirror by deterministic key `{userId}/{workspaceId}/{fileId}/{chunkId}`

## 8. Retrieval strategy (future execution phase)
Introduce interfaces (design target):
- `SemanticChunkRetrievalProvider`
- `SemanticRetrievalInput`
- `SemanticRetrievalResult`
- `HybridRetrievalResult`

Planned flow:
1. Boundary decision decides retrieval needed/scope/budget (existing mechanism retained).
2. Semantic provider retrieves top-K candidate chunks (when semantic enabled).
3. Apply hybrid merge with keyword candidates:
   - semantic-first candidate set
   - keyword overlap as fallback and tie-break/rerank signal
4. Enforce final caps: `maxChunks`, `maxTokens` from cost/work-mode guardrails.
5. Preserve source citations using existing `fileId:chunkId` format.
6. Emit decision-log events for semantic requested/executed/skipped/fallback.

Normalization policy (planned):
- normalize semantic scores to 0..1
- combine with keyword score via weighted formula
- default weight conservative (semantic dominant, keyword stabilizer)

## 9. Cost-mode behavior
Semantic retrieval must obey current cost strategy, not bypass it.

Planned behavior:
- `Cheap Practice`: semantic optional/off by default, tiny candidate set, strict caps.
- `Normal Learning`: moderate candidate set and token cap.
- `Deep Research`: larger candidate set and token cap.

Embedding generation cost policy:
- do not auto-embed all chunks on every change in cheap mode
- permit manual/explicit embedding runs first
- allow batched embedding later behind rate/cost guardrails

## 10. Failure and fallback behavior
- If semantic retrieval unavailable or failed, automatically fallback to current keyword retrieval path.
- If embeddings missing/stale, retrieval should continue with keyword mode (no hard failure of tutor turn).
- If semantic provider returns low-confidence/empty results, blend with keyword candidates.
- Decision log should make fallback explicit for observability.

## 11. Migration path
Phase sequence:
1. **Step 24 — Embedding lifecycle boundary**
   - add embedding lifecycle fields
   - add provider interface
   - deterministic/mock embedding provider
   - endpoint to create embeddings for chunks
   - no semantic retrieval execution yet

2. **Step 25 — Semantic retrieval execution**
   - semantic retrieval provider integration behind interface
   - hybrid merge with keyword retrieval
   - keep existing citations/grounding flow
   - preserve fallback keyword behavior

3. **Later (optional) — External vector DB adoption**
   - evaluate only after quality/cost telemetry
   - add mirrored index writer and query adapter

## 12. Next implementation phases
### Step 24 (recommended next coding phase): Embedding Lifecycle Boundary
In scope:
- data model fields for chunk embedding lifecycle
- Firestore embedding subdocument repository
- provider-neutral interface + deterministic mock provider
- endpoint to trigger embedding generation for file chunks
- tests for status transitions, stale handling, ownership boundaries

Out of scope:
- semantic retrieval execution
- answer-grounding behavior changes

### Step 25: Semantic Retrieval Execution
In scope:
- semantic provider adapter
- hybrid rank/merge with keyword fallback
- budget-aware final selection integrated with existing retrieval boundary
- decision-log coverage

Out of scope:
- parser rewrite
- Gemini/Genkit migration unless separately approved

## 13. Risks
- Firestore-only vector storage may become expensive at larger scale.
- Embedding model choice can affect Hebrew/English balance.
- Hybrid scoring can overfit if weights are not calibrated with real usage.
- If parser quality remains low, semantic retrieval gains will be limited.

## 14. Explicit non-goals
This step does **not**:
- implement embeddings
- implement vector DB
- change runtime retrieval execution
- modify parser/extraction behavior
- change provider grounding prompt behavior
- change UI behavior
