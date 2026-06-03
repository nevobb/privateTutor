# Settings Navigation and Persistence Repair

## 1. Root cause of Settings freeze / slow navigation
- The Settings entry in [`src/app/page.tsx`](/Users/nevobiton/private-tutor-project/privateTutor/src/app/page.tsx:739) and the Back control in [`src/app/settings/page.tsx`](/Users/nevobiton/private-tutor-project/privateTutor/src/app/settings/page.tsx:82) were plain `<a href>` links.
- In the App Router that forced document-level navigation instead of client-side route transitions, so entering and leaving `/settings` reloaded the whole app shell.
- In local diagnostics this showed up as the kind of stall Nevo described: the route swap was doing unnecessary app bootstrap work instead of a lightweight client navigation.

## 2. Root cause of Settings controls not responding
- The controls themselves were not broken on `localhost`.
- The real failure mode was environment-specific hydration loss on `127.0.0.1` in Next 16 dev mode.
- Next was blocking dev resources as cross-origin because the dev server was started on `localhost`, while Playwright was visiting `127.0.0.1`.
- Evidence:
  - `.next/dev/logs/next-development.log` reported blocked cross-origin requests to `/_next/webpack-hmr` from `127.0.0.1`.
  - On `127.0.0.1`, button clicks fired at the DOM layer but `useEffect` never applied settings and handlers never updated localStorage/CSS vars.
  - On `localhost`, the same controls immediately updated localStorage and root CSS vars.
- So this was not a missing `"use client"` issue and not a broken button wiring issue. It was a dev-origin hydration issue.

## 3. Additional persistence bug found during validation
- `developer diagnostics` was still getting overwritten back to `false` when returning to `/`.
- Cause: [`src/app/page.tsx`](/Users/nevobiton/private-tutor-project/privateTutor/src/app/page.tsx:103) originally initialized `developerDiagnosticsEnabled` to `false`, then wrote that value back to localStorage before the mount effect finished reading the stored preference.
- Result: Settings could save the flag, but the home page remount would clobber it.

## 4. Fixes made
- Replaced raw Settings/Back anchors with `next/link` client navigation.
- Added a shared settings-preferences helper module:
  - [src/lib/settings/settingsPreferences.ts](/Users/nevobiton/private-tutor-project/privateTutor/src/lib/settings/settingsPreferences.ts:1)
- Centralized:
  - display preference keys
  - diagnostics storage key
  - display CSS-var application
  - font/width persistence writes
  - diagnostics parsing/serialization
- Added `allowedDevOrigins` for local dev validation hosts:
  - [next.config.ts](/Users/nevobiton/private-tutor-project/privateTutor/next.config.ts:3)
- Fixed the home-page diagnostics initialization so stored `true` is not overwritten on mount:
  - [src/app/page.tsx](/Users/nevobiton/private-tutor-project/privateTutor/src/app/page.tsx:103)

## 5. Navigation behavior after fix
- Settings entry now uses `Link` from the main workspace shell:
  - [src/app/page.tsx](/Users/nevobiton/private-tutor-project/privateTutor/src/app/page.tsx:733)
- Back control now uses `Link` on the Settings page:
  - [src/app/settings/page.tsx](/Users/nevobiton/private-tutor-project/privateTutor/src/app/settings/page.tsx:82)
- Playwright `beforeunload` validation on the Back link stayed clear, which indicates the Settings → `/` transition is no longer a document unload/reload path.

## 6. Persistence behavior after fix
- Font size writes `tutor-chat-font-size` and updates `--tutor-chat-font-size` immediately.
- Chat width writes `tutor-chat-max-width` and updates `--tutor-chat-max-width` immediately.
- Dev diagnostics writes `privateTutor.devDiagnostics.enabled` and now survives returning to `/`.
- Home page reapplies saved font/width preferences on mount through the shared helper.

## 7. LocalStorage keys verified
- `tutor-chat-font-size`
- `tutor-chat-max-width`
- `privateTutor.devDiagnostics.enabled`
- `tutor-theme-customization` remained in the existing `ThemePicker` flow and was not removed or renamed.

## 8. CSS variables verified
- `--tutor-chat-font-size`
- `--tutor-chat-max-width`
- Verified in Playwright on both:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`

## 9. Files changed
- [next.config.ts](/Users/nevobiton/private-tutor-project/privateTutor/next.config.ts:1)
- [src/app/page.tsx](/Users/nevobiton/private-tutor-project/privateTutor/src/app/page.tsx:1)
- [src/app/settings/page.tsx](/Users/nevobiton/private-tutor-project/privateTutor/src/app/settings/page.tsx:1)
- [src/lib/settings/settingsPreferences.ts](/Users/nevobiton/private-tutor-project/privateTutor/src/lib/settings/settingsPreferences.ts:1)
- [tests/app/settingsNavigationAndPersistence.test.ts](/Users/nevobiton/private-tutor-project/privateTutor/tests/app/settingsNavigationAndPersistence.test.ts:1)
- [tests/components/pageDiagnosticsToggle.test.ts](/Users/nevobiton/private-tutor-project/privateTutor/tests/components/pageDiagnosticsToggle.test.ts:1)

## 10. Tests added / updated
- Added [tests/app/settingsNavigationAndPersistence.test.ts](/Users/nevobiton/private-tutor-project/privateTutor/tests/app/settingsNavigationAndPersistence.test.ts:1)
  - client navigation source checks for Settings/Back
  - dev-origin allowlist check
  - font size persistence helper check
  - chat width persistence helper check
  - diagnostics persistence helper check
  - stored display preference re-application check
  - diagnostics initialization source check
- Updated [tests/components/pageDiagnosticsToggle.test.ts](/Users/nevobiton/private-tutor-project/privateTutor/tests/components/pageDiagnosticsToggle.test.ts:1)
  - now imports the shared helper module instead of `src/app/page.tsx`

## 11. Playwright / manual checks performed
- Opened `/settings` on `localhost`
- Changed:
  - font size → `Large`
  - chat width → `Wide`
  - developer diagnostics → `true`
- Verified localStorage values changed immediately.
- Verified `--tutor-chat-font-size` and `--tutor-chat-max-width` changed immediately.
- Clicked Back and verified:
  - route returned to `/`
  - saved font/width remained applied
  - diagnostics flag remained `true`
- Repeated the same flow on `127.0.0.1` after restarting the dev server with the new `allowedDevOrigins` config.
- Added a `beforeunload` check to verify the Back link no longer causes a document unload.

## 12. Validation results
- `npx tsc --noEmit` ✅
- `npx vitest run` ✅
- `npm run build` ✅
- `git diff --check` ✅
- `graphify update .` ✅

## 13. Remaining risks
- The “quick/no full reload” validation was done on the Back flow directly. The signed-in shell Settings entry still needs Nevo’s real signed-in smoke because Playwright does not inherit the local Firebase session.
- `allowedDevOrigins` addresses the local dev host mismatch for `localhost` / `127.0.0.1`; if Nevo uses another custom origin later, that host would need to be added explicitly.

## 14. Ready for Nevo manual smoke
- YES

## 15. Safety confirmations
- Tutor reasoning was not changed.
- Retrieval logic was not changed.
- Deep PDF behavior was not changed.
- Upload/extract/chunk backend behavior was not changed.
- Soft delete semantics were not changed.
- `primaryFileId` / `attachedFileIds` were not implemented.
- Learner memory was not implemented.
- No `git add` was run.
- No commit was created.
- No push was run.
- No `git pull` was run.
