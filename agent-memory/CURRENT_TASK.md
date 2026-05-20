# Current Task

## Active task
Step 27A — Tutor Teaching Contract and Instruction Awareness.

## Status
Completed on branch `step27a-tutor-teaching-contract`.

## What was implemented
- Source files added to `docs/tutor-contract/source/`
- Compact runtime teaching contract in `src/server/tutor/teachingContract.ts`
- TUTOR_TEACHING_CONTRACT injected into system prompt via `deepseekSystemPrompt.ts`
- Deterministic instruction-awareness routing in `sessionMessageApiService.ts`
- 36 tests in `tests/server/tutor/teachingContract.test.ts`

## Explicit boundaries preserved
- Math/LaTeX rendering NOT done (Step 27B)
- Citation display NOT done
- examples_knowledge.md NOT injected into runtime prompt
- No API keys, no provider internals exposed to user

## Validation executed
- `npm run build` ✅
- `npx vitest run tests/server/tutor/teachingContract.test.ts` — 36/36 ✅
- `npx vitest run tests/server/workspaces/sessionMessageApiService.test.ts ...` — 47/47 ✅
- `gitleaks detect --source .` — no leaks ✅

## Recommended next phase
Step 27B: Math/LaTeX rendering in the chat UI.
