# Tutor Contract

Source files that define how the personal academic tutor teaches Nevo.

## Source hierarchy

1. **Main Instructions** (`source/Personal Academic Tutor - Main Instructions.md`)
   Source of truth. Defines identity, language, pedagogy, teaching modes, tone, and all behavior rules.

2. **Modes Reference** (`source/tutor_modes_reference.md`)
   Compact mode-selection and routing layer. Quick decision map for switching between teaching modes based on Nevo's explicit instruction or context.

3. **Examples Knowledge** (`source/tutor_examples_knowledge.md`)
   Behavior precedents and test cases. Not injected into the runtime prompt every turn. Used to resolve ambiguous cases and validate behavior.

## Runtime usage

The runtime prompt uses a compact compiled teaching contract (`src/server/tutor/teachingContract.ts`), not the full source files.

- `TUTOR_TEACHING_CONTRACT` — injected into the system prompt on every turn.
- `PUBLIC_TEACHING_CONTRACT_SUMMARY` — returned when the user asks how the tutor is supposed to teach. Does not expose raw prompt text or implementation details.

## What is NOT in the runtime contract

- Raw source file text
- Examples knowledge (used for behavior tests, not prompt injection)
- Provider/API internals
- Security rules or hidden chains-of-thought
