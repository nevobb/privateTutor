# DeepSeek Smoke Test Report (Step 40B)

Date: 2026-05-18
Branch: `feat/provider-abstraction-deepseek`

## Scope
- Validate real DeepSeek tutor flow end-to-end through `POST/GET /api/sessions/[sessionId]/messages`
- Confirm provider selection and model routing
- Confirm persistence and user isolation
- Validate key failure behaviors (missing key fallback, upstream failure, timeout)

## Executed checks
1. Real provider route smoke (`tests/firebase/deepseekSmoke.emulator.test.ts`)
   - `Learning` + `Normal Learning` => `201`, persisted user+tutor messages
   - `Practice` + `Cheap Practice` => `201`, persisted user+tutor messages
   - `Research` + `Deep Research` => `201`, persisted user+tutor messages
   - `GET` after 3 sends returned 6 messages (3 user, 3 tutor)
   - Cross-user access:
     - `GET` by another user => `404`
     - `POST` by another user => `404`
2. Provider/model verification
   - Active provider with key => `deepseek`
   - Cost-mode routing:
     - `Cheap Practice` => `deepseek-chat`
     - `Normal Learning` => `deepseek-chat`
     - `Deep Research` => `deepseek-reasoner`
3. Failure behavior (`tests/server/tutor/deepseekProviderSafety.test.ts`)
   - Missing `DEEPSEEK_API_KEY` => fallback provider is `mock`
   - Upstream non-ok response => bounded thrown error (`DeepSeek API error <status>`)
   - Timeout/network rejection => exception propagated (no crash)

## Results
- Status: PASS
- Blockers: None
- Notes:
  - Validation was executed via API route + emulator-backed persistence (not manual browser clicking).
  - Existing legacy emulator harness tests that rely on `@firebase/rules-unit-testing` currently fail with Firestore Lite compatibility issues; this is separate from Step 40B and did not block the dedicated smoke path above.
