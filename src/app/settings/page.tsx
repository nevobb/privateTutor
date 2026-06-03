"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import ThemePicker from "../../components/settings/ThemePicker";
import { SectionHeader, StatusPill } from "../../components/ui/TutorUI";
import {
  applyStoredDisplayPreferences,
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_CHAT_MAX_WIDTH,
  readStoredDevDiagnosticsPreference,
  saveChatFontSizePreference,
  saveChatWidthPreference,
  saveDevDiagnosticsPreference,
} from "../../lib/settings/settingsPreferences";

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

export default function SettingsPage() {
  const [fontSize, setFontSize] = useState(DEFAULT_CHAT_FONT_SIZE);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_MAX_WIDTH);
  const [devDiagnostics, setDevDiagnostics] = useState(false);

  useEffect(() => {
    const preferences = applyStoredDisplayPreferences(
      window.localStorage,
      document.documentElement.style
    );
    setFontSize(preferences.fontSize);
    setChatWidth(preferences.chatWidth);
    setDevDiagnostics(readStoredDevDiagnosticsPreference(window.localStorage));
  }, []);

  const handleFontSize = (value: string) => {
    setFontSize(value);
    saveChatFontSizePreference(window.localStorage, document.documentElement.style, value);
  };

  const handleChatWidth = (value: string) => {
    setChatWidth(value);
    saveChatWidthPreference(window.localStorage, document.documentElement.style, value);
  };

  const handleDevDiagnostics = (enabled: boolean) => {
    setDevDiagnostics(enabled);
    saveDevDiagnosticsPreference(window.localStorage, enabled);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--tutor-bg)", color: "var(--tutor-text)" }}>
      <div
        className="px-8 py-6 flex items-center justify-between gap-4"
        style={{
          borderBottom: "1px solid var(--tutor-border-subtle)",
          background: "rgba(255,255,255,0.58)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--tutor-text-muted)" }}>
            Private Tutor
          </p>
          <h1
            className="mt-1 text-2xl font-semibold"
            style={{ fontFamily: "'Lora', Georgia, serif", color: "var(--tutor-text)" }}
          >
            Settings
          </h1>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1 rounded-full px-4 py-2 text-sm transition-colors"
          style={{
            color: "var(--tutor-text-secondary)",
            border: "1px solid var(--tutor-border)",
            textDecoration: "none",
            background: "var(--tutor-surface)",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--tutor-accent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--tutor-border)"; }}
        >
          ‹ Back
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-12 space-y-12">
        <section>
          <SectionHeader title="Display" eyebrow="Reading comfort" />
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

        <section>
          <SectionHeader title="Appearance" eyebrow="Palette" />
          <div
            className="rounded-[24px] p-6"
            style={{
              background: "var(--tutor-surface)",
              border: "1px solid var(--tutor-border-subtle)",
              boxShadow: "var(--tutor-card-shadow)",
            }}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-medium" style={{ color: "var(--tutor-text)" }}>
                  Workspace palette
                </p>
                <p className="text-sm mt-1 leading-6" style={{ color: "var(--tutor-text-muted)" }}>
                  Keep the daily workspace calm and consistent from one place. Palette selection no longer lives in the sidebar.
                </p>
              </div>
              <StatusPill label="Live preview" tone="accent" />
            </div>
            <ThemePicker />
          </div>
        </section>

        <section>
          <SectionHeader title="Advanced" eyebrow="Diagnostics" />
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
      className="flex items-start justify-between gap-6 p-5 rounded-[20px]"
      style={{
        background: "var(--tutor-surface)",
        border: "1px solid var(--tutor-border-subtle)",
        boxShadow: "var(--tutor-card-shadow)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium" style={{ color: "var(--tutor-text)" }}>{label}</p>
        <p className="text-sm mt-1 leading-6" style={{ color: "var(--tutor-text-muted)" }}>{description}</p>
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
      className="px-4 py-2 rounded-full text-sm font-medium transition-all"
      style={{
        background: active ? "var(--tutor-accent)" : "var(--tutor-border-subtle)",
        color: active ? "#FFFFFF" : "var(--tutor-text-secondary)",
        border: active ? "1px solid var(--tutor-accent)" : "1px solid var(--tutor-border)",
        boxShadow: active ? "var(--tutor-shadow-sm)" : "none",
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
      className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors"
      style={{
        background: enabled ? "var(--tutor-accent)" : "var(--tutor-border)",
        boxShadow: enabled ? "var(--tutor-shadow-sm)" : "none",
      }}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}
