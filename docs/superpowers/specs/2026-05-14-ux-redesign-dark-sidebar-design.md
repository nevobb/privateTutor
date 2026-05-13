# UX Redesign — Dark Sidebar + Color Modal

**Date:** 2026-05-14
**Branch:** design/personal-tutor-ux-redesign
**Status:** Approved for implementation

---

## 1. Problem

The current design has a warm beige sidebar and light appearance throughout. The user wants a dark navy sidebar with warm beige main area, a better color customization experience, and a fully LTR/English UI (Hebrew only in chat message text).

---

## 2. Approved Design Direction

- **Sidebar**: dark navy (`#1a2235`) with light text
- **Main chat area**: warm beige (`#F8F4EF`) unchanged
- **UI language**: English throughout (Topics, Conversations, Learn, Practice, Customize colors, etc.)
- **Layout direction**: LTR (`dir="ltr"`) for all app chrome
- **Hebrew**: only inside chat message bubble content (`direction: rtl` on bubble text)
- **Color editor**: dedicated "Customize colors" button in sidebar footer → opens a centered modal overlay
- **Default preset**: "Navy" (dark navy sidebar + blue-purple accent)

---

## 3. CSS Token Changes

### New tokens needed

The current token set assumes a light sidebar. A dark sidebar requires separate text tokens:

```css
/* Sidebar surface */
--tutor-sidebar: #1a2235;            /* was warm beige, now dark navy */
--tutor-sidebar-hover: #243050;      /* hover state on nav items */
--tutor-sidebar-active: #1e2d48;     /* active/selected nav item bg */
--tutor-sidebar-border: #1e2a3e;     /* internal dividers */

/* Sidebar text — NEW: separate from main area text */
--tutor-sidebar-text: #8896b3;       /* default nav item text */
--tutor-sidebar-text-active: #a5b4e8; /* active nav item text */
--tutor-sidebar-text-muted: #4a5568; /* section labels, secondary */
--tutor-sidebar-label: #4a5568;      /* TOPICS / CONVERSATIONS caps labels */

/* Existing tokens keep their roles */
--tutor-bg: #F8F4EF;                 /* main chat background — unchanged */
--tutor-surface: #FFFFFF;            /* chat bubble backgrounds — unchanged */
--tutor-accent: #7b8fd4;             /* primary accent — updated for navy preset */
--tutor-accent-light: #e1e0ff;       /* active session highlight */
--tutor-user-bubble: #c5cde8;        /* user message bubble */
```

### Preset: Navy (new default)

```json
{
  "preset": "navy",
  "vars": {
    "--tutor-bg": "#F8F4EF",
    "--tutor-sidebar": "#1a2235",
    "--tutor-sidebar-hover": "#243050",
    "--tutor-sidebar-active": "#1e2d48",
    "--tutor-sidebar-border": "#1e2a3e",
    "--tutor-sidebar-text": "#8896b3",
    "--tutor-sidebar-text-active": "#a5b4e8",
    "--tutor-sidebar-text-muted": "#4a5568",
    "--tutor-surface": "#FFFFFF",
    "--tutor-border": "#D8CFBF",
    "--tutor-border-subtle": "#EAE4D9",
    "--tutor-text": "#2A1F14",
    "--tutor-text-secondary": "#6B5B4C",
    "--tutor-text-muted": "#9E9185",
    "--tutor-accent": "#7b8fd4",
    "--tutor-accent-hover": "#6a7ec3",
    "--tutor-accent-light": "#e1e0ff",
    "--tutor-accent-text": "#3b4fa8",
    "--tutor-user-bubble": "#c5cde8",
    "--tutor-user-border": "#a5b4e8"
  }
}
```

### Existing presets (Sage, Blue, Warm, Slate, Rose)

These use light sidebars. They remain available as quick-switch options. All five must be updated to include the new `--tutor-sidebar-text` family with **dark values** appropriate for a light sidebar. Without this, switching from Navy to Sage would leave sidebar text stuck at navy's light colors (#8896b3) against a light background — unreadable.

For all light-sidebar presets, add:
```css
--tutor-sidebar-text: var(--tutor-text-secondary)   /* e.g. #6B5B4C for Sage */
--tutor-sidebar-text-active: var(--tutor-accent-text)
--tutor-sidebar-text-muted: var(--tutor-text-muted)  /* e.g. #9E9185 for Sage */
--tutor-sidebar-border: var(--tutor-border-subtle)
```

Each preset defines exact hex values (not var() references) in its vars object so `applyCustomization()` can write them directly to `:root`.

---

## 4. Layout Changes

### Direction

- All app chrome: `dir="ltr"`
- `MainLayout` outer div: `dir="ltr"` (already set)
- `WorkspaceSelector` outer div: change from `dir="rtl"` to `dir="ltr"`
- `page.tsx` sidebar div: change from `dir="rtl"` to `dir="ltr"`
- Chat message bubbles: `direction: rtl; text-align: right` on the bubble content element only

### Language

All visible UI text changes to English:

| Current (Hebrew) | New (English) |
|---|---|
| נושאים | Topics |
| שיחות | Conversations |
| + נושא חדש | + New topic |
| + שיחה חדשה | + New conversation |
| חומרי לימוד | Study materials |
| זיכרון למידה | Tutor memory |
| טוען... | Loading... |
| אין נושאים עדיין | No topics yet |
| אין שיחות פעילות | No conversations |
| יוצר... | Creating... |
| צור | Create |
| ביטול | Cancel |
| שם הנושא | Topic name |

Toolbar mode labels: Learn, Practice, More ▾
Cost mode badge: Normal ▾, Cheap, Deep

