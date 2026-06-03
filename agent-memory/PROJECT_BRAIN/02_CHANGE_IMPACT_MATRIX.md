# Change Impact Matrix

## `TutorConversation`
- Check send path, plus menu, upload feedback, sources, diagnostics panel, composer layout.
- Smoke: send message, upload file, work mode, cost mode, source rendering.

## `FilePanel`
- Check file list visibility, processing states, delete action, no raw debug statuses.
- Smoke: uploaded file appears, deleted file disappears, ready status still reads cleanly.

## `WorkspaceSelector`
- Check course/session hierarchy, rename/delete flows, active selection, menu behavior.
- Smoke: create/select session, rename, delete, no fake workspace delete.

## `src/app/settings/page.tsx`
- Check client navigation, localStorage writes, CSS vars, ThemePicker placement, diagnostics toggle.
- Smoke: change font, width, palette, back to `/`, values persist.

## `uploadedFileRepository`
- Check `isDeleted` filtering contracts.
- Smoke: deleted file excluded from list/get, no tutor-facing leakage.

## `sessionRepository`
- Check rename/delete semantics and ownership boundaries.
- Smoke: rename truthfulness, delete soft-delete safety, session listing after mutation.

## Retrieval services
- Check deleted-file exclusion, grounding quality, ready-file eligibility, source readability.
- Smoke: file question still grounds correctly; deleted file does not return.

## Deep PDF services
- Check cost-mode policy, status transitions, cache use, no duplicate run, truthful tutor messaging.
- Smoke: recommended/pending/completed/failed behavior stays correct.

## `ThemePicker` / `globals.css`
- Check theme key persistence, CSS variable application, sidebar does not re-grow ThemePicker.
- Smoke: theme changes apply immediately and survive navigation.
