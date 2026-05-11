# Project State

## Framework & Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Testing:** Vitest

## Current Branch
- `feat/nevo-tutor-mvp` (or `main`)

## Alignment Status
- **GAPS IDENTIFIED:** The source documents (`00_README_START_HERE.md` through `09_Behavior_Regression_Test_Suite.md`) were **not found** in the environment during the alignment pass.
- Therefore, the app adheres to the strictly provided prompt rules (RTL, separation of Memory/Knowledge, no external services) but cannot be guaranteed aligned against the missing spec files.

## How to Run Locally
1. Run `npm install`
2. Run `npm run dev` to start the development server.
3. To build for production, run `npm run build` and `npm run start`.
4. To run tests, run `npx vitest run`.

## Existing Screens / Components
- **Main Layout (`MainLayout.tsx`):** Fixed RTL grid structure separating materials (right) and status (left).
- **Workspace Selector (`WorkspaceSelector.tsx`):** Header component.
- **Tutor Conversation (`TutorConversation.tsx`):** Central chat area.
- **Cost Mode Selector (`CostModeSelector.tsx`):** Cheap Practice, Normal Learning, Deep Research.
- **Work Mode Selector (`WorkModeSelector.tsx`):** Learning, Practice, Research, Build, Temporary Chat.
- **Side Panels:** `FilePanel.tsx` and `MemoryPanel.tsx`.

## Existing Mock Flows
- Implemented in `src/lib/tutor.ts`. Evaluates `WorkMode` and `CostMode` to return a simulated response without calling LLMs.

## What is Mocked
- All user, workspace, file, memory, and tutor response data.

## What is Not Connected Yet
- Gemini LLM, Genkit, Firebase Auth/Firestore/Storage, Retrieval / Vector DB.