Error messages and loading states in WorkspaceSelector: English.

Chat input placeholder: "Type a message..." (English, LTR)

---

## 5. WorkspaceSelector Visual Changes

```
sidebar nav — dir="ltr"

TOPICS                          ← 9px uppercase, muted label
  Calculus 1                    ← active: bg #1e2d48, left-border #7b8fd4, text #a5b4e8
  Electromagnetism               ← inactive: text #8896b3, hover bg #243050
  Physics
  + New topic                   ← 11px, muted color, hover accent

CONVERSATIONS
  Limits & continuity            ← active same treatment
  Homework questions
  + New conversation

Study materials      ▸          ← collapsible, 11px
Tutor memory         ▸          ← collapsible, 11px
```

Active indicator: `border-left: 2px solid var(--tutor-accent)` (LTR — left border is the start edge).

No emoji anywhere.

---

## 6. Sidebar Footer — Color Button

Replaces the current `ThemePicker` collapsible panel at sidebar bottom.

```
┌─────────────────────────────────┐
│  ● ● ●   Customize colors    ⬡  │  ← bg #243050, border #2e3d60, rounded-lg
└─────────────────────────────────┘
```

- Three dots: current accent / background / sidebar colors as live indicators
- Label: "Customize colors" in `--tutor-sidebar-text`
- Clicking opens the color modal

---

## 7. Color Modal

Triggered by the sidebar footer button. Centered overlay. App is dimmed behind it (`rgba(10,14,25,0.6)` backdrop).

### Structure

```
┌─ Customize Colors ──────────── ✕ ─┐
│                                    │
│  QUICK PRESETS                     │
│  [Navy] [Sage] [Amber] [Blue] [Rose] │  ← split-circle previews
│                                    │
│  FINE TUNING — click swatch to edit│
│  ▪ Accent        #7B8FD4           │
│  ▪ Background    #F8F4EF           │
│  ▪ Sidebar       #1A2235           │
│  ▪ User bubble   #C5CDE8           │
│                                    │
├────────────────────────────────────┤
│  Reset to default       [Apply]    │
└────────────────────────────────────┘
```

### Behavior

- **Live preview**: every color change immediately writes to `document.documentElement.style.setProperty` — the app updates in real time behind the dimmed overlay
- **Preset click**: applies all preset vars at once, clears overrides, updates fine-tuning inputs to match
- **Fine tuning swatch click**: opens native `<input type="color">` picker
- **Fine tuning hex field**: editable; validates on blur (6-char hex); resets to current value if invalid
- **Apply**: saves to `localStorage["tutor-theme-customization"]`, closes modal
- **Reset to default**: restores Navy preset, clears overrides, updates inputs, saves
- **Close (✕ or click outside)**: snapshot the current CSS variable state when modal opens; on cancel, re-apply the snapshot to restore visual state. If Apply was already clicked during this session, keep as-is (snapshot updates on Apply)

### localStorage schema (unchanged)

```json
{
  "preset": "navy",
  "overrides": {
    "--tutor-accent": "#custom..."
  }
}
```

Backwards compat with old `"tutor-theme"` key preserved.

---

## 8. Files to Change

| File | Change |
|---|---|
| `src/app/globals.css` | Add new sidebar text tokens; update default `:root` values to Navy preset |
| `src/components/workspaces/WorkspaceSelector.tsx` | Change `dir="rtl"` → `dir="ltr"`; English labels; active border-left instead of border-right; use `--tutor-sidebar-*` vars for colors |
| `src/components/settings/ThemePicker.tsx` | Remove collapsible panel; export `ColorModal` component; add Navy preset; add `--tutor-sidebar-text` support in presets |
| `src/app/page.tsx` | Change sidebar `dir="rtl"` → `dir="ltr"`; replace `<ThemePicker />` with `<ColorModalButton onOpen={...} />` + modal; English labels in CollapsiblePanel titles |
| `src/components/layout/CollapsiblePanel.tsx` | Minor: already works, just receives English title props |
| `src/components/tutor/TutorConversation.tsx` | Chat input placeholder → English; message bubbles get `direction: rtl; text-align: right` on content only |

---

## 9. Files NOT to Change

- `src/app/api/*` — API routes
- `src/server/*` — server logic
- `src/lib/*` — all lib/client code
- `tests/*` — no test changes unless build breaks
- `firestore.rules`, `storage.rules`
- `package.json`, `package-lock.json`
- `src/types.ts` — WorkMode/CostMode enums unchanged

---

## 10. Acceptance Criteria

- [ ] Sidebar is dark navy; main area is warm beige
- [ ] All app UI labels are in English (no Hebrew in chrome)
- [ ] Hebrew appears only inside chat message bubble content
- [ ] Layout is LTR — everything left-aligned
- [ ] Topics list uses English labels, no emoji, left border on active item
- [ ] Conversations list same treatment
- [ ] "Customize colors" button visible in sidebar footer
- [ ] Clicking button opens centered modal overlay
- [ ] Modal shows 5 presets as split-circle visuals (Navy active by default)
- [ ] Modal shows 4 fine-tuning rows: Accent, Background, Sidebar, User bubble
- [ ] Color changes apply live while modal is open
- [ ] Apply saves to localStorage, closes modal
- [ ] Reset restores Navy preset
- [ ] Colors persist after page refresh
- [ ] Clicking outside modal or ✕ reverts unapplied changes
- [ ] `npm run build` passes
- [ ] `npm run lint` passes (0 errors)
- [ ] `npx vitest run` passes (all existing tests)
- [ ] No backend/API/Firebase/package files changed
