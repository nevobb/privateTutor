# Project State

## Framework & Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Testing:** Vitest

## Current Branch
- `feat/nevo-tutor-mvp` (or `main` depending on local branch checkout state)

## How to Run Locally
1. Run `npm install`
2. Run `npm run dev` to start the development server.
3. To build for production, run `npm run build` and `npm run start`.
4. To run tests, run `npx vitest run`.

## Existing Screens / Components
- **Main Layout (`MainLayout.tsx`):** Fixed RTL grid structure separating materials (right) and status (left).
- **Workspace Selector (`WorkspaceSelector.tsx`):** Header component to choose active workspace.
- **Tutor Conversation (`TutorConversation.tsx`):** Central chat area handling interactions, rendering citations, and updating states.
- **Cost Mode Selector (`CostModeSelector.tsx`):** Toggles between Cheap Practice, Normal Learning, and Deep Research.
- **Work Mode Selector (`WorkModeSelector.tsx`):** Tabs for Learning, Practice, Research, Build, and Temporary Chat.
- **File Panel (`FilePanel.tsx`):** Right sidebar for academic knowledge base (PDFs).
- **Memory Panel (`MemoryPanel.tsx`):** Left sidebar to track learner performance and observations.

## Existing Mock Flows
- A mock tutor flow is implemented in `src/lib/tutor.ts`.
- When the user sends a message, it intercepts the input, evaluates the selected `WorkMode` and `CostMode`, and returns a simulated tutor response after a 1-second delay.
- The simulation includes citations mapping to mocked source documents when in "Research" mode, and hints without full solutions when in "Practice" mode.

## What is Mocked
- `User` profile.
- `Workspace` data.
- `UploadedFile` (Academic Knowledge Base).
- `LearnerMemory` and internal tracking updates.
- The Tutor AI logic (LLM responses).

## What is Not Connected Yet
- Gemini LLM or OpenAI API integrations.
- Genkit orchestration.
- Firebase Authentication.
- Firestore Database.
- Firebase Storage (for real file uploads).
- Retrieval-Augmented Generation (RAG) and PDF parsing.
- Real persistent Learner Memory.
- Web Search Grounding.

## Known Limitations
- The project documentation in `/tmp/file_attachments` or `/docs` was initially missing, so requirements were inferred directly from prompt specifications.
- Currently, interaction is entirely hardcoded locally for UI review purposes.
