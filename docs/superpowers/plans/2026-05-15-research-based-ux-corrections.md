# Research-Based UX Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible left sidebar (mini-rail when collapsed, 48px wide, shows expand arrow + active topic initial) and a scope summary strip in the chat area (Topic · Mode · Sources).

**Architecture:** `MainLayout` owns `sidebarCollapsed` boolean state persisted to `localStorage`. It renders a mini-rail when collapsed or the full `sidebar` prop with an edge-tab collapse trigger when expanded. `TutorConversation` receives `activeTopicName` and renders a read-only scope strip between the toolbar and message list. `page.tsx` derives `activeTopicName` from workspace state and passes it to both.

**Tech Stack:** React 18, TypeScript, Next.js 16 (App Router), Tailwind via CSS custom properties, Vitest, ESLint

---

## File Map

| File | Change |
|---|---|
| `src/components/layout/MainLayout.tsx` | Rewrite: add `collapsed` state + localStorage, mini-rail, edge-tab toggle, `activeTopicName` prop |
| `src/components/tutor/TutorConversation.tsx` | Add `activeTopicName` prop + scope summary strip |
| `src/app/page.tsx` | Derive `activeTopicName`, pass to `MainLayout` + `TutorConversation` |

No other files change. No new files. No new packages.

---

## Task 1: Create feature branch

**Files:** none

- [ ] **Step 1: Check out main and create branch**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b design/research-based-ux-corrections
```

Expected: branch `design/research-based-ux-corrections` checked out at `main` HEAD.

---

## Task 2: Collapsible sidebar — rewrite `MainLayout.tsx`

**Files:**
- Modify: `src/components/layout/MainLayout.tsx`

- [ ] **Step 1: Read the current file**

```bash
cat src/components/layout/MainLayout.tsx
```

Confirm: it imports `React, { ReactNode }`, has one layout div with `<aside>` + `<main>`, no collapse logic.

- [ ] **Step 2: Replace `MainLayout.tsx` with the collapsible version**

Replace the entire file with:

```tsx
"use client";

import React, { ReactNode, useState, useEffect } from "react";

interface MainLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  activeTopicName?: string | null;
}

