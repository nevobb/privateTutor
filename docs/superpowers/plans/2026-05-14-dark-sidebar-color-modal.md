# Dark Sidebar + Color Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace warm beige sidebar with dark navy sidebar, convert ThemePicker from a collapsible panel into a dedicated "Customize colors" button + modal, and make all UI chrome English/LTR with Hebrew only inside chat bubbles.

**Architecture:** CSS custom properties drive all theming. The new `--tutor-sidebar-text` token family lets WorkspaceSelector render correctly against both dark (Navy) and light (Sage, etc.) sidebar presets. ThemePicker renders both the footer button and the fixed-position modal from a single component — no state lifting needed because `position: fixed` escapes the sidebar DOM.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, Tailwind CSS (utility classes), CSS custom properties, localStorage.

**Spec:** `docs/superpowers/specs/2026-05-14-ux-redesign-dark-sidebar-design.md`

---

## File Map

| File | What changes |
|---|---|
| `src/app/globals.css` | Add 4 new `--tutor-sidebar-*` text tokens to `:root`; update defaults to Navy values |
| `src/components/settings/ThemePicker.tsx` | Add Navy preset + sidebar text tokens to all presets; rewrite component as Button+Modal; add snapshot/cancel logic |
| `src/components/workspaces/WorkspaceSelector.tsx` | LTR, English labels, switch to `--tutor-sidebar-*` vars, border-left active indicator |
| `src/app/page.tsx` | LTR sidebar div, English CollapsiblePanel titles |
| `src/components/workModes/WorkModeSelector.tsx` | English labels, LTR dropdown |
| `src/components/costModes/CostModeSelector.tsx` | English labels, LTR dropdown |
| `src/components/tutor/TutorConversation.tsx` | English placeholder, remove hardcoded RTL from textarea |

---

## Task 1: Add sidebar text CSS tokens to globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add the 4 new sidebar text tokens to `:root`**

Open `src/app/globals.css`. Replace the entire `:root` block with:

```css
:root {
  /* Main area */
  --tutor-bg: #F8F4EF;
  --tutor-surface: #FFFFFF;
  --tutor-surface-raised: #FDFBF8;
  --tutor-border: #D8CFBF;
  --tutor-border-subtle: #EAE4D9;
  --tutor-text: #2A1F14;
  --tutor-text-secondary: #6B5B4C;
  --tutor-text-muted: #9E9185;

  /* Sidebar surface — Navy default */
  --tutor-sidebar: #1a2235;
  --tutor-sidebar-hover: #243050;
  --tutor-sidebar-active: #1e2d48;
  --tutor-sidebar-border: #1e2a3e;

  /* Sidebar text — NEW tokens (light values for dark/navy sidebar) */
  --tutor-sidebar-text: #8896b3;
  --tutor-sidebar-text-active: #a5b4e8;
  --tutor-sidebar-text-muted: #4a5568;

  /* Accent — Navy blue-purple */
  --tutor-accent: #7b8fd4;
  --tutor-accent-hover: #6a7ec3;
  --tutor-accent-light: #e1e0ff;
  --tutor-accent-text: #3b4fa8;

  /* Chat bubbles */
  --tutor-user-bubble: #c5cde8;
  --tutor-user-border: #a5b4e8;

  /* Shadows + radius */
  --tutor-shadow-sm: 0 1px 2px rgba(26,34,53,0.08);
  --tutor-shadow: 0 2px 8px rgba(26,34,53,0.12);
  --tutor-radius: 10px;
  --tutor-sidebar-width: 296px;

  /* Legacy compat */
  --background: var(--tutor-bg);
  --foreground: var(--tutor-text);
}
```

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "design: update CSS tokens — Navy sidebar defaults, sidebar-text family"
```

---

## Task 2: Update THEMES constant — add Navy preset + sidebar text to all presets

**Files:**
- Modify: `src/components/settings/ThemePicker.tsx`

This task only touches the `THEMES` data and `DEFAULT_PRESET`. No UI changes yet.

- [ ] **Step 1: Replace `ThemeKey` type and `THEMES` constant**

In `src/components/settings/ThemePicker.tsx`, replace the `ThemeKey` type and the entire `THEMES` constant with the following. Every preset now includes all `--tutor-sidebar-*` tokens.

```typescript
export type ThemeKey = "navy" | "sage" | "blue" | "warm" | "slate" | "rose";

interface ThemePreset {
  label: string;
  vars: Record<string, string>;
}

