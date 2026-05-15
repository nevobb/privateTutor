# Agent Task Protocol

This protocol defines how coding agents should work in the `privateTutor` repository.

The goal is to make implementation tasks more autonomous while keeping the project safe, scoped, reviewable, and aligned with Nevo's product direction.

## 1. Project identity

`privateTutor` is a personal adaptive academic tutor.

It is not a generic chatbot, LMS, dashboard product, bot platform, plugin platform, or learning operating system.

Core product principle:

Understanding before progress.

The product should become deeper, not broader.

## 2. Product direction

The app should feel like:

- a calm personal study desk
- a private academic tutor workspace
- one main tutor conversation with quiet supporting context
- course/topic/session/material organization around learning

The app should not drift into:

- LMS dashboards
- admin panels
- agent marketplaces
- tutorbot managers
- plugin systems
- channel systems
- noisy analytics surfaces
- file-manager-first UX

## 3. Current default architecture

Unless Nevo explicitly changes direction, assume:

- Desktop-first responsive web app
- Left sidebar + dominant main tutor chat
- Hebrew-capable chat content
- UI chrome can be English/LTR
- Firebase Authentication
- Firestore
- Firebase Storage later
- Genkit later
- Gemini-first MVP later
- Gemini File Search as MVP retrieval provider later
- Learner Memory separate from Academic Knowledge
- Course/topic/session context should stay explicit
- Cost/mode behavior should remain simple and calm

## 4. Branch rules

Never work directly on `main`.

Every implementation task must use a task-specific branch.

Branch from `origin/main`, not local `main`, unless explicitly instructed otherwise.

Required branch setup:

    git fetch origin
    git checkout -B <task-branch> origin/main

PR base must be:

    main

PR head must be the task branch.

Do not merge your own PR.

Do not force-push unless explicitly instructed.

Do not rebase or rewrite history unless explicitly instructed.

## 5. Task modes

Every task should be treated as one of these modes.

### Mode A — Ask-first

Use when the task involves:

- UX/design decisions
- product terminology
- mode simplification
- data model changes
- security/rules changes
- package/dependency changes
- external service connections
- Gemini/Genkit/retrieval integration
- learner memory policy
- deleting or replacing large parts of existing code

In this mode, stop and ask Nevo before implementation if ambiguity exists.

### Mode B — Auto PR

Use when the task is a scoped engineering boundary, such as:

- schemas
- serializers
- API routes
- repository functions
- service layer
- client API modules
- unit tests
- emulator-gated tests
- reports
- lint/build/test fixes
- PR scope cleanup

In this mode, continue through implementation, tests, commit, and push without intermediate questions unless blocked.

### Mode C — Review/diagnosis only

Use when asked to inspect, compare, verify, or diagnose.

Do not edit code.
Do not commit.
Return a report only.

## 6. Scope discipline

Make the smallest useful change.

Do not broaden the task.

Do not add future-facing systems unless explicitly requested.

Do not implement adjacent features just because they are nearby.

If the task says API boundary, do not add UI redesign.

If the task says UI polish, do not add backend behavior.

If the task says mock only, do not add real Gemini, Genkit, retrieval, or memory persistence.

## 7. Forbidden files and artifacts

