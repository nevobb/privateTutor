"use client";

import React, { useEffect, useState } from "react";
import ThemePicker from "../../components/settings/ThemePicker";

const CHAT_FONT_SIZE_KEY = "tutor-chat-font-size";
const CHAT_MAX_WIDTH_KEY = "tutor-chat-max-width";
const DEV_DIAGNOSTICS_KEY = "privateTutor.devDiagnostics.enabled";

const FONT_SIZE_OPTIONS = [
  { label: "Small", value: "13px" },
  { label: "Default", value: "15px" },
  { label: "Large", value: "17px" },
  { label: "X-Large", value: "19px" },
];

const CHAT_WIDTH_OPTIONS = [
  { label: "Narrow", value: "520px" },
  { label: "Default", value: "680px" },
  { label: "Wide", value: "820px" },
  { label: "Full", value: "95%" },
];

function applyVar(varName: string, value: string): void {
  document.documentElement.style.setProperty(varName, value);
}

function loadSetting(key: string, defaultValue: string): string {
  if (typeof window === "undefined") return defaultValue;
  return localStorage.getItem(key) ?? defaultValue;
}

function saveSetting(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export default function SettingsPage() {
  const [fontSize, setFontSize] = useState("15px");
  const [chatWidth, setChatWidth] = useState("680px");
  const [devDiagnostics, setDevDiagnostics] = useState(false);

  useEffect(() => {
    const f = loadSetting(CHAT_FONT_SIZE_KEY, "15px");
    const w = loadSetting(CHAT_MAX_WIDTH_KEY, "680px");
    const d = loadSetting(DEV_DIAGNOSTICS_KEY, "false") === "true";
    setFontSize(f);
    setChatWidth(w);
    setDevDiagnostics(d);
    applyVar("--tutor-chat-font-size", f);
    applyVar("--tutor-chat-max-width", w);
  }, []);

  const handleFontSize = (value: string) => {
    setFontSize(value);
    applyVar("--tutor-chat-font-size", value);
    saveSetting(CHAT_FONT_SIZE_KEY, value);
  };

  const handleChatWidth = (value: string) => {
    setChatWidth(value);
    applyVar("--tutor-chat-max-width", value);
    saveSetting(CHAT_MAX_WIDTH_KEY, value);
  };

  const handleDevDiagnostics = (enabled: boolean) => {
    setDevDiagnostics(enabled);
    saveSetting(DEV_DIAGNOSTICS_KEY, enabled ? "true" : "false");
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--tutor-bg)", color: "var(--tutor-text)" }}>
      {/* Header */}
      <div
        className="px-8 py-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid var(--tutor-border-subtle)", background: "var(--tutor-surface)" }}
      >
        <a
          href="/"
          className="flex items-center gap-1 text-sm transition-colors"
          style={{ color: "var(--tutor-text-muted)", textDecoration: "none" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--tutor-accent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--tutor-text-muted)"; }}
        >
          ‹ Back
        </a>
        <span style={{ color: "var(--tutor-border)" }}>|</span>
        <h1
          className="text-sm font-semibold"
          style={{ fontFamily: "'Lora', Georgia, serif", color: "var(--tutor-text)" }}
        >
          Settings
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-8 space-y-10">

        {/* Display */}
        <section>
          <SectionHeader title="Display" />
          <div className="space-y-3">
            <SettingRow
              label="Chat font size"
              description="Size of text in chat message bubbles."
            >
              <div className="flex gap-2 flex-wrap">
                {FONT_SIZE_OPTIONS.map((opt) => (
                  <OptionPill
                    key={opt.value}
                    label={opt.label}
                    active={fontSize === opt.value}
                    onClick={() => handleFontSize(opt.value)}
                  />
                ))}
              </div>
            </SettingRow>
            <SettingRow
              label="Message width"
              description="Maximum width of each chat message bubble."
            >
              <div className="flex gap-2 flex-wrap">
                {CHAT_WIDTH_OPTIONS.map((opt) => (
                  <OptionPill
                    key={opt.value}
                    label={opt.label}
                    active={chatWidth === opt.value}
                    onClick={() => handleChatWidth(opt.value)}
                  />
                ))}
              </div>
            </SettingRow>
          </div>
        </section>

        {/* Appearance */}
        <section>
          <SectionHeader title="Appearance" />
          <div
            className="rounded-xl p-4"
            style={{ background: "var(--tutor-surface)", border: "1px solid var(--tutor-border-subtle)" }}
          >
            <p className="text-xs mb-3" style={{ color: "var(--tutor-text-secondary)" }}>
              Click &ldquo;Customize colors&rdquo; to change the color theme.
            </p>
            <ThemePicker />
          </div>
        </section>

        {/* Advanced */}
        <section>
          <SectionHeader title="Advanced" />
          <SettingRow
            label="Developer diagnostics"
            description="Show the decision log panel in the chat area. Useful for debugging tutor behavior."
          >
            <ToggleSwitch
              id="settings-dev-diagnostics"
              enabled={devDiagnostics}
              onChange={handleDevDiagnostics}
            />
          </SettingRow>
        </section>

      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-4 pb-2" style={{ borderBottom: "1px solid var(--tutor-border-subtle)" }}>
      <h2
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--tutor-text-muted)" }}
      >
        {title}
      </h2>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start justify-between gap-6 p-4 rounded-xl"
      style={{ background: "var(--tutor-surface)", border: "1px solid var(--tutor-border-subtle)" }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: "var(--tutor-text)" }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--tutor-text-muted)" }}>{description}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function OptionPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
      style={{
        background: active ? "var(--tutor-accent)" : "var(--tutor-border-subtle)",
        color: active ? "#FFFFFF" : "var(--tutor-text-secondary)",
        border: active ? "1px solid var(--tutor-accent)" : "1px solid var(--tutor-border)",
      }}
    >
      {label}
    </button>
  );
}

function ToggleSwitch({ id, enabled, onChange }: { id: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
      style={{ background: enabled ? "var(--tutor-accent)" : "var(--tutor-border)" }}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}
