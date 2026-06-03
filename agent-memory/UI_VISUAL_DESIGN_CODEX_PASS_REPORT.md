# UI Visual Design Codex Pass

## 1. Visual gaps found before coding

- The sidebar hierarchy was functional but still felt like stacked controls instead of a course workspace.
- Conversation rows, file rows, and menus used different spacing, density, and hover language.
- The chat header and message area lacked a strong product surface; the screen read as large blank space with attached widgets.
- The composer worked but did not feel like the app's primary action zone.
- Assistant messages, sources, and upload feedback were usable but not polished enough for a calm premium feel.
- The file panel still exposed interaction patterns that felt closer to backend objects than learning materials.
- The settings page was already cleaner than before, but it still needed to feel like the same product family as the workspace.

## 2. Screens/references used

- User-provided current signed-in workspace screenshots for:
  - main chat shell
  - plus menu open
  - conversation three-dot menu open
  - study materials panel
  - settings page
- Live Playwright captures for:
  - `/settings` at desktop width
  - `/settings` after resize
  - `/` auth-loading state

## 3. Design strategy

- Tighten the shared visual language first: spacing, radius, shadows, blur, muted neutrals, accent handling.
- Add a small shared primitive layer instead of one-off restyling: `ActionMenu`, `ActionMenuItem`, `IconButton`, `StatusPill`, `ChatStatusCard`, `SectionHeader`.
- Keep the app warm, quiet, and desk-like rather than dashboard-like.
- Make the chat composer and assistant surfaces feel intentionally designed without changing tutor behavior or content logic.

## 4. Files changed

- `src/app/globals.css`
- `src/app/page.tsx`
- `src/app/settings/page.tsx`
- `src/components/files/FilePanel.tsx`
- `src/components/layout/CollapsiblePanel.tsx`
- `src/components/layout/MainLayout.tsx`
- `src/components/settings/ThemePicker.tsx`
- `src/components/tutor/TutorConversation.tsx`
- `src/components/workspaces/WorkspaceSelector.tsx`
- `src/components/ui/TutorUI.tsx`
- `tests/components/tutor/TutorConversation.test.tsx`

## 5. Sidebar changes

- Refined the sidebar shell with stronger spacing, softer depth, and a more polished header card.
- Made course rows feel like containers rather than plain list items.
- Made conversation rows calmer, more legible, and more clearly nested.
- Standardized the three-dot affordance with the shared icon-button/menu language.
- Improved footer/settings affordance to feel like part of the same surface family.

## 6. Composer changes

- Wrapped the composer in a floating surface so it reads as the primary action area.
- Upgraded the plus button and send button to feel more deliberate and balanced.
- Moved the textarea into a softer inner field for better visual focus.
- Anchored the plus menu to the button with the same menu system used elsewhere.
- Kept upload feedback inside the chat stream using a dedicated status card surface.

## 7. Menu system changes

- Introduced shared `ActionMenu` and `ActionMenuItem` primitives.
- Unified borders, radius, shadow, spacing, and hover behavior across conversation, file, and composer menus.
- Kept destructive actions distinct but restrained.
- Preserved disabled future actions where they already existed, but styled them clearly as disabled.

## 8. Chat readability changes

- Increased message padding, softened bubble geometry, and improved depth on assistant replies.
- Preserved configurable chat width and font size.
- Improved long-answer readability with more comfortable line height and calmer assistant-card presentation.
- Quieted the sources section and kept fallback labels generic.

## 9. FilePanel changes

- Reframed upload and file rows as calm study-material surfaces.
- Kept status simple: ready, processing, failed.
- Made file actions use the same menu/button system as the rest of the app.
- Reduced the backend-object feel while preserving current processing flow.

## 10. Settings changes

- Reworked the settings header into a cleaner product header.
- Grouped sections with shared section headers and calmer card surfaces.
- Improved option pills, row spacing, and diagnostics toggle polish.
- Brought the theme customization entry more in line with the workspace styling.

## 11. Sources changes

- Kept sources collapsed and visually quiet by default.
- Preserved filenames when available.
- Fell back to clean generic labels (`Source N`) when metadata is incomplete.
- Avoided raw IDs or overly technical labels.

## 12. Playwright visual checks performed

- Opened `http://127.0.0.1:3000/settings` at desktop width and reviewed the display, palette, and diagnostics sections.
- Resized the settings page to a narrower desktop viewport and verified layout stability.
- Opened `http://127.0.0.1:3000/` and captured the auth-loading shell.
- Limitation:
  - Playwright did not inherit the existing signed-in Firebase session, so the authenticated workspace screens were not reachable directly in automation.
  - For the signed-in workspace states, I compared the implementation against the user-provided screenshots and the live rendered code instead.

## 13. Remaining visual gaps

- The authenticated workspace states still need Nevo's eyes in a real signed-in session for final judgment on spacing and feel.
- The sidebar theme picker still uses a dark-strip presentation that may deserve a later dedicated refinement pass.
- The auth-loading shell is clean but intentionally minimal; it was not a target of this pass.

## 14. Tests and validation

- `npx tsc --noEmit` ✅
- `npx vitest run` ✅
- `npm run build` ✅
- `git diff --check` ✅
- `graphify update .` ✅

## 15. Ready for Nevo manual visual review

YES
