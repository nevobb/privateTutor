# PROJECT_STATE_CURRENT

Date: 2026-06-03
Source: normalized from `agent-memory/privateTutor_current_state_2026-06-03_v0.2.md`

## Current product direction

- `privateTutor` is a calm academic tutor workspace, not a dashboard or LMS.
- Course files belong in Study Materials first, then become chat context only after they are fully ready.
- The active chat context flow is:

```text
Study Materials
→ processed ready file
→ "בחר חומר מהקורס"
→ composer context chip
→ send with attachedFileIds
→ retrieval prioritizes selected files
```

## What is working

- Workspace/course structure and conversation flows
- Study Materials upload into course knowledge base
- File processing pipeline: upload → extract → chunk → embeddings / understanding
- Deep PDF pipeline
- Message-level `attachedFileIds`
- Retrieval prioritization for attached files
- Readiness gate that blocks answering from files that are not ready yet
- Settings navigation/persistence repair
- Conversation rename timeout repair
- Improved Stitch-aligned UI shell

## What must remain stable

- Do not casually change tutor reasoning or retrieval contracts
- Do not change Deep PDF lifecycle or cache behavior
- Do not change extraction/chunking/upload processing semantics
- Do not change uploaded-file soft delete semantics
- Do not add fake UI actions or fake source/file context behavior

## Current product decisions

- Selected course files remain active chat context until replaced or cleared
- Multiple selected files are allowed
- Whole-course search should not happen by default
- Whole-course search should happen only when the user explicitly asks for it
- Learner Memory comes after file context is stable

## Recommended next repair order

1. Consolidate C5B/C5C selected course-file context flow
2. Keep the plus-menu upload path clearly scoped to Study Materials, not instant chat attachment
3. Preserve attached-file context across follow-up turns
4. Only after that, continue learner-memory and further visual/product polish
