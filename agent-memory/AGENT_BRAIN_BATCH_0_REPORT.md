# Agent Brain Batch 0 Report

## Implementation
- Built `agent-memory/PROJECT_BRAIN/` as a compact operational layer over the existing reports and Graphify graph.
- Focused the brain on:
  - current working state
  - pipeline contracts
  - impact prediction
  - regression smoke rules
  - product decisions
  - known risks and deferred work
- Updated `AGENTS.md` so future agents must read the brain and include impact prediction in implementation reports.

## Files created
- `agent-memory/PROJECT_BRAIN/00_CURRENT_STATE.md`
- `agent-memory/PROJECT_BRAIN/01_SYSTEM_PIPELINE_CONTRACTS.md`
- `agent-memory/PROJECT_BRAIN/02_CHANGE_IMPACT_MATRIX.md`
- `agent-memory/PROJECT_BRAIN/03_RISK_REGISTER.md`
- `agent-memory/PROJECT_BRAIN/04_AGENT_PREFLIGHT_PROTOCOL.md`
- `agent-memory/PROJECT_BRAIN/05_REGRESSION_SMOKE_PLAYBOOK.md`
- `agent-memory/PROJECT_BRAIN/06_DECISION_LOG_COMPACT.md`
- `agent-memory/PROJECT_BRAIN/07_OPEN_ISSUES_AND_DEFERRED_WORK.md`
- `agent-memory/PROJECT_BRAIN/08_AGENT_REPORT_TEMPLATE.md`
- `agent-memory/AGENT_BRAIN_BATCH_0_REPORT.md`

## AGENTS.md update
- Added a mandatory `PROJECT_BRAIN` read requirement before implementation.
- Added a mandatory impact-prediction requirement in future reports.

## Key pipeline contracts captured
- Upload -> extract -> chunk -> understanding -> retrieval -> tutor
- Deep PDF lifecycle and truthfulness rules
- File inventory deterministic shortcut
- Artifact grounding path
- Session message send path
- Session rename/delete path
- Uploaded file soft delete boundary
- Settings persistence path

## Key risks captured
- Rename false timeout / late success
- Hydration-looking Settings failures
- Deleted file leakage risk via direct chunk/artifact access
- Deep PDF duplicate run
- Hardcoded cost mode regressions
- Upload not becoming session context
- Unsafe workspace delete
- Visual polish breaking behavior

## Preflight protocol
- Read current state
- Read relevant contracts
- Run Graphify
- Predict impact
- Name what can break
- Name tests and smoke checks before coding
- Stop if the task quietly requires forbidden product/data-model work

## Smoke playbook
- Added compact smoke lists for UI/composer, settings, rename/delete, upload/delete, PDF/Deep PDF, retrieval, sources, navigation, and palette/theme.
