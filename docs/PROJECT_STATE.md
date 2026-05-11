# Project State

## What Exists
- Initial Next.js + Tailwind + TypeScript shell configured.
- Desktop-first, Hebrew RTL UI layout.
- Workspaces, Tutor conversation, Cost modes, Work modes, and Side panels (Files and Memory).
- Type Definitions ensuring separation between Academic Knowledge and Learner Memory.
- Mock implementation of data and Tutor Response flow.
- Vitest configuration with Behavior regression tests stubbed.
- Stitch UI Design System ("Academic Minimalist Hebrew Research System").

## What is Mocked
- All user, workspace, memory, and academic knowledge data.
- The Tutor AI responses (no LLM, Gemini, or OpenAI integration).
- Citations and internal observation updates.
- File upload handling.

## What is Not Connected Yet
- Gemini / Genkit flows.
- Firebase Authentication / Firestore / Storage.
- Real retrieval for Academic Knowledge (Gemini File Search).
- Web Search Grounding.
- Persistent Learner Memory.

## How to Run the App
1. Install dependencies: `npm install`
2. Run development server: `npm run build` then `npm run start` (or your dev server equivalent)

## Known Limitations
- The project documentation in `/tmp/file_attachments` or `/docs` was missing during execution. I inferred requirements based on the initial prompt.
