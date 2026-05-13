"use client";

import { useEffect, useState } from "react";

export type ThemeKey = "sage" | "blue" | "warm" | "slate" | "rose";

interface ThemePreset {
  label: string;
  vars: Record<string, string>;
}

export const THEMES: Record<ThemeKey, ThemePreset> = {
  sage: {
    label: "Sage",
    vars: {
      "--tutor-bg": "#F8F4EF",
      "--tutor-sidebar": "#EDE7DC",
      "--tutor-sidebar-hover": "#E3DDD0",
      "--tutor-sidebar-active": "#D8D0C4",
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

const DEFAULT_PRESET: ThemeKey = "sage";
const LS_KEY = "tutor-theme-customization";
const LS_KEY_LEGACY = "tutor-theme";

/* Exposed color controls — the four most impactful custom knobs */
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

  /* Backwards compat: migrate from old "tutor-theme" key */
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

/* ── Component ── */

export default function ThemePicker() {
  const [custom, setCustom] = useState<ThemeCustomization>(loadCustomization);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    applyCustomization(custom);
  }, [custom]);

  const handlePreset = (key: ThemeKey) => {
    const next: ThemeCustomization = { preset: key, overrides: {} };
    setCustom(next);
    saveCustomization(next);
  };

  const handleColorChange = (varKey: string, value: string) => {
    /* Apply immediately for smooth live preview during color picker drag */
    document.documentElement.style.setProperty(varKey, value);
    setCustom((prev) => {
      const next: ThemeCustomization = {
        ...prev,
        overrides: { ...prev.overrides, [varKey]: value },
      };
      saveCustomization(next);
      return next;
    });
  };

  const handleReset = () => {
    const next: ThemeCustomization = { preset: DEFAULT_PRESET, overrides: {} };
    setCustom(next);
    saveCustomization(next);
    localStorage.removeItem(LS_KEY_LEGACY);
  };

  const accentColor = effectiveColor(custom, "--tutor-accent");

  return (
    <div style={{ borderTop: "1px solid var(--tutor-border-subtle)" }}>
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium transition-colors"
        style={{ color: "var(--tutor-text-secondary)" }}
        dir="ltr"
        aria-expanded={open}
        aria-controls="appearance-panel"
      >
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 200ms",
              fontSize: "10px",
            }}
          >
            ▾
          </span>
          Appearance
        </span>
        {/* Live accent preview dot */}
        <span
          aria-hidden="true"
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ background: accentColor }}
        />
      </button>

      {open && (
        <div
          id="appearance-panel"
          className="px-4 pb-4 space-y-3"
          dir="ltr"
        >
          {/* Preset row */}
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "var(--tutor-text-muted)" }}
            >
              Preset
            </p>
            <div className="flex items-center gap-1 flex-wrap">
              {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
                const isActive = custom.preset === key;
                const swatch = THEMES[key].vars["--tutor-accent"];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePreset(key)}
                    aria-label={`${THEMES[key].label} preset${isActive ? " (selected)" : ""}`}
                    aria-pressed={isActive}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all"
                    style={{
                      background: isActive ? swatch : "var(--tutor-border-subtle)",
                      color: isActive ? "#fff" : "var(--tutor-text-secondary)",
                      border: isActive ? "none" : "1px solid var(--tutor-border)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: isActive ? "rgba(255,255,255,0.6)" : swatch }}
                    />
                    {THEMES[key].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual color controls */}
          <div className="space-y-2">
            <p
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--tutor-text-muted)" }}
            >
              Custom
            </p>
            {COLOR_CONTROLS.map(({ label, varKey }) => (
              <ColorRow
                key={varKey}
                label={label}
                value={effectiveColor(custom, varKey)}
                onChange={(v) => handleColorChange(varKey, v)}
              />
            ))}
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={handleReset}
            className="w-full text-[10px] px-2.5 py-1.5 rounded-md transition-colors text-center"
            style={{
              border: "1px solid var(--tutor-border)",
              color: "var(--tutor-text-muted)",
            }}
            aria-label="Reset appearance to default Sage theme"
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Color row sub-component ── */

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[11px] flex-shrink-0"
        style={{ color: "var(--tutor-text-secondary)", minWidth: "68px" }}
      >
        {label}
      </span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {/* Color swatch + native picker */}
        <div className="relative flex-shrink-0" style={{ width: "22px", height: "22px" }}>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={`${label} color`}
            title={`${label}: ${value}`}
          />
          <span
            aria-hidden="true"
            className="block w-full h-full rounded pointer-events-none"
            style={{
              background: value,
              border: "1px solid var(--tutor-border)",
              borderRadius: "4px",
            }}
          />
        </div>
        {/* Hex value display */}
        <span
          className="text-[10px] font-mono tabular-nums truncate"
          style={{ color: "var(--tutor-text-muted)" }}
          aria-live="polite"
          aria-label={`${label} hex value: ${value}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
