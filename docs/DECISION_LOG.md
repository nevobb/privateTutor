# Decision Log

## Technical/Product Decisions Made

### 1. Framework Selection
**Decision:** Used Next.js with App Router, TypeScript, and Tailwind CSS.
**Rationale:** Provides a robust, standard foundation for a responsive web app. Easy to drop in RTL styling using standard HTML attributes and Tailwind utility classes.

### 2. Type Segregation
**Decision:** Kept `AcademicKnowledgeItem` strictly separate from `LearnerMemory`.
**Rationale:** Follows the core product principle. We must prevent subjective student performance metrics from polluting the objective factual corpus of academic texts.

### 3. Mock Flow Architecture
**Decision:** Abstracted the LLM integration into a mock `getMockTutorResponse` function inside `src/lib/tutor.ts`.
**Rationale:** Allows the UI to be developed and tested for state management (isTyping, citations display) without incurring real API costs or dealing with network latency, adhering strictly to the "Do not connect Gemini yet" rule.

### 4. UI Layout Direction (RTL)
**Decision:** Implemented a fixed grid layout with the Materials panel on the right (primary sidebar in RTL) and Memory/Status on the left.
**Rationale:** Native Hebrew speakers naturally scan from right to left; putting the source materials on the right feels structurally correct for a research environment.

### 5. Testing Framework
**Decision:** Chose `Vitest` for behavior regression tests.
**Rationale:** Lightweight, fast, and works seamlessly with TypeScript and modern ESM setups out of the box, perfect for establishing the skeleton tests requested.
