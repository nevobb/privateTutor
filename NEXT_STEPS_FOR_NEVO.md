# Next Steps For Nevo

## Immediate next step

Tighten Firestore rules for the newly implemented persistence slice, then expand emulator rule tests for:

- `users/{userId}/workspaces/{workspaceId}`
- `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}`
- `users/{userId}/workspaces/{workspaceId}/sessions/{sessionId}/messages/{messageId}`
- `users/{userId}/decisionLog/{entryId}`

## Why this is next

The first emulator-only persistence slice is now implemented.
Before UI workspace integration, we should lock authorization constraints in Firestore rules so repository contracts and security boundaries stay aligned.

## Scope for the next PR (keep narrow)

1. Firestore rule tightening for workspace/session/message/decisionLog paths.
2. Emulator rule tests proving own-user allow + cross-user deny on those paths.
3. No route behavior redesign and no tutor-provider change.

## Explicitly out of scope for that PR

- Storage upload integration
- Gemini integration
- Genkit integration
- retrieval integration
- learner memory persistence
- academic knowledge persistence
- Firebase cloud connection
- env files and secrets

## Sequencing guardrails

1. Keep Codex as primary agent.
2. Use Aider + DeepSeek only if Codex is interrupted.
3. Keep package changes minimal and only if strictly required for rules testing.
4. Keep the tutor response provider mock-only.

## Readiness note

The repo is ready for Firestore rules tightening as the safest next step after this first persistence implementation slice.
