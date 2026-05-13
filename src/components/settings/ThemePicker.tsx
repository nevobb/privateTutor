"use client";

import { useEffect, useState } from "react";

export type ThemeKey = "sage" | "blue" | "warm" | "slate" | "rose";

interface ThemePreset {
  label: string;
  swatch: string;
  vars: Record<string, string>;
}

export const THEMES: Record<ThemeKey, ThemePreset> = {
  sage: {
    label: "Sage",
    swatch: "#4D7E62",
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
    swatch: "#3B6FBF",
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
    swatch: "#8B5E3C",
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
    swatch: "#4A6B8A",
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
    swatch: "#9B5270",
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

const LS_KEY = "tutor-theme";

export function applyTheme(key: ThemeKey): void {
  const preset = THEMES[key];
  for (const [prop, value] of Object.entries(preset.vars)) {
    document.documentElement.style.setProperty(prop, value);
  }
}

function getInitialTheme(): ThemeKey {
  if (typeof window === "undefined") return "sage";
  const saved = localStorage.getItem(LS_KEY) as ThemeKey | null;
  return saved && saved in THEMES ? saved : "sage";
}

export default function ThemePicker() {
  const [active, setActive] = useState<ThemeKey>(getInitialTheme);

  /* Apply theme vars to DOM on mount and whenever active changes */
  useEffect(() => {
    applyTheme(active);
  }, [active]);

  const handleSelect = (key: ThemeKey) => {
    setActive(key);
    applyTheme(key);
    localStorage.setItem(LS_KEY, key);
  };

  return (
    <div
      className="px-4 py-3 flex items-center gap-2.5"
      dir="ltr"
      style={{ borderTop: "1px solid var(--tutor-border-subtle)" }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-wider flex-shrink-0"
        style={{ color: "var(--tutor-text-muted)" }}
      >
        Theme
      </span>
      <div className="flex items-center gap-1.5">
        {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key)}
              title={THEMES[key].label}
              aria-label={`${THEMES[key].label} theme${isActive ? " (selected)" : ""}`}
              aria-pressed={isActive}
              className="w-5 h-5 rounded-full flex-shrink-0 transition-all"
              style={{
                background: THEMES[key].swatch,
                outline: isActive
                  ? `2px solid ${THEMES[key].swatch}`
                  : "2px solid transparent",
                outlineOffset: "2px",
                transform: isActive ? "scale(1.2)" : "scale(1)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
