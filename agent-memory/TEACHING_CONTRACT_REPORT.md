# Teaching Contract Report

## Date
2026-05-20

## Source files added
- `docs/tutor-contract/source/Personal Academic Tutor - Main Instructions.md` — source of truth
- `docs/tutor-contract/source/tutor_modes_reference.md` — mode routing layer
- `docs/tutor-contract/source/tutor_examples_knowledge.md` — behavior precedents/tests
- `docs/tutor-contract/README.md` — explains hierarchy and runtime usage

## Runtime contract created
`src/server/tutor/teachingContract.ts` exports:
- `TUTOR_TEACHING_CONTRACT` — compact runtime contract injected into system prompt every turn
- `PUBLIC_TEACHING_CONTRACT_SUMMARY` — safe user-facing summary when asked about teaching style
- `INSTRUCTION_AWARENESS_PATTERNS` — regexp list for deterministic routing
- `isInstructionAwarenessQuestion()` — returns true when user asks about instructions

## Prompt assembly
`src/server/tutor/deepseekSystemPrompt.ts` — replaced generic "אדפטיבי" prompt with TUTOR_TEACHING_CONTRACT + mode-specific addendum.

## Safe disclosure behavior
`src/server/workspaces/sessionMessageApiService.ts` — before calling LLM, checks `isInstructionAwarenessQuestion()`. If true, returns `PUBLIC_TEACHING_CONTRACT_SUMMARY` directly without LLM call. Does not expose raw prompt, provider internals, or API keys.

## Behavior tests added
`tests/server/tutor/teachingContract.test.ts` — 36 tests:
- Public summary required content (Hebrew, mechanism, modes, notebook, LaTeX, rebuild)
- Public summary must not contain .env, API keys, provider names, system-prompt wording
- Runtime contract required content (all teaching mode rules)
- Instruction-awareness detection (Hebrew and English patterns)
- Contract-level behavior mode declarations (hint/full-solution/local-question/new-topic)

## Manual smoke test results
- Instruction awareness: ✅ returned PUBLIC_TEACHING_CONTRACT_SUMMARY instantly (no LLM call)
- Hint mode: ✅ identified method + trap, asked guiding question, no calculation
- New topic: ✅ 5/6 required sections (מה כדאי/מה זה/המבנה/סיכום/מתכון); הרעיון המרכזי phrased differently but concept present

## What remains for Step 27B
- Math/LaTeX rendering in the UI (formulas written in LaTeX by model but rendered as raw text)
- Citation display in chat (data in API, not shown to user)
- UI settings panel for mode selection beyond Learn/Practice

## Notes
- examples_knowledge.md not injected into runtime prompt (used only as behavior test precedent)
- Teaching contract applies to all sessions regardless of workMode; mode-specific addendum is appended after
