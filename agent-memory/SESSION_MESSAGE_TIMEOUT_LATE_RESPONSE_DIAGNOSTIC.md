# Session Message Timeout / Late Response Diagnostic

## 1. Branch and HEAD
- Branch: `repair/deep-pdf-tutor-state-behavior`
- HEAD: `0316223 fix: improve tutor behavior for Deep PDF states`

---

## Root cause

**The client hard-aborts POST `/messages` after 8 seconds. The backend pipeline can take longer than 8 seconds, especially with artifact-aware grounding. After the abort, a 4-poll recovery window (8 more seconds) runs. If the backend finishes after the 16-second recovery window, the answer is persisted in Firestore but the UI shows a timeout error and the user has to reload to see it.**

The scenario that produces the observed symptom:

```
t=0s    Client POSTs /api/sessions/{id}/messages
t=0–8s  Backend: auth → Firestore reads → user message persisted → LLM call 1 → retrieval → Firestore reads (artifacts) → LLM call 2 (grounded)
t=8s    Client AbortController fires → throws SessionMessagesApiError 503
t=8s    handleSubmit catch: isTimeoutError → setComposerNotice("עדיין מעבד...")
t=8s    recoverAfterTimeout: starts polling fetchSessionMessages
t=8–16s Recovery polls every 2s × 4 attempts — backend still running
t=16s   Recovery fails (null) → setComposerNotice("לא הגיב בזמן. נסה שוב.")
t=17+s  Backend finishes: assistant persisted to Firestore
        (User sees error; answer is in Firestore but UI didn't receive it)
```

When the user later navigates away and back, `fetchSessionMessages` loads the persisted answer — so the answer "appears."

---

## Timeout location

**File:** `src/lib/sessions/sessionMessagesApiClient.ts:4`

```ts
const REQUEST_TIMEOUT_MS = 8000;  // 8 seconds
```

Applied in `runMessagesRequest` via `AbortController.setTimeout`. Applies to ALL requests: GET and POST messages.

**Comparison:** `workspaceFilesApiClient.ts` uses `REQUEST_TIMEOUT_MS = 15000` (15s) — nearly double, despite the file pipeline being simpler per-request.

---

## Late response behavior

### Backend after client abort
The HTTP connection is closed from the client side, but **Next.js/Node.js server does not automatically cancel in-flight async work** when the client disconnects. The backend continues:
1. Making the DeepSeek LLM call(s)
2. Building artifact-aware grounding context (Firestore reads)
3. Appending the assistant message to Firestore
4. Persisting decision log entries

This is confirmed by the observation that the answer appears after reload.

### Recovery mechanism
`recoverAfterTimeout` in `TutorConversation.tsx`:
- 4 attempts × 2-second intervals = **8-second recovery window**
- Polls `fetchSessionMessages` → checks `hasNewAssistantMessage(loaded, baselineMessageIds)`
- `hasNewAssistantMessage`: looks for any `role === "tutor"` message not in `baselineMessageIds` at submission time

**Total effective window: 8s initial + 8s recovery = 16 seconds.**

If the backend finishes within 16 seconds, the recovery succeeds and the UI silently shows the answer. If it takes longer, the UI shows the error.

### Why Deep PDF / grounded responses are more likely to exceed 16 seconds

The grounded message pipeline has grown:

| Step | Added latency |
|---|---|
| Workspace + session load | ~50ms |
| Append user message to Firestore | ~100ms |
| `getMockTutorResponse` → DeepSeek LLM call 1 | **2–8+ seconds** |
| Retrieval decision + `listFileChunks` | ~100–500ms |
| `buildArtifactAwareGroundingContext` → `listUploadedFiles` + `listDocumentPages` + `getDocumentOutline` + `listDetectedQuestions` (all Firestore reads) | ~200–600ms |
| `getMockTutorResponse` → DeepSeek LLM call 2 (grounded) | **2–8+ seconds** |
| `processMemoryCandidate` | ~200ms |
| `appendMessage` (assistant) | ~100ms |
| `persistDecisionLogEvents` | ~100ms |

