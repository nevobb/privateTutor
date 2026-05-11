# Next Steps For Nevo

## What Nevo Should Review Tomorrow
- **UI Layout:** The Hebrew RTL structure, the components placement (Tutor, File Panel, Memory Panel), and the mode selectors.
- **Academic Minimalist Design:** Ensure the style feels right and lacks LMS/gamification noise.
- **Type Architecture:** Review `src/types/index.ts` to confirm the absolute separation of `LearnerMemory` and `AcademicKnowledgeItem`.
- **Mock Tutor Flow:** Ensure the structure of simulated interactions (`tutor.ts`) covers the edge cases conceptually.
- **Behavior Test Skeleton:** Review `tests/behavior.test.ts` to see what behaviors we will track moving forward.

## What Decisions Are Still Needed From Nevo
- Exact schema for `AcademicKnowledgeItem` regarding how citations map back to source PDFs.
- How deep the `LearnerMemoryObservation` schema should go (e.g., tags, confidence scores).
- The exact LLM Provider strategy for when we eventually connect (Genkit vs direct Gemini API).
- Confirmation of color schemes from the Stitch-generated UI.

## What Should NOT Be Built Yet
- Do not integrate Firebase (Auth, Firestore, Storage) yet.
- Do not add real LLM calls (Gemini/OpenAI).
- Do not implement real PDF parsing/OCR or Vector DB retrieval.
- Do not build complex settings or dashboard pages.
