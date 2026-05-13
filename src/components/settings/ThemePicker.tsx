"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

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

export interface ThemeCustomization {
  preset: ThemeKey;
  overrides: Record<string, string>;
}

const DEFAULT_PRESET: ThemeKey = "navy";
const LS_KEY = "tutor-theme-customization";
const LS_KEY_LEGACY = "tutor-theme";

const COLOR_CONTROLS: Array<{ label: string; varKey: string }> = [
  { label: "Accent", varKey: "--tutor-accent" },
  { label: "Background", varKey: "--tutor-bg" },
  { label: "Sidebar", varKey: "--tutor-sidebar" },
  { label: "User msg", varKey: "--tutor-user-bubble" },
];

function tryParseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadCustomization(): ThemeCustomization {
  if (typeof window === "undefined") return { preset: DEFAULT_PRESET, overrides: {} };

  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    const parsed = tryParseJSON(raw);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "preset" in (parsed as object) &&
      typeof (parsed as { preset: unknown }).preset === "string" &&
      (parsed as { preset: string }).preset in THEMES
    ) {
      return parsed as ThemeCustomization;
    }
  }

  const legacy = localStorage.getItem(LS_KEY_LEGACY) as ThemeKey | null;
  if (legacy && legacy in THEMES) return { preset: legacy, overrides: {} };

  return { preset: DEFAULT_PRESET, overrides: {} };
}

function applyCustomization(c: ThemeCustomization): void {
  const base = THEMES[c.preset].vars;
  for (const [prop, value] of Object.entries(base)) {
    document.documentElement.style.setProperty(prop, value);
  }
  for (const [prop, value] of Object.entries(c.overrides)) {
    document.documentElement.style.setProperty(prop, value);
  }
}

function saveCustomization(c: ThemeCustomization): void {
  localStorage.setItem(LS_KEY, JSON.stringify(c));
}

function effectiveColor(c: ThemeCustomization, varKey: string): string {
  return c.overrides[varKey] ?? THEMES[c.preset].vars[varKey] ?? "#000000";
}

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
    savedCustomRef.current = next;
    setOpen(false);
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

      {/* ── Modal overlay (position:fixed escapes sidebar DOM) ── */}
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
                    const isActive =
                      custom.preset === key &&
                      Object.keys(custom.overrides).length === 0;
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
                          background: isActive
                            ? "var(--tutor-accent-light)"
                            : "transparent",
                        }}
                      >
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

/* ── ColorRow sub-component ── */

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
          className="block w-full h-full pointer-events-none"
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
