# Next Steps For Nevo

## Doc-Based Next Steps
*Note: Due to the missing original documentation files during the alignment pass, these steps are based on general stabilization principles and the initial prompt.*

1. **Verify Source Specs:** Ensure the original 10 markdown specification documents are actually present in the repository so an AI agent can execute them.
2. **Review Structural Alignment:** Review `src/types/index.ts` to confirm it matches the implicit schemas intended in `06_Retrieval_and_Memory_Technical_Spec.md`.
3. **Review Mock Flows:** Run `npx vitest run` to see if the behaviors align with the missing `09_Behavior_Regression_Test_Suite.md`.

## What Decisions Still Require Nevo
1. How to handle the missing specification documents.
2. Clarification on the exact JSON structures required by Genkit once we move past the mock phase.

## What Should NOT Be Implemented Yet
- **Do not** connect Gemini, Firebase, or Genkit.
- **Do not** build real persistent storage.
- **Do not** redesign the UI layout.
