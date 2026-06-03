# Session Message Timeout Repair Report

## 1. Branch and HEAD
- Branch: `repair/deep-pdf-tutor-state-behavior`
- HEAD: `0316223 fix: improve tutor behavior for Deep PDF states`

## 2. Files changed
Modified:
- `src/lib/sessions/sessionMessagesApiClient.ts`
- `tests/lib/sessions/sessionMessagesApiClient.test.ts`

Memory/docs:
- `agent-memory/SESSION_MESSAGE_TIMEOUT_REPAIR_REPORT.md`
- `agent-memory/DUAL_AGENT_SYNC_LOG.md` (sync entry appended)

## 3. Implementation

One-line change in `src/lib/sessions/sessionMessagesApiClient.ts`:

```ts
// Before
const REQUEST_TIMEOUT_MS = 8000;

// After
const REQUEST_TIMEOUT_MS = 25000;
```

## 4. Timeout change

| | Before | After |
|---|---|---|
| Client hard abort | 8 seconds | 25 seconds |
| Recovery window (4 × 2s) | 8 seconds | 8 seconds (unchanged) |
| **Total effective window** | **16 seconds** | **33 seconds** |

**Why 25 seconds:** The grounded tutor pipeline with artifact-aware context (two DeepSeek LLM calls + multiple Firestore reads) typically takes 10–20 seconds. 25 seconds covers the realistic P90 case. The existing 4-attempt recovery adds 8 more seconds for any remaining edge cases.

**No UX regression:** The typing indicator is shown during the full wait. The "נסה שוב." error only appears if the 33-second total window is exhausted, which is a genuine failure case rather than a false one.

## 5. Tests

### New test — `tests/lib/sessions/sessionMessagesApiClient.test.ts`

Added a source-file assertion in a standalone `describe` block:

```ts
describe("sessionMessagesApiClient — timeout budget", () => {
  it("REQUEST_TIMEOUT_MS is at least 25000 to cover grounded two-LLM-call pipeline", () => {
    const source = readFileSync(CLIENT_FILE, "utf-8");
    const match = /const REQUEST_TIMEOUT_MS\s*=\s*(\d+)/.exec(source);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(25000);
  });
});
```

This test reads the source file directly and fails if the timeout constant is ever reduced below 25 seconds accidentally.

### Existing tests: all pass unchanged
- `fetchSessionMessages fails fast with a safe message on timeout` — still passes (mocks fetch, unaffected by constant)
- `sendSessionMessage fails fast with a safe message on timeout` — still passes

## 6. Validation results
- `npx tsc --noEmit` — ✅ passed
- `npx vitest run` — ✅ 67 files passed, 18 skipped; 833 tests passed, 121 skipped
- `npm run build` — ✅ passed
- `git diff --check` — ✅ passed
- `graphify update .` — ✅ updated

## 7. Deferred
- Async job model (POST returns immediately, client polls for assistant message) — deferred per task scope
- Idempotency key on POST to prevent duplicate messages on retry — deferred
- Per-request timeout scaling based on costMode or file count — deferred
- `isTyping` / `composerNotice` synchronization improvement — deferred

## 8. Risks / open decisions
- If a genuinely slow backend takes > 33 seconds (unlikely but possible under high load), the user still sees the timeout error. The diagnostic estimate of P90 ≤ 20 seconds gives good margin.
- The 4-poll recovery interval (2s × 4) still runs `fetchSessionMessages` which shares the same 25-second timeout, but GET /messages is fast (< 500ms), so no concern there.
- Duplicate retry risk still exists at the 33-second mark if the user manually retries. This requires the idempotency key solution (deferred).

## 9. Ready for smoke
**YES** — one-line timeout increase, no behavior change, all tests pass.

## 10. Safety confirmations
- No Deep PDF behavior changed.
- No tutor logic changed.
- No retrieval changed.
- No upload/extract/chunk changed.
- No async job architecture added.
- No git add / commit / push run.
- No git pull run.
