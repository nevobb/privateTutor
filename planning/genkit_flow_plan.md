# Genkit Flow Plan

This is a planning document. It does not add Genkit packages, runtime flows, or provider calls.

## `handleTutorMessageFlow`

- Input: user ID, workspace ID, message, work mode, cost mode, active file IDs, session ID.
- Output: visible tutor response, citations, internal updates, retrieval decision, memory candidates, decision log events.
- Side effects: later writes session messages, summaries, memory candidates, and decision logs.
- Secrets required later: `GEMINI_API_KEY`; Firebase server credentials in deployment environment.
- Allowed in MVP: yes.
- Can start mock-only: yes.
- Tests needed: guidance-only, local question stop, simple fact no retrieval, broad query clarification, cost mode routing, Temporary Chat no permanent memory.

## `classifyUploadedFileFlow`

- Input: user ID, workspace ID, file metadata, optional user assignment hint.
- Output: assignment recommendation, confidence, file type, topic/workspace suggestion, clarification needed flag.
- Side effects: later updates uploaded file metadata and decision log.
- Secrets required later: Gemini provider secret only when using model classification.
- Allowed in MVP: yes.
- Can start mock-only: yes.
- Tests needed: confident assignment, low-confidence ask user, unsupported file type, no silent assignment.

## `retrieveContextFlow`

- Input: user ID, workspace ID, query, retrieval scope, cost mode, active file IDs, session ID.
- Output: retrieved context items, source IDs, citation metadata, retrieval budget used.
- Side effects: later writes decision log; no memory write.
- Secrets required later: retrieval provider credentials such as Gemini File Search access.
- Allowed in MVP: yes.
- Can start mock-only: yes.
- Tests needed: no retrieval, session retrieval, topic retrieval, workspace retrieval, Cheap Practice budget, Deep Research budget, no whole-KB default.

## `updateLearnerMemoryFlow`

- Input: user ID, memory candidate, source session/message, confidence, reason, work mode.
- Output: accepted/rejected memory update, status, rationale, decision log event.
- Side effects: later writes learner memory and decision log.
- Secrets required later: none unless a model classifies ambiguous candidates.
- Allowed in MVP: yes.
- Can start mock-only: yes.
- Tests needed: meaningful correction accepted, meaningless message ignored, Temporary Chat rejected, no automatic deletion.

## `proposeAdaptiveInstructionFlow`

- Input: user ID, repeated behavior observations, learner memory references.
- Output: proposed instruction, version, rationale, activation recommendation.
- Side effects: later writes adaptive instruction candidate and decision log.
- Secrets required later: Gemini provider secret if model-assisted.
- Allowed in MVP: optional after memory basics.
- Can start mock-only: yes.
- Tests needed: repeated rushing correction creates proposal, single weak signal does not overfit.

## `generateSummariesFlow`

- Input: user ID, workspace ID, session or file references, summary target.
- Output: short retrieval-friendly summary and source references.
- Side effects: later writes session summary or academic knowledge metadata.
- Secrets required later: Gemini provider secret.
- Allowed in MVP: yes after tutor route and storage metadata.
- Can start mock-only: yes.
- Tests needed: summary stays source-linked, does not store learner preference as academic knowledge.

## `webSearchFlow`

- Input: user ID, query, reason, work mode, cost mode, workspace context.
- Output: answer context, source URLs, disclosure text, decision log event.
- Side effects: later writes decision log; no automatic academic knowledge write.
- Secrets required later: Google Search Grounding provider credentials or related server configuration.
- Allowed in MVP: later, mostly Research / Deep Research.
- Can start mock-only: yes.
- Tests needed: source disclosure, Cheap Practice disabled by default, conflict with course material is reported.

## `runBehaviorTestFlow`

- Input: behavior test case, mock/provider mode, expected assertions.
- Output: pass/fail result, failures, trace metadata.
- Side effects: later writes technical test run metadata if needed.
- Secrets required later: none for mock tests; provider tests should still use mocks in CI.
- Allowed in MVP: yes.
- Can start mock-only: yes.
- Tests needed: the runner itself must fail on invalid output and never call live providers by default.