export const THEMES: Record<ThemeKey, ThemePreset> = {
  navy: {
    label: "Navy",
    vars: {
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
      "--tutor-user-border": "#a5b4e8",
    },
  },
  sage: {
    label: "Sage",
    vars: {
      "--tutor-bg": "#F8F4EF",
      "--tutor-sidebar": "#EDE7DC",
      "--tutor-sidebar-hover": "#E3DDD0",
      "--tutor-sidebar-active": "#D8D0C4",
      "--tutor-sidebar-border": "#EAE4D9",
      "--tutor-sidebar-text": "#6B5B4C",
      "--tutor-sidebar-text-active": "#2E5C40",
      "--tutor-sidebar-text-muted": "#9E9185",
      "--tutor-surface": "#FFFFFF",
      "--tutor-border": "#D8CFBF",
      "--tutor-border-subtle": "#EAE4D9",
      "--tutor-text": "#2A1F14",
      "--tutor-text-secondary": "#6B5B4C",
      "--tutor-text-muted": "#9E9185",
      "--tutor-accent": "#4D7E62",
      "--tutor-accent-hover": "#3E6B52",
      "--tutor-accent-light": "#EAF2EC",
      "--tutor-accent-text": "#2E5C40",
      "--tutor-user-bubble": "#E8EDFF",
      "--tutor-user-border": "#BCC8F0",
    },
  },
  blue: {
    label: "Blue",
    vars: {
      "--tutor-bg": "#F4F7FC",
      "--tutor-sidebar": "#E8EEF8",
      "--tutor-sidebar-hover": "#DCE5F2",
      "--tutor-sidebar-active": "#CDDAEE",
      "--tutor-sidebar-border": "#E2EAF5",
      "--tutor-sidebar-text": "#4A5A7A",
      "--tutor-sidebar-text-active": "#1E4B9E",
      "--tutor-sidebar-text-muted": "#8A9ABE",
      "--tutor-surface": "#FFFFFF",
      "--tutor-border": "#C8D5E8",
      "--tutor-border-subtle": "#E2EAF5",
      "--tutor-text": "#1A2540",
      "--tutor-text-secondary": "#4A5A7A",
      "--tutor-text-muted": "#8A9ABE",
      "--tutor-accent": "#3B6FBF",
      "--tutor-accent-hover": "#2D5CA5",
      "--tutor-accent-light": "#EAF0FF",
      "--tutor-accent-text": "#1E4B9E",
      "--tutor-user-bubble": "#EAF0FF",
      "--tutor-user-border": "#B8CCEE",
    },
  },
  warm: {
    label: "Warm",
    vars: {
      "--tutor-bg": "#FAF6F0",
      "--tutor-sidebar": "#F0E8DC",
      "--tutor-sidebar-hover": "#E8DDD0",
      "--tutor-sidebar-active": "#DDD0C0",
      "--tutor-sidebar-border": "#EAE0D0",
      "--tutor-sidebar-text": "#6E4F38",
      "--tutor-sidebar-text-active": "#5C3A22",
      "--tutor-sidebar-text-muted": "#9C826A",
      "--tutor-surface": "#FFFFFF",
      "--tutor-border": "#D4C4A8",
      "--tutor-border-subtle": "#EAE0D0",
      "--tutor-text": "#2C1A0E",
      "--tutor-text-secondary": "#6E4F38",
      "--tutor-text-muted": "#9C826A",
      "--tutor-accent": "#8B5E3C",
      "--tutor-accent-hover": "#754E30",
      "--tutor-accent-light": "#FAF0E4",
      "--tutor-accent-text": "#5C3A22",
      "--tutor-user-bubble": "#FFF0E0",
      "--tutor-user-border": "#E0C8A0",
    },
  },
  slate: {
    label: "Slate",
    vars: {
      "--tutor-bg": "#F2F4F6",
      "--tutor-sidebar": "#E6EAF0",
      "--tutor-sidebar-hover": "#DAE0EA",
      "--tutor-sidebar-active": "#CDD5E2",
      "--tutor-sidebar-border": "#E2E8F0",
      "--tutor-sidebar-text": "#4A5E74",
      "--tutor-sidebar-text-active": "#2A4E70",
      "--tutor-sidebar-text-muted": "#8096B0",
      "--tutor-surface": "#FFFFFF",
      "--tutor-border": "#C8D0DC",
      "--tutor-border-subtle": "#E2E8F0",
      "--tutor-text": "#1C2A38",
      "--tutor-text-secondary": "#4A5E74",
      "--tutor-text-muted": "#8096B0",
      "--tutor-accent": "#4A6B8A",
      "--tutor-accent-hover": "#3A5A78",
      "--tutor-accent-light": "#EAF2FF",
      "--tutor-accent-text": "#2A4E70",
      "--tutor-user-bubble": "#E4EEFF",
      "--tutor-user-border": "#B4C8E8",
    },
  },
  rose: {
    label: "Rose",
    vars: {
      "--tutor-bg": "#FAF4F7",
      "--tutor-sidebar": "#F0E4EC",
      "--tutor-sidebar-hover": "#E8D8E4",
      "--tutor-sidebar-active": "#DEC8D6",
      "--tutor-sidebar-border": "#EAD8E4",
      "--tutor-sidebar-text": "#6A3A50",
      "--tutor-sidebar-text-active": "#6E2A44",
      "--tutor-sidebar-text-muted": "#9E7888",
      "--tutor-surface": "#FFFFFF",
      "--tutor-border": "#D4B8C8",
      "--tutor-border-subtle": "#EAD8E4",
      "--tutor-text": "#2A1520",
      "--tutor-text-secondary": "#6A3A50",
      "--tutor-text-muted": "#9E7888",
      "--tutor-accent": "#9B5270",
      "--tutor-accent-hover": "#84415E",
      "--tutor-accent-light": "#FAE8F0",
      "--tutor-accent-text": "#6E2A44",
      "--tutor-user-bubble": "#F8E4EE",
      "--tutor-user-border": "#E0B8CE",
    },
  },
};
```

- [ ] **Step 2: Change the default preset from `"sage"` to `"navy"`**

Find this line (around line 125 in current file):

```typescript
const DEFAULT_PRESET: ThemeKey = "sage";
```

Change it to:

```typescript
const DEFAULT_PRESET: ThemeKey = "navy";
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/ThemePicker.tsx
git commit -m "design: add Navy preset, add sidebar-text tokens to all presets, set Navy as default"
```

---

## Task 3: Rewrite ThemePicker component — Button + Modal

**Files:**
- Modify: `src/components/settings/ThemePicker.tsx`

Replace everything after the `THEMES` constant and supporting functions (`tryParseJSON`, `loadCustomization`, `applyCustomization`, `saveCustomization`, `effectiveColor`) with the new component. Keep those functions unchanged.

The `COLOR_CONTROLS` constant must now include sidebar text tokens in the fine-tuning section:

```typescript
const COLOR_CONTROLS: Array<{ label: string; varKey: string }> = [
  { label: "Accent",      varKey: "--tutor-accent" },
  { label: "Background",  varKey: "--tutor-bg" },
  { label: "Sidebar",     varKey: "--tutor-sidebar" },
  { label: "User bubble", varKey: "--tutor-user-bubble" },
];
```

- [ ] **Step 1: Replace the component export in `ThemePicker.tsx`**

Delete everything from `/* ── Component ── */` to end of file, then add:

```typescript
/* ── All CSS var keys used across all presets ── */
const ALL_VAR_KEYS = Array.from(
  new Set(Object.values(THEMES).flatMap((t) => Object.keys(t.vars)))
);

