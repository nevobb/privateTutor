# Current State

## Phase
- PrivateTutor is in stabilization + product-shaping mode.
- Core tutor/file pipeline works.
- UI has had a strong visual pass, but some product and reliability work is still open.

## Working now
- Workspace-based tutor flow
- Upload -> extract -> chunk -> embeddings
- Deep PDF lifecycle and cache policy
- Tutor file access + file inventory shortcuts
- Conversation rename/delete UI exists
- Uploaded file soft delete exists
- Settings route and persistence are repaired in the current working tree

## Currently broken or still open
- Conversation rename can still show false timeout / late success
- Upload from composer does not make the file the session's explicit context
- Workspace/course delete is not safely implemented
- Sources still need richer metadata to feel fully polished
- Diagram-aware Deep PDF / visual understanding is still missing
- Authenticated visual smoke still needs real-session human review

## Do not touch casually
- `sessionMessageApiService` routing and grounding
- `fileInventoryService` deterministic shortcuts
- `uploadedFileRepository` soft-delete boundaries
- Deep PDF orchestration/cache/cost-mode behavior
- Settings persistence keys and CSS variable contract

## Recommended next repair order
1. Rename timeout / late success repair
2. Signed-in manual smoke on Settings + workspace shell
3. Upload-with-message / session context design batch
4. Safe Stitch continuation visual polish
5. Richer sources metadata
6. Workspace/course soft delete batch
