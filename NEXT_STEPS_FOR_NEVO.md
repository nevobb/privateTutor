# Next Steps For Nevo

## Immediate next step

**Manual browser UX smoke test**

The UX redesign pass is complete on branch `design/personal-tutor-ux-redesign`.
Build and tests pass. Manual browser verification is the blocker before merging.

### Smoke test procedure

1. Start emulators:
   ```
   firebase emulators:start --only auth,firestore,storage --project demo-private-tutor
   ```
2. Start dev server:
   ```
   npm run dev
   ```
3. Verify checklist:
   - [ ] Sign-in screen: warm background, Lora wordmark "מורה פרטי", green button
   - [ ] Click "Appearance" at sidebar bottom → panel expands
   - [ ] Select "Blue" preset → whole UI turns blue immediately
   - [ ] Click "Accent" color swatch → native picker opens, drag → live preview
   - [ ] Change Background → live update
   - [ ] Refresh → custom colors persist (no flash)
   - [ ] Click "Reset to default" → returns to Sage
   - [ ] After sign-in: left sidebar with app name + avatar appears
   - [ ] Workspaces load as folder list (📁 items)
   - [ ] Create workspace → new folder item appears, no raw UUID visible
   - [ ] Select workspace → sessions section appears below
   - [ ] Create session → session appears in list as "שיחה 1", no raw UUID as primary text
   - [ ] Send a tutor message → chat-first layout, message bubbles align correctly
   - [ ] Hebrew message text flows RTL, English stays LTR
   - [ ] Switch Learn/Practice → pill buttons update correctly
   - [ ] Click "עוד" → Research/Build/Temp dropdown appears, accessible
   - [ ] Click cost mode badge → dropdown shows Normal/Cheap/Deep options
   - [ ] Collapse/expand "חומרי לימוד" panel in sidebar
   - [ ] Collapse/expand "זיכרון למידה" panel in sidebar
   - [ ] Layout feels chat-first (chat is dominant, sidebar is secondary)
   - [ ] No raw UUIDs displayed as primary UI text

---

## After smoke test passes

### Session transcript/message API boundary

Add next narrow backend slice for session transcript boundaries:
- `POST /api/sessions/[sessionId]/messages` — append a message to a session
- `GET /api/sessions/[sessionId]/messages` — list messages for a session
- Auth-protected, workspace-owned, same pattern as existing session API
- No Gemini/Genkit yet — store and return mock/user messages only

---

## Route decision recorded (GAP-005)

`POST /api/tutor` is the canonical tutor endpoint. `/api/tutor/respond` is not created — the path follows Next.js App Router resource convention. Accepted. DECISION_LOG entry to be added in future cleanup PR.

---

## Explicitly out of scope until after message API boundary

- Real Gemini model calls
- Firebase cloud connection
- Firebase Admin SDK
- Storage, Genkit, retrieval
- Persistent learner memory
- Academic knowledge persistence
- Live theme switching UI

## Sequencing guardrails

1. Keep Codex as primary agent.
2. Use Aider + DeepSeek only if Codex is interrupted.
3. Keep package changes minimal.
4. Keep the tutor response provider mock-only.
5. Do not claim production readiness.
