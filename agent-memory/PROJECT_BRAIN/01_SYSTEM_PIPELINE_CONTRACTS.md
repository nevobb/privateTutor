# System Pipeline Contracts

## Upload -> extract -> chunk -> understanding -> retrieval -> tutor
- Upload from UI goes to storage, then workspace file metadata, then processing lifecycles.
- Extraction creates usable text.
- Chunking creates retrieval units.
- Embeddings power semantic retrieval.
- Document understanding is separate from the base pipeline; do not assume it always ran.
- Tutor answers must only use files that survive uploaded-file state checks.

## Deep PDF lifecycle and cache
- Deep PDF is a separate understanding layer with states like `recommended`, `pending`, `completed`, `failed`.
- Cheap Practice must not auto-run Deep PDF.
- Completed Deep PDF can improve confidence/structure handling.
- Recommended/pending/failed must not be described as completed.
- Duplicate runs and cache misuse are regression risks.

## File inventory path
- File inventory is a deterministic shortcut, not a normal model answer.
- It reads ready files and returns structured text-based inventory.
- Never refuse inventory because “visual PDF access” is missing.

## Artifact grounding path
- Artifact-aware grounding adds notes/anchors for section/page-style references.
- It must stay honest about Deep PDF state.
- It must not leak deleted-file artifacts.

## Session message send path
- `TutorConversation` -> session message client -> session API -> `sessionMessageApiService`.
- This path decides deterministic shortcut vs retrieval/model path.
- It is high-risk: small changes can break tutor behavior or source grounding.

## Session rename/delete path
- Rename/delete are separate from message send.
- Delete is soft delete.
- Rename still has timeout/late-success risk.

## Uploaded file soft delete path
- Soft delete hides files through repository boundaries.
- Normal runtime paths must start from `listUploadedFiles(...)` or `getUploadedFile(...)`.
- Do not query chunks/artifacts directly in user-facing flows without uploaded-file state checks.

## Settings persistence path
- Keys:
  - `tutor-chat-font-size`
  - `tutor-chat-max-width`
  - `privateTutor.devDiagnostics.enabled`
  - `tutor-theme-customization`
- Settings writes localStorage and CSS vars.
- Main page reapplies saved display preferences on mount.
- Settings/Back must use client navigation, not raw anchors.