Do not create, stage, commit, or include in PR diffs:

    docs/superpowers/*
    .superpowers/*
    .claude/*
    .codex/*
    .playwright-mcp/*
    design-input/*
    public/design-preview*.html
    final-design*.png
    screenshots
    *.log
    firebase-debug.log
    firestore-debug.log
    .env
    .env.*
    service-account*.json
    *.zip

Do not commit process artifacts, scratch plans, agent framework files, screenshots, local logs, or generated previews.

For implementation tasks, the only allowed task-specific report is the approved report file named in the task prompt, for example:

    SESSION_TRANSCRIPT_API_BOUNDARY_REPORT.md

If a tool creates forbidden files, remove them before committing.

## 8. Required pre-commit scope check

Before every commit, run:

    git diff --name-status origin/main...HEAD
    git status --short

The final diff must contain only files relevant to the task.

If unexpected files appear, stop and clean them before committing.

Do not use:

    git add .

Always stage explicit files.

## 9. Package and dependency rules

Do not change:

    package.json
    package-lock.json

unless the task explicitly allows it.

Do not add dependencies unless explicitly approved by Nevo.

If a dependency seems necessary, stop and report why.

## 10. Firebase and external service rules

Do not connect real Firebase cloud unless explicitly requested.

Do not run:

    firebase deploy
    firebase init
    firebase login

Do not add real Firebase project IDs, service accounts, or secrets.

Do not add Firebase Admin SDK unless explicitly requested.

Do not change Firestore or Storage rules unless the task explicitly requires it or discovery proves the current rules block the requested feature. If rules must change, explain why in the final report.

## 11. AI provider rules

Do not add Gemini, Genkit, retrieval, web search, embeddings, or learner memory persistence unless the task explicitly asks for them.

Mock tutor behavior should remain mock-only until the task explicitly says to connect a real provider.

Provider secrets must never be added to frontend code or TypeScript models.

## 12. Auth and ownership rules

Never trust client-supplied `userId`.

Server routes must derive user identity from the authenticated token.

All user-owned resources must be scoped by authenticated user.

Cross-user access should return safe not-found/unauthorized behavior without leaking data.

## 13. UI rules

The main chat remains the visual center.

Supporting context should be quiet, collapsible, or progressive.

Avoid dashboards, admin-style surfaces, and control-room UI.

Do not expose raw IDs as primary UI text.

Hebrew chat content must work naturally.

Use `dir="auto"` or `<bdi>` where mixed Hebrew/English text may appear.

## 14. Testing requirements

For implementation tasks, run:

    npm run build
    npm run lint
    npx vitest run
    git diff --check

Default tests must remain emulator-independent.

Emulator tests must be gated by explicit environment variables, for example:

    FIREBASE_SESSION_MESSAGES_EMULATOR_TEST=1

If an emulator test is added, it should skip by default.

If a command cannot be run, explain why.

## 15. Emulator test rules

Emulator tests are allowed for Firebase Auth/Firestore behavior, but they must:

- be gated by env var
- skip by default
- avoid cloud Firebase
- avoid real project IDs
- avoid secrets
- clean up test data when practical
- be documented in the task report

## 16. Documentation rules

Update project state docs only when useful:

    PROJECT_STATE.md
    NEXT_STEPS_FOR_NEVO.md

Add exactly one task report if requested.

Do not create extra planning docs unless requested.

Do not create `docs/superpowers/*`.

Decision Log entries require explicit product/architecture decisions. Do not add Decision Log entries for routine implementation unless the task asks for it.

## 17. Final report format

Every implementation task should end with a report containing:

    1. Branch used
    2. One step only confirmation
    3. Discovery summary
    4. Files added
    5. Files changed
    6. Endpoint/API summary, if relevant
    7. Auth/ownership summary, if relevant
    8. Persistence summary, if relevant
    9. UI summary, if relevant
    10. Tests added
    11. Commands run and pass/fail
    12. Emulator test result, if run
    13. Whether backend/API/Firebase/package files changed
    14. Whether Gemini/Genkit/retrieval/memory/Storage added
    15. Commit SHA
    16. PR link or manual PR link
    17. Exact next recommended task

If no code changes were made, say so clearly.

## 18. PR cleanup rule

Before opening or finalizing a PR:

1. Confirm base is `main`.
2. Confirm head is the task branch.
3. Run:

       git diff --name-status origin/main...HEAD

4. Ensure there are no forbidden files.
5. Ensure package files are unchanged unless approved.
6. Ensure backend/API/Firebase files are unchanged unless in scope.
7. Ensure report docs match the actual branch and PR.

If the PR is accidentally created from the wrong base or includes old history, do not try to fix it by hand in GitHub. Create a clean branch from `origin/main`, apply only the intended patch, and open a new PR.

## 19. When to stop and ask Nevo

Stop and ask Nevo if:

- the task requires product judgment
- UX/design preference is unclear
- a package must be added
- Firebase rules must change
- an external service must be connected
- a data model needs incompatible changes
- multiple implementation paths have significant tradeoffs
- the requested scope conflicts with project docs
- a safe implementation would require deleting or rewriting a large area

## 20. When to continue autonomously

Continue without asking if:

- the task is a scoped API/repository/schema/test implementation
- build/lint/test failures are directly caused by your changes
- a small serializer/schema adjustment is needed
- a test needs updating for an intentional type/shape change
- PR cleanup is needed to remove forbidden artifacts
- docs need minor branch/commit accuracy corrections

## 21. Current project principle for future work

DeepTutor research showed that broad AI learning platforms become complex quickly.

privateTutor should learn from strong architecture patterns, but not copy platform sprawl.

Guiding rule:

Build a deeper personal tutor, not a broader learning platform.