**Best case with two LLM calls: ~6–8 seconds (cuts it close).**  
**Typical case: 10–18 seconds (exceeds recovery window).**

---

## Duplicate retry risk

**HIGH.** When the user sees "נסה שוב." and retries:
1. Another POST `/messages` fires
2. Backend appends a NEW user message (second copy)
3. Makes LLM calls again
4. Appends a NEW assistant message (second copy)

On next reload: user sees **two user messages + two assistant messages** for what felt like one interaction. No deduplication exists.

There is no idempotency key, no request ID on POST, and no client-side guard against retrying when a previous request is still running server-side. The `isTyping` guard prevents a UI double-click, but it's cleared when `recoverAfterTimeout` finishes (line 224: `finally { setIsTyping(false); }`). So the user can freely retry after the timeout cycle completes.

---

## Recommended smallest fix

**Increase `REQUEST_TIMEOUT_MS` from 8000 to 25000 in `sessionMessagesApiClient.ts`.**

```ts
const REQUEST_TIMEOUT_MS = 25000;  // 25 seconds — covers two LLM calls + grounding overhead
```

**Why this works:**
- The grounded pipeline (2 LLM calls + Firestore reads) typically finishes in 12–20 seconds
- 25 seconds covers the realistic P90 case
- No architecture change needed
- Recovery mechanism still handles extreme cases (backend > 25 seconds)
- Total timeout budget with recovery: 25 + 8 = 33 seconds

**Why 25 and not 60:**
- 60 seconds feels broken to users even if it succeeds
- 25 seconds is long but within reasonable "thinking" UX
- If 25 still isn't enough, the recovery window adds 8 more

**Additional guard (optional, one line):**
Add `isTyping` to the "Show error" display condition so the UI doesn't show "נסה שוב." while recovery is in progress. Currently `composerNotice` can show the final error while `isTyping` is still true during recovery polling — these states are not fully synchronized.

---

## Recommended robust fix

**Decouple POST `/messages` from LLM response completion (async job model):**

1. POST `/api/sessions/{id}/messages` immediately:
   - Validates auth
   - Appends user message
   - Starts async processing job (queued in Firestore or in-memory)
   - Returns `{ jobId, userMessage }` immediately (< 200ms)

2. Client polls GET `/api/sessions/{id}/messages` (or a dedicated `/jobs/{id}` endpoint) until the assistant message appears.

3. Backend job completes independently: appends assistant message, marks job done.

**Why this is better:**
- No timeout for the LLM call — the POST always succeeds fast
- Recovery is built-in (polling is the happy path, not the exception path)
- No duplicate retry problem (POST always returns the same persisted user message)
- Scales naturally to slow operations (deep PDF, multi-file grounding, future agents)

**Complexity:** Medium — requires a job/status model in Firestore, a poll loop in the client, and careful error/stale state handling.

---

## Tests needed

### Existing tests to update
- `tests/server/workspaces/sessionMessageApiRoute.test.ts` — add a test that verifies POST returns 201 even when the backend is slow (mock slow LLM)
- `tests/lib/sessions/sessionMessagesApiClient.test.ts` — if it exists, verify timeout constant and that AbortError maps to 503

### New tests for the small fix
1. `sessionMessagesApiClient` — timeout constant is ≥ 25000
2. `TutorConversation.hasNewAssistantMessage` — correctly identifies a new tutor message not in baseline (already tested, keep)
3. `TutorConversation.isTimeoutError` — correctly matches 503 + Hebrew message (already tested, keep)

### New tests for the robust fix (future)
- Job POST returns immediately with `jobId`
- Poll GET detects completed assistant message
- Duplicate POST with same user message deduplicates

---

## Ready for repair

**YES** — the small fix (timeout increase) is a one-line change with low risk and immediate benefit. The robust fix (async job model) requires design review before implementation.

---

## Safety
- I did not change code.
- I did not change Deep PDF behavior.
- I did not run git add.
- I did not commit.
- I did not push.
- I did not run git pull.
