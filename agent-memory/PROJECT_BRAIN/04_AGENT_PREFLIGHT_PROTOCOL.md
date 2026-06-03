# Agent Preflight Protocol

## Mandatory before implementation
1. Read `PROJECT_BRAIN/00_CURRENT_STATE.md`
2. Read the relevant section of `PROJECT_BRAIN/01_SYSTEM_PIPELINE_CONTRACTS.md`
3. Run focused Graphify queries
4. Write an impact prediction
5. List what can break
6. List tests and smoke checks before coding

## Stop conditions
- Stop and escalate if the task silently requires:
  - Firebase data-model change
  - session-attached file model
  - workspace/course delete semantics
  - fake unavailable actions
  - tutor/retrieval/Deep PDF behavior changes outside scope

## Minimum report expectation
- “If I change X, Y and Z could regress.”
- “I will verify with tests A and smoke B.”
