# Agent Operating Instructions

## 1. Project identity

- This repository is for Nevo's Personal Adaptive Academic Tutor.
- The goal is a long-term, patient, adaptive, memory-aware, source-aware academic tutor.
- Core principle: Understanding before progress.

## 2. Non-goals

- Do not turn this into a generic chatbot.
- Do not turn this into a noisy LMS.
- Do not add gamification.
- Do not build dashboard-heavy features unless explicitly requested.
- Do not rush the learner.

## 3. Default architecture

- Desktop-first responsive web app.
- Hebrew RTL UI.
- App-managed files.
- Firebase Authentication later.
- Firestore later.
- Firebase Storage later.
- Genkit flows later.
- Gemini-first MVP later.
- Gemini File Search for MVP retrieval later.
- Google Search Grounding for MVP web search later.
- Learner Memory separate from Academic Knowledge Base.
- Hidden technical Decision Log in English.
- Cost modes:
  - Cheap Practice
  - Normal Learning
  - Deep Research
- Work modes:
  - Learning
  - Practice
  - Research
  - Build
  - Temporary Chat

## 4. Safety and security rules

- Never commit API keys or secrets.
- Never store API keys in application-level TypeScript models.
- Use environment variables only when real integrations are explicitly requested.
- Do not connect external services unless the task explicitly says to.
- Do not merge Learner Memory with Academic Knowledge Base.
- Do not silently infer missing product decisions.

## 5. Required workflow for every coding task

- Read `AGENTS.md` first.
- Read relevant files before editing.
- Make the smallest useful change.
- Keep changes scoped to the requested task.
- Run relevant checks:
  - `npm run build`
  - `npm run lint`
  - `npx vitest run`
- If a command cannot run, document why.
- Commit changes with a clear message.
- Report files changed and checks run.

## 6. Branch and PR rules

- Do not work directly on `main`.
- Every task should use a task-specific branch.
- PR base should be `main`.
- PR head should be the task branch.
- Do not force-push or rewrite history unless Nevo explicitly asks.
- Do not merge your own PR.

## 7. Documentation rules

- If docs exist in `/docs`, treat them as source of truth.
- If implementation conflicts with `/docs`, report the conflict.
- Do not silently resolve contradictions.
- Keep Decision Log entries factual and in English.

## 8. Testing rules

- Behavior tests are important.
- Avoid placeholder tests like `expect(true).toBe(true)`.
- Tests should protect tutoring behavior, not just implementation details.
- Prefer small behavior checks for:
  - no rushing
  - hint before full solution
  - source-aware academic answers
  - RTL assumptions
  - cost mode behavior
  - work mode behavior
  - memory/knowledge separation

## Project-specific coding note

<!-- BEGIN:nextjs-agent-rules -->
### This is NOT the Next.js you know

This version has breaking changes; APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