/* Exposed color controls */
const COLOR_CONTROLS: Array<{ label: string; varKey: string }> = [
  { label: "Accent",      varKey: "--tutor-accent" },
  { label: "Background",  varKey: "--tutor-bg" },
  { label: "Sidebar",     varKey: "--tutor-sidebar" },
  { label: "User bubble", varKey: "--tutor-user-bubble" },
];

/* ── Main component ── */

export default function ThemePicker() {
  const [custom, setCustom] = useState<ThemeCustomization>(loadCustomization);
  const [open, setOpen] = useState(false);
  const savedCustomRef = useRef<ThemeCustomization>(custom);

  useEffect(() => {
    applyCustomization(custom);
  }, []);

  const accentColor = effectiveColor(custom, "--tutor-accent");
  const bgColor = effectiveColor(custom, "--tutor-bg");
  const sidebarColor = effectiveColor(custom, "--tutor-sidebar");

  const handleOpen = () => {
    savedCustomRef.current = custom;
    setOpen(true);
  };

  const handleApply = () => {
    saveCustomization(custom);
    savedCustomRef.current = custom;
    setOpen(false);
  };

  const handleCancel = () => {
    const reverted = savedCustomRef.current;
    setCustom(reverted);
    applyCustomization(reverted);
    setOpen(false);
  };

  const handlePreset = (key: ThemeKey) => {
    const next: ThemeCustomization = { preset: key, overrides: {} };
    setCustom(next);
    applyCustomization(next);
  };

  const handleColorChange = (varKey: string, value: string) => {
    document.documentElement.style.setProperty(varKey, value);
    setCustom((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [varKey]: value },
    }));
  };

  const handleReset = () => {
    const next: ThemeCustomization = { preset: DEFAULT_PRESET, overrides: {} };
    setCustom(next);
    applyCustomization(next);
    saveCustomization(next);
    localStorage.removeItem(LS_KEY_LEGACY);
  };

  return (
    <>
      {/* ── Sidebar footer button ── */}
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors"
        style={{
          background: "var(--tutor-sidebar-hover)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
        aria-label="Customize colors"
      >
        {/* Three live-color dots */}
        <span className="flex gap-1 flex-shrink-0">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: accentColor }}
            aria-hidden="true"
          />
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: bgColor, border: "1px solid rgba(255,255,255,0.15)" }}
            aria-hidden="true"
          />
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: sidebarColor, border: "1px solid rgba(255,255,255,0.15)" }}
            aria-hidden="true"
          />
        </span>
        <span
          className="text-xs font-medium"
          style={{ color: "var(--tutor-sidebar-text)" }}
        >
          Customize colors
        </span>
      </button>

      {/* ── Modal overlay (fixed, escapes sidebar DOM) ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(10,14,25,0.6)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Customize Colors"
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "var(--tutor-surface)",
              border: "1px solid var(--tutor-border-subtle)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              width: "400px",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{
                background: "var(--tutor-surface-raised)",
                borderBottom: "1px solid var(--tutor-border-subtle)",
              }}
            >
              <span
                className="text-sm font-bold"
                style={{ color: "var(--tutor-text)" }}
              >
                Customize Colors
              </span>
              <button
                type="button"
                onClick={handleCancel}
                className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                style={{ color: "var(--tutor-text-muted)" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Quick presets */}
              <div>
                <p
                  className="text-[9px] font-bold uppercase tracking-widest mb-3"
                  style={{ color: "var(--tutor-text-muted)" }}
                >
                  Quick Presets
                </p>
                <div className="flex gap-2">
                  {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
                    const isActive = custom.preset === key && Object.keys(custom.overrides).length === 0;
                    const bg = THEMES[key].vars["--tutor-bg"];
                    const sidebar = THEMES[key].vars["--tutor-sidebar"];
                    const accent = THEMES[key].vars["--tutor-accent"];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handlePreset(key)}
                        aria-pressed={isActive}
                        className="flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl flex-1 transition-all"
                        style={{
                          border: isActive
                            ? `2px solid ${accent}`
                            : "2px solid var(--tutor-border-subtle)",
                          background: isActive ? "var(--tutor-accent-light)" : "transparent",
                        }}
                      >
                        {/* Split circle: sidebar / accent */}
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            overflow: "hidden",
                            display: "flex",
                            border: "1px solid rgba(0,0,0,0.08)",
                            flexShrink: 0,
                          }}
                        >
                          <div style={{ flex: 1, background: sidebar }} />
                          <div style={{ flex: 1, background: accent }} />
                        </div>
                        <span
                          className="text-[9px] font-semibold"
                          style={{
                            color: isActive ? accent : "var(--tutor-text-muted)",
                          }}
                        >
                          {THEMES[key].label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fine tuning */}
              <div>
                <p
                  className="text-[9px] font-bold uppercase tracking-widest mb-3"
                  style={{ color: "var(--tutor-text-muted)" }}
                >
                  Fine Tuning
                </p>
                <div className="space-y-2">
                  {COLOR_CONTROLS.map(({ label, varKey }) => (
                    <ColorRow
                      key={varKey}
                      label={label}
                      value={effectiveColor(custom, varKey)}
                      onChange={(v) => handleColorChange(varKey, v)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{
                borderTop: "1px solid var(--tutor-border-subtle)",
                background: "var(--tutor-surface-raised)",
              }}
            >
              <button
                type="button"
                onClick={handleReset}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: "var(--tutor-text-muted)" }}
              >
                Reset to default
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-xs px-4 py-1.5 rounded-lg transition-colors"
                  style={{
                    border: "1px solid var(--tutor-border)",
                    color: "var(--tutor-text-secondary)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="text-xs px-4 py-1.5 rounded-lg font-semibold text-white transition-colors"
                  style={{ background: "var(--tutor-accent)" }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Replace the `ColorRow` sub-component**

Delete the existing `ColorRow` function and add this version (focus-based hex sync, same approach as current but cleaned up):

```typescript
function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [hexText, setHexText] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  const displayText = isFocused ? hexText : value;

  const handleFocus = () => {
    setHexText(value);
    setIsFocused(true);
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setHexText(raw);
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) onChange(raw);
  };

  const handleTextBlur = () => {
    setIsFocused(false);
    setHexText(value);
  };

  const handlePickerChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setHexText(v);
    onChange(v);
  };

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg"
      style={{
        background: "var(--tutor-surface-raised)",
        border: "1px solid var(--tutor-border-subtle)",
      }}
    >
      {/* Swatch — click opens native color picker */}
      <div className="relative flex-shrink-0" style={{ width: 20, height: 20 }}>
        <input
          ref={pickerRef}
          type="color"
          value={value}
          onChange={handlePickerChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label={`${label} color picker`}
        />
        <span
          aria-hidden="true"
          className="block w-full h-full pointer-events-none rounded"
          style={{
            background: value,
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: "4px",
          }}
        />
      </div>

      <span
        className="text-xs flex-1"
        style={{ color: "var(--tutor-text-secondary)" }}
      >
        {label}
      </span>

      {/* Editable hex */}
      <input
        type="text"
        value={displayText.toUpperCase()}
        onFocus={handleFocus}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        maxLength={7}
        className="border-none outline-none font-mono text-right"
        style={{
          fontSize: "11px",
          color: "var(--tutor-text-muted)",
          background: "transparent",
          width: "62px",
          padding: 0,
        }}
        aria-label={`${label} hex value`}
        spellCheck={false}
      />
    </div>
  );
}
```

- [ ] **Step 3: Make sure `useRef` is imported**

Check the import at the top of the file. It should be:

```typescript
import { useEffect, useRef, useState, type ChangeEvent } from "react";
```

- [ ] **Step 4: Run build and lint**

```bash
npm run build && npm run lint 2>&1 | grep "error"
```

Expected: `✓ Compiled successfully` and `0 errors`

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/ThemePicker.tsx
git commit -m "design: rewrite ThemePicker — sidebar button + modal overlay, snapshot cancel"
```

---

## Task 4: Rewrite WorkspaceSelector — LTR, English, sidebar tokens

**Files:**
- Modify: `src/components/workspaces/WorkspaceSelector.tsx`

- [ ] **Step 1: Replace the entire component file**

```typescript
"use client";

import React, { useState } from "react";
import type { WorkspaceListItem } from "../../lib/workspaces/workspaceApiTypes";
import type { SessionApiSession } from "../../lib/sessions/sessionApiTypes";

export type WorkspaceLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; workspaces: WorkspaceListItem[] };

export type SessionLoadState =
  | { status: "disabled"; message: string }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; sessions: SessionApiSession[] };

interface WorkspaceSelectorProps {
  loadState: WorkspaceLoadState;
  selectedWorkspaceId: string | null;
  onSelect: (workspaceId: string) => void;
  onCreate: (name: string) => Promise<void>;
  sessionState: SessionLoadState;
  selectedSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onCreateSession: () => Promise<void>;
  creatingSession: boolean;
  createSessionError: string | null;
}

export default function WorkspaceSelector({
  loadState,
  selectedWorkspaceId,
  onSelect,
  onCreate,
  sessionState,
  selectedSessionId,
  onSessionSelect,
  onCreateSession,
  creatingSession,
  createSessionError,
}: WorkspaceSelectorProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreatingWorkspace(true);
    setCreateError(null);
    try {
      await onCreate(trimmed);
      setNewName("");
      setShowCreate(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create.");
    } finally {
      setCreatingWorkspace(false);
    }
  };

  return (
    <div className="flex flex-col py-2" dir="ltr">
      {/* ── Topics ── */}
      <p className="section-nav-label">Topics</p>

      {loadState.status === "loading" && (
        <p className="nav-state-text">Loading...</p>
      )}
      {loadState.status === "error" && (
        <p className="nav-state-text" style={{ color: "#e87070" }}>{loadState.message}</p>
      )}

      {loadState.status === "ready" && (
        <>
          {loadState.workspaces.length === 0 ? (
            <p className="nav-state-text nav-state-empty">No topics yet</p>
          ) : (
            <ul className="space-y-0.5 px-2">
              {loadState.workspaces.map((ws) => {
                const isSelected = selectedWorkspaceId === ws.id;
                return (
                  <li key={ws.id}>
                    <NavItem
                      label={ws.name}
                      active={isSelected}
                      onClick={() => onSelect(ws.id)}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-2 mt-0.5">
            {!showCreate ? (
              <NewAction label="+ New topic" onClick={() => setShowCreate(true)} />
            ) : (
              <form onSubmit={handleCreate} className="px-1 py-2 space-y-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Topic name"
                  autoFocus
                  disabled={creatingWorkspace}
                  className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
                  style={{
                    background: "var(--tutor-surface)",
                    border: "1px solid var(--tutor-border)",
                    color: "var(--tutor-text)",
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creatingWorkspace || !newName.trim()}
                    className="flex-1 rounded-lg py-1.5 text-xs font-medium text-white disabled:opacity-40"
                    style={{ background: "var(--tutor-accent)" }}
                  >
                    {creatingWorkspace ? "Creating..." : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setNewName(""); setCreateError(null); }}
                    className="flex-1 rounded-lg py-1.5 text-xs"
                    style={{
                      border: "1px solid var(--tutor-sidebar-border)",
                      color: "var(--tutor-sidebar-text)",
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {createError && (
                  <p className="text-xs" style={{ color: "#e87070" }}>{createError}</p>
                )}
              </form>
            )}
          </div>
        </>
      )}

      {/* ── Conversations ── */}
      {selectedWorkspaceId && (
        <>
          <p className="section-nav-label" style={{ marginTop: "16px" }}>Conversations</p>

          {sessionState.status === "disabled" && (
            <p className="nav-state-text nav-state-empty">{sessionState.message}</p>
          )}
          {sessionState.status === "loading" && (
            <p className="nav-state-text">Loading...</p>
          )}
          {sessionState.status === "error" && (
            <p className="nav-state-text" style={{ color: "#e87070" }}>{sessionState.message}</p>
          )}

          {sessionState.status === "ready" && (
            <>
              {sessionState.sessions.length === 0 ? (
                <p className="nav-state-text nav-state-empty">No conversations</p>
              ) : (
                <ul className="space-y-0.5 px-2">
                  {sessionState.sessions.map((session, index) => {
                    const isActive = selectedSessionId === session.id;
                    const label = session.title?.trim() || `Conversation ${index + 1}`;
                    return (
                      <li key={session.id}>
                        <NavItem
                          label={label}
                          active={isActive}
                          small
                          onClick={() => onSessionSelect(session.id)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="px-2 mt-0.5">
                <NewAction
                  label={creatingSession ? "Creating..." : "+ New conversation"}
                  disabled={creatingSession}
                  onClick={() => { void onCreateSession(); }}
                />
              </div>

              {createSessionError && (
                <p className="px-4 text-xs" style={{ color: "#e87070" }}>
                  {createSessionError}
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── Small shared sub-components ── */

function NavItem({
  label,
  active,
  small = false,
  onClick,
}: {
  label: string;
  active: boolean;
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center px-3 rounded-lg transition-colors"
      style={{
        padding: small ? "5px 10px" : "7px 10px",
        fontSize: small ? "12px" : "13px",
        background: active ? "var(--tutor-sidebar-active)" : "transparent",
        color: active ? "var(--tutor-sidebar-text-active)" : "var(--tutor-sidebar-text)",
        fontWeight: active ? 500 : 400,
        borderLeft: active
          ? "2px solid var(--tutor-accent)"
          : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = "var(--tutor-sidebar-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

function NewAction({
  label,
  disabled = false,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40"
      style={{ color: "var(--tutor-sidebar-text-muted)" }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.color = "var(--tutor-accent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "var(--tutor-sidebar-text-muted)";
      }}
    >
      {label}
    </button>
  );
}
```

Note: The `section-nav-label` and `nav-state-text` classes don't exist in Tailwind — add them to `globals.css` in Step 2.

- [ ] **Step 2: Add utility classes to `globals.css`**

Append to the end of `src/app/globals.css`:

```css
/* WorkspaceSelector nav utilities */
.section-nav-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--tutor-sidebar-text-muted);
  padding: 10px 16px 4px;
  user-select: none;
}

.nav-state-text {
  font-size: 11px;
  padding: 4px 16px;
  color: var(--tutor-sidebar-text-muted);
}

.nav-state-empty {
  font-style: italic;
}
```

- [ ] **Step 3: Run build and lint**

```bash
npm run build && npm run lint 2>&1 | grep "error"
```

Expected: `✓ Compiled successfully`, `0 errors`

- [ ] **Step 4: Run tests**

```bash
npx vitest run
```

Expected: all previously passing tests still pass (no test covers WorkspaceSelector visual rendering)

- [ ] **Step 5: Commit**

```bash
git add src/components/workspaces/WorkspaceSelector.tsx src/app/globals.css
git commit -m "design: WorkspaceSelector — LTR, English labels, sidebar-text tokens, border-left active"
```

---

## Task 5: Update page.tsx — LTR sidebar, English panel titles

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Change sidebar wrapper from RTL to LTR**

Find this line in `page.tsx`:

```tsx
<div className="flex flex-col h-full" dir="rtl">
```

Change to:

```tsx
<div className="flex flex-col h-full" dir="ltr">
```

- [ ] **Step 2: Update sidebar header — English app name**

Find:

```tsx
<span
  className="text-lg font-semibold"
  style={{
    fontFamily: "'Lora', Georgia, serif",
    color: "var(--tutor-text)",
    letterSpacing: "-0.01em",
  }}
>
  מורה פרטי
</span>
```

Change to:

```tsx
<span
  className="text-lg font-semibold"
  style={{
    fontFamily: "'Lora', Georgia, serif",
    color: "var(--tutor-sidebar-text-active)",
    letterSpacing: "-0.01em",
  }}
>
  Private Tutor
</span>
```

- [ ] **Step 3: Update sidebar header border to use sidebar token**

Find the header div style:

```tsx
style={{ borderBottom: "1px solid var(--tutor-border)" }}
```

Change to:

```tsx
style={{ borderBottom: "1px solid var(--tutor-sidebar-border)" }}
```

- [ ] **Step 4: Update CollapsiblePanel titles to English**

Find:

```tsx
<CollapsiblePanel
  title="חומרי לימוד"
  itemCount={mockFiles.length}
  defaultOpen={false}
>
```

Change to:

```tsx
<CollapsiblePanel
  title="Study materials"
  itemCount={mockFiles.length}
  defaultOpen={false}
>
```

Find:

```tsx
<CollapsiblePanel
  title="זיכרון למידה"
  defaultOpen={false}
>
```

Change to:

```tsx
<CollapsiblePanel
  title="Tutor memory"
  defaultOpen={false}
>
```

- [ ] **Step 5: Update CollapsiblePanel to use sidebar tokens**

Open `src/components/layout/CollapsiblePanel.tsx`. The toggle button currently uses `var(--tutor-text-secondary)`. Update:

```tsx
// Find:
style={{ color: "var(--tutor-text-secondary)" }}
// Change to:
style={{ color: "var(--tutor-sidebar-text)" }}
```

And:

```tsx
// Find:
className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium transition-colors hover:bg-[var(--tutor-sidebar-hover)]"
// Already correct — --tutor-sidebar-hover works for both dark/light
```

And the item count badge:

```tsx
// Find:
style={{ background: "var(--tutor-border)", color: "var(--tutor-text-muted)" }}
// Change to:
style={{ background: "var(--tutor-sidebar-active)", color: "var(--tutor-sidebar-text-muted)" }}
```

And the border-top on the CollapsiblePanel wrapper:

```tsx
// Find:
style={{ borderTop: "1px solid var(--tutor-border-subtle)" }}
// Change to:
style={{ borderTop: "1px solid var(--tutor-sidebar-border)" }}
```

- [ ] **Step 6: Build and lint**

```bash
npm run build && npm run lint 2>&1 | grep "error"
```

Expected: `✓ Compiled successfully`, `0 errors`

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/components/layout/CollapsiblePanel.tsx
git commit -m "design: sidebar LTR, English app name and panel titles, sidebar token colors"
```

---

## Task 6: Update WorkModeSelector — English labels, LTR

**Files:**
- Modify: `src/components/workModes/WorkModeSelector.tsx`

- [ ] **Step 1: Replace Hebrew label map and remove RTL from container**

```typescript
const modeLabels: Record<WorkMode, string> = {
  Learning: "Learn",
  Practice: "Practice",
  Research: "Research",
  Build: "Build",
  "Temporary Chat": "Temp Chat",
};
```

Find the outer div:

```tsx
<div className="flex items-center gap-1" dir="rtl">
```

Change to:

```tsx
<div className="flex items-center gap-1" dir="ltr">
```

- [ ] **Step 2: Fix dropdown alignment to LTR**

Find in the dropdown div:

```tsx
style={{
  background: "var(--tutor-surface)",
  border: "1px solid var(--tutor-border)",
  boxShadow: "var(--tutor-shadow)",
  right: 0,
}}
```

Change `right: 0` to `left: 0`:

```tsx
style={{
  background: "var(--tutor-surface)",
  border: "1px solid var(--tutor-border)",
  boxShadow: "var(--tutor-shadow)",
  left: 0,
}}
```

- [ ] **Step 3: Fix dropdown button text alignment**

Find all dropdown item buttons:

```tsx
className="w-full text-right px-3 py-2 text-xs transition-colors"
```

Change to:

```tsx
className="w-full text-left px-3 py-2 text-xs transition-colors"
```

- [ ] **Step 4: Update aria-label to English**

```tsx
// Find:
title="מצבים נוספים"
aria-label="מצבים נוספים"
// Change to:
title="More modes"
aria-label="More modes"
```

- [ ] **Step 5: Build and lint**

```bash
npm run build && npm run lint 2>&1 | grep "error"
```

Expected: `✓ Compiled successfully`, `0 errors`

- [ ] **Step 6: Commit**

```bash
git add src/components/workModes/WorkModeSelector.tsx
git commit -m "design: WorkModeSelector — English labels, LTR layout"
```

---

## Task 7: Update CostModeSelector — English labels, LTR

**Files:**
- Modify: `src/components/costModes/CostModeSelector.tsx`

- [ ] **Step 1: Replace Hebrew label map and remove RTL**

```typescript
const modeLabels: Record<CostMode, string> = {
  "Normal Learning": "Normal",
  "Cheap Practice": "Cheap",
  "Deep Research": "Deep",
};
```

Find outer div:

```tsx
<div ref={ref} className="relative" dir="rtl">
```

Change to:

```tsx
<div ref={ref} className="relative" dir="ltr">
```

- [ ] **Step 2: Fix dropdown alignment and button text alignment**

Find in the dropdown div:

```tsx
style={{
  background: "var(--tutor-surface)",
  border: "1px solid var(--tutor-border)",
  boxShadow: "var(--tutor-shadow)",
  right: 0,
}}
```

Change to `left: 0`:

```tsx
style={{
  background: "var(--tutor-surface)",
  border: "1px solid var(--tutor-border)",
  boxShadow: "var(--tutor-shadow)",
  left: 0,
}}
```

Find dropdown item buttons:

```tsx
className="w-full text-right px-3 py-2 text-xs transition-colors"
```

Change to:

```tsx
className="w-full text-left px-3 py-2 text-xs transition-colors"
```

- [ ] **Step 3: Update aria-labels to English**

```tsx
// Find:
title="איכות תשובה"
aria-label="בחר איכות תשובה"
// Change to:
title="Response quality"
aria-label="Select response quality"
```

- [ ] **Step 4: Build and lint**

```bash
npm run build && npm run lint 2>&1 | grep "error"
```

Expected: `✓ Compiled successfully`, `0 errors`

- [ ] **Step 5: Commit**

```bash
git add src/components/costModes/CostModeSelector.tsx
git commit -m "design: CostModeSelector — English labels, LTR layout"
```

---

## Task 8: Update TutorConversation — English placeholder, LTR textarea

**Files:**
- Modify: `src/components/tutor/TutorConversation.tsx`

- [ ] **Step 1: Update textarea placeholder and remove hardcoded RTL**

Find:

```tsx
placeholder="שאל את המורה..."
className="w-full resize-none rounded-2xl px-5 py-3.5 pr-14 text-sm outline-none transition-all"
style={{
  background: "var(--tutor-surface)",
  border: "1px solid var(--tutor-border)",
  color: "var(--tutor-text)",
  boxShadow: "var(--tutor-shadow-sm)",
  minHeight: "52px",
  maxHeight: "140px",
  direction: "rtl",
}}
```

Change to:

```tsx
placeholder="Type a message..."
className="w-full resize-none rounded-2xl px-5 py-3.5 pr-14 text-sm outline-none transition-all"
style={{
  background: "var(--tutor-surface)",
  border: "1px solid var(--tutor-border)",
  color: "var(--tutor-text)",
  boxShadow: "var(--tutor-shadow-sm)",
  minHeight: "52px",
  maxHeight: "140px",
}}
```

(Remove `direction: "rtl"` — `dir="auto"` already on the element handles Hebrew input correctly.)

- [ ] **Step 2: Update send button aria-label**

Find:

```tsx
aria-label="שלח"
```

Change to:

```tsx
aria-label="Send"
```

- [ ] **Step 3: Build and lint**

```bash
npm run build && npm run lint 2>&1 | grep "error"
```

Expected: `✓ Compiled successfully`, `0 errors`

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/tutor/TutorConversation.tsx
git commit -m "design: TutorConversation — English placeholder, remove hardcoded RTL from textarea"
```

---

## Task 9: Final verification and push

- [ ] **Step 1: Clean build from scratch**

```bash
rm -rf .next && npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 2: Lint — zero errors**

```bash
npm run lint 2>&1 | grep "error"
```

Expected: `✖ N problems (0 errors, ...)`

- [ ] **Step 3: All tests pass**

```bash
npx vitest run
```

Expected: `146 passed`, 0 failed

- [ ] **Step 4: Confirm no unintended files staged**

```bash
git status --short
```

Confirm NOT staged: `.codex/`, `design-input/`, `firebase-debug.log`, `firestore-debug.log`, `*.log`, `.env*`

- [ ] **Step 5: Push**

```bash
git push origin design/personal-tutor-ux-redesign
```

---

## Manual Smoke Checklist

After running `npm run dev` and signing in:

- [ ] Sidebar is dark navy — not beige
- [ ] All sidebar text is light colored, legible on dark background
- [ ] Topics section shows "Topics" in uppercase muted label
- [ ] Active topic has left-border accent + tinted background
- [ ] Conversations section shows "Conversations" in uppercase muted label
- [ ] "Study materials" and "Tutor memory" collapsible panels visible in English
- [ ] "Customize colors" button visible in sidebar footer with 3 color dots
- [ ] Clicking button opens a centered modal overlay (app dimmed behind)
- [ ] Modal shows 6 preset circles: Navy (active), Sage, Blue, Warm, Slate, Rose
- [ ] Modal shows 4 fine-tuning rows with clickable swatches and editable hex inputs
- [ ] Changing a color → app updates in real time behind the modal
- [ ] Cancel → colors revert to state before modal opened
- [ ] Apply → modal closes, colors persist after refresh
- [ ] Reset to default → restores Navy preset
- [ ] Switching preset → fine-tuning hex inputs update to match
- [ ] Toolbar shows: Learn | Practice | More ▾ | Normal ▾ (all English, LTR)
- [ ] Chat bubbles: Hebrew text inside, right-aligned, but bubbles in LTR positions
- [ ] Input placeholder reads "Type a message..." (English, LTR input direction)
- [ ] No Hebrew anywhere in chrome (sidebar, toolbar, panels, buttons)