export default function MainLayout({ children, sidebar, activeTopicName }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("tutor-sidebar-collapsed") === "true");
  }, []);

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("tutor-sidebar-collapsed", String(next));
      return next;
    });
  };

  const topicInitial = activeTopicName?.[0]?.toUpperCase() ?? null;

  return (
    <div
      dir="ltr"
      className="flex h-screen w-full overflow-hidden"
      style={{ background: "var(--tutor-bg)" }}
    >
      {/* Left sidebar */}
      <aside
        className="relative flex-shrink-0 flex flex-col"
        style={{
          width: collapsed ? "48px" : "var(--tutor-sidebar-width)",
          transition: "width 200ms ease",
          background: "var(--tutor-sidebar)",
          borderRight: "1px solid var(--tutor-border)",
          overflow: "visible",
        }}
      >
        {collapsed ? (
          /* ── Mini-rail ── */
          <div
            className="flex flex-col items-center pt-3 gap-4 w-full"
            style={{ overflow: "hidden" }}
          >
            <button
              type="button"
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-base"
              style={{ color: "var(--tutor-sidebar-text)", background: "transparent" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--tutor-sidebar-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              ›
            </button>

            {topicInitial && (
              <div
                className="w-7 h-7 flex items-center justify-center rounded-md text-xs font-semibold select-none"
                style={{
                  background: "var(--tutor-sidebar-active)",
                  color: "var(--tutor-sidebar-text-active)",
                }}
                title={activeTopicName ?? undefined}
              >
                {topicInitial}
              </div>
            )}
          </div>
        ) : (
          /* ── Expanded sidebar ── */
          <>
            {/* Edge-tab collapse trigger — sits on the right border */}
            <button
              type="button"
              onClick={toggle}
              className="flex items-center justify-center transition-opacity opacity-40 hover:opacity-100"
              style={{
                position: "absolute",
                right: "-13px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "13px",
                height: "40px",
                background: "var(--tutor-sidebar)",
                border: "1px solid var(--tutor-border)",
                borderLeft: "none",
                borderRadius: "0 6px 6px 0",
                cursor: "pointer",
                zIndex: 10,
                color: "var(--tutor-sidebar-text-muted)",
                fontSize: "10px",
              }}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              ‹
            </button>

            {/* Sidebar content */}
            <div
              className="flex flex-col h-full min-w-0"
              style={{ overflow: "hidden" }}
            >
              {sidebar}
            </div>
          </>
        )}
      </aside>

      {/* Main chat area */}
      <main
        className="flex flex-1 flex-col overflow-hidden"
        style={{ background: "var(--tutor-bg)" }}
      >
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors related to `MainLayout`.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/MainLayout.tsx
git commit -m "design: collapsible sidebar — mini-rail with topic initial, edge-tab trigger"
```

---

## Task 3: Scope summary strip — update `TutorConversation.tsx`

**Files:**
- Modify: `src/components/tutor/TutorConversation.tsx`

- [ ] **Step 1: Add `activeTopicName` to the props interface**

Find this block (lines 9–16):

```tsx
interface TutorConversationProps {
  initialMessages: TutorMessage[];
  activeSessionId: string | null;
  workMode: WorkMode;
  onWorkModeChange: (mode: WorkMode) => void;
  costMode: CostMode;
  onCostModeChange: (mode: CostMode) => void;
}
```

Replace with:

```tsx
interface TutorConversationProps {
  initialMessages: TutorMessage[];
  activeSessionId: string | null;
  workMode: WorkMode;
  onWorkModeChange: (mode: WorkMode) => void;
  costMode: CostMode;
  onCostModeChange: (mode: CostMode) => void;
  activeTopicName?: string | null;
}
```

- [ ] **Step 2: Destructure the new prop**

Find this line (inside `export default function TutorConversation({`):

```tsx
  onCostModeChange,
}: TutorConversationProps) {
```

Replace with:

```tsx
  onCostModeChange,
  activeTopicName,
}: TutorConversationProps) {
```

- [ ] **Step 3: Add the scope mode label map just before the return statement**

Find this line:

```tsx
  return (
    <div
      className="flex flex-col h-full"
```

Insert before it:

```tsx
  const scopeModeLabels: Record<WorkMode, string> = {
    Learning: "Learn",
    Practice: "Practice",
    Research: "Research",
    Build: "Build",
    "Temporary Chat": "Temp Chat",
  };
  const scopeModeLabel = scopeModeLabels[workMode];
  const scopeTopicLabel = activeTopicName ?? "No topic";

```

- [ ] **Step 4: Insert scope strip between toolbar and no-session notice**

Find this block:

```tsx
      {/* No-session notice */}
      {!activeSessionId && (
```

Insert the scope strip immediately before it:

```tsx
      {/* Scope summary strip */}
      <div
        className="px-6 py-1.5 flex-shrink-0 text-xs"
        style={{
          color: "var(--tutor-text-muted)",
          background: "var(--tutor-surface)",
          borderBottom: "1px solid var(--tutor-border-subtle)",
        }}
        dir="ltr"
      >
        Topic: {scopeTopicLabel} · Mode: {scopeModeLabel} · Sources: not connected yet
      </div>

      {/* No-session notice */}
      {!activeSessionId && (
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors related to `TutorConversation`.

- [ ] **Step 6: Commit**

```bash
git add src/components/tutor/TutorConversation.tsx
git commit -m "design: add scope summary strip — topic, mode, sources"
```

---

## Task 4: Wire `page.tsx` — derive and pass `activeTopicName`

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Derive `activeTopicName` after the `displayName` and `avatarLetter` derivations**

Find this block (around line 222–230):

```tsx
  const displayName =
    authState.status === "signed-in"
      ? (authState.user?.displayName ?? authState.user?.email ?? "משתמש")
      : null;

  const avatarLetter =
    authState.status === "signed-in"
      ? (authState.user?.displayName?.[0]?.toUpperCase() ?? "N")
      : "N";
```

Add immediately after it:

```tsx
  const activeTopicName: string | null =
    workspaceState.status === "ready" && activeWorkspaceId !== null
      ? (workspaceState.workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null)
      : null;
```

- [ ] **Step 2: Pass `activeTopicName` to `MainLayout`**

Find:

```tsx
    <AuthShell authState={authState} onSignIn={signIn}>
      <MainLayout sidebar={sidebar}>
```

Replace with:

```tsx
    <AuthShell authState={authState} onSignIn={signIn}>
      <MainLayout sidebar={sidebar} activeTopicName={activeTopicName}>
```

- [ ] **Step 3: Pass `activeTopicName` to `TutorConversation`**

Find:

```tsx
        <TutorConversation
          initialMessages={mockTutorMessages}
          activeSessionId={activeSessionId}
          workMode={workMode}
          onWorkModeChange={setWorkMode}
          costMode={costMode}
          onCostModeChange={setCostMode}
        />
```

Replace with:

```tsx
        <TutorConversation
          initialMessages={mockTutorMessages}
          activeSessionId={activeSessionId}
          workMode={workMode}
          onWorkModeChange={setWorkMode}
          costMode={costMode}
          onCostModeChange={setCostMode}
          activeTopicName={activeTopicName}
        />
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "design: wire activeTopicName to MainLayout and TutorConversation"
```

---

## Task 5: Build, lint, test, report, push

**Files:**
- Create: `RESEARCH_BASED_UX_CORRECTIONS_REPORT.md`
- Update: `PROJECT_STATE.md`
- Update: `NEXT_STEPS_FOR_NEVO.md`

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: `✓ Compiled successfully` with no type errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Unit tests**

```bash
npx vitest run
```

Expected: all behavior tests pass (T001–T013). No regressions.

- [ ] **Step 4: Write `RESEARCH_BASED_UX_CORRECTIONS_REPORT.md`**

```markdown
# Research-Based UX Corrections Report

**Branch:** design/research-based-ux-corrections
**Date:** 2026-05-15
**Type:** Design/UX only — no backend, API, or Firebase changes

---

## Research UX Findings Applied

1. Sidebar should be collapsible — calm personal workspace, not a fixed control panel.
2. Chat must remain dominant — sidebar collapses to minimal rail, not zero.
3. Scope context should be visible near the chat — replaces need for many independent pickers.
4. Sources wording must be honest — "not connected yet" rather than implying real retrieval.

## Files Changed

| File | Change |
|---|---|
| `src/components/layout/MainLayout.tsx` | Collapsible sidebar: mini-rail (48px) when collapsed, edge-tab `‹` trigger when expanded, `activeTopicName` prop |
| `src/components/tutor/TutorConversation.tsx` | `activeTopicName` prop + scope summary strip |
| `src/app/page.tsx` | Derived `activeTopicName` from workspace state, passed to MainLayout + TutorConversation |

## Sidebar Collapse Behavior

- Starts expanded (296px), state persisted in `localStorage("tutor-sidebar-collapsed")`
- Collapsed state: 48px mini-rail
  - `›` expand button at top
  - Topic initial pill (e.g. `C` for Calculus 1) if a topic is selected
- Expanded state: edge-tab `‹` on right border (opacity 40%, full on hover)
- Transition: `width 200ms ease`
- No backend call. Local state only.

## Scope Summary Strip

- Thin strip between toolbar and messages in TutorConversation
- Content: `Topic: {name} · Mode: {mode} · Sources: not connected yet`
- Display-only. No retrieval implied.
- Updates when topic or mode changes.

## Study Materials / Memory Treatment

- Labels unchanged: "Study materials", "Tutor memory" — already correct from PR #27.
- No behavior changes.

## Appearance (ThemePicker)

- Unchanged. ThemePicker remains in sidebar footer.

## Behavior Preserved

- Auth flow: unchanged
- Workspace/session data flow: unchanged
- WorkspaceSelector Topics/Conversations hierarchy: unchanged
- WorkModeSelector Learn/Practice/More: unchanged
- All behavior tests T001–T013: pass

## What Was Explicitly NOT Changed

- Backend, API routes, Firebase, Auth, Firestore, Storage
- package.json, package-lock.json
- WorkspaceSelector, CollapsiblePanel, WorkModeSelector, CostModeSelector
- FilePanel, MemoryPanel, ThemePicker, globals.css
- No Gemini, Genkit, retrieval, memory persistence, Storage upload

## Commands Run

```
npm run build   ✓
npm run lint    ✓
npx vitest run  ✓ (T001–T013 pass)
```

## Next Task

Step 39 — Session transcript/message API boundary:
Connect TutorConversation to real session messages via the existing session API routes.
```

- [ ] **Step 5: Update `PROJECT_STATE.md`**

Add an entry for this step under the completed work section. If the file does not exist, create it with a summary of the current project state.

Key facts to include:
- Branch: design/research-based-ux-corrections
- Sidebar is now collapsible with mini-rail
- Scope strip added to TutorConversation
- No backend changes

- [ ] **Step 6: Update `NEXT_STEPS_FOR_NEVO.md`**

Mark Step 38C complete. Add Step 39:
```
Step 39 — Session transcript/message API boundary
Connect TutorConversation to real session messages.
Branch: to be created from main.
```

- [ ] **Step 7: Commit docs**

```bash
git add RESEARCH_BASED_UX_CORRECTIONS_REPORT.md PROJECT_STATE.md NEXT_STEPS_FOR_NEVO.md
git commit -m "docs: research-based UX corrections report and state update"
```

- [ ] **Step 8: Push and create PR**

```bash
git push -u origin design/research-based-ux-corrections
gh pr create \
  --base main \
  --head design/research-based-ux-corrections \
  --title "design: collapsible sidebar + scope summary strip" \
  --body "$(cat <<'EOF'
## Summary

- Collapsible left sidebar: mini-rail (48px) when collapsed, edge-tab ‹ trigger when expanded. Active topic initial shown in rail. State persisted to localStorage.
- Scope summary strip in TutorConversation: Topic · Mode · Sources (display-only, honest wording).
- activeTopicName derived from workspace state in page.tsx, passed to MainLayout + TutorConversation.

## What did NOT change

- No backend, API routes, Firebase, Auth, Firestore, Storage changes
- No package.json changes
- No new packages
- WorkspaceSelector, WorkModeSelector, ThemePicker, FilePanel, MemoryPanel unchanged

## Test plan

- [ ] npm run build passes
- [ ] npm run lint passes
- [ ] npx vitest run passes (T001–T013)
- [ ] Manual: sign in, sidebar collapses/expands, topic initial appears in rail
- [ ] Manual: select topic, scope strip shows correct name
- [ ] Manual: change mode, scope strip updates
- [ ] Manual: reload, collapsed state persists
- [ ] Manual: ThemePicker still works

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Section 1 (collapsible sidebar) → Task 2. Section 2 (scope strip) → Task 3. Section 3 (page.tsx wiring) → Task 4. Testing → Task 5.
- [x] **No placeholders:** All steps contain exact code.
- [x] **Type consistency:** `activeTopicName: string | null` used consistently across all tasks. `WorkMode` type not redefined, imported from `../../types`. `scopeModeLabels` key type matches `WorkMode`.
- [x] **One ambiguity resolved:** Edge-tab pattern chosen for collapse trigger — avoids overlapping with sidebar header content from page.tsx.
