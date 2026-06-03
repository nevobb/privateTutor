import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  applyStoredDisplayPreferences,
  saveChatFontSizePreference,
  saveChatWidthPreference,
  saveDevDiagnosticsPreference,
} from "../../src/lib/settings/settingsPreferences";

function createMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function createStyleTarget() {
  const values = new Map<string, string>();

  return {
    values,
    setProperty(name: string, value: string) {
      values.set(name, value);
    },
  };
}

describe("settings navigation and persistence", () => {
  it("uses client navigation for Settings entry and Back link", () => {
    const homeSource = fs.readFileSync(
      "/Users/nevobiton/private-tutor-project/privateTutor/src/app/page.tsx",
      "utf8"
    );
    const settingsSource = fs.readFileSync(
      "/Users/nevobiton/private-tutor-project/privateTutor/src/app/settings/page.tsx",
      "utf8"
    );

    expect(homeSource).toContain('import Link from "next/link";');
    expect(homeSource).toContain("<Link");
    expect(homeSource).not.toContain('<a\n              href="/settings"');

    expect(settingsSource).toContain('import Link from "next/link";');
    expect(settingsSource).toContain("<Link");
    expect(settingsSource).not.toContain('<a\n          href="/"');
  });

  it("initializes developer diagnostics from storage instead of overwriting it on mount", () => {
    const homeSource = fs.readFileSync(
      "/Users/nevobiton/private-tutor-project/privateTutor/src/app/page.tsx",
      "utf8"
    );

    expect(homeSource).toContain("readStoredDevDiagnosticsPreference(window.localStorage)");
    expect(homeSource).not.toContain("setDeveloperDiagnosticsEnabled(false);");
  });

  it("allows localhost-style dev origins needed for Settings hydration checks", () => {
    const nextConfig = fs.readFileSync(
      "/Users/nevobiton/private-tutor-project/privateTutor/next.config.ts",
      "utf8"
    );

    expect(nextConfig).toContain("allowedDevOrigins");
    expect(nextConfig).toContain('"127.0.0.1"');
    expect(nextConfig).toContain('"localhost"');
  });

  it("writes font size preference to storage and CSS variables", () => {
    const storage = createMemoryStorage();
    const style = createStyleTarget();

    saveChatFontSizePreference(storage, style, "17px");

    expect(storage.getItem("tutor-chat-font-size")).toBe("17px");
    expect(style.values.get("--tutor-chat-font-size")).toBe("17px");
  });

  it("writes chat width preference to storage and CSS variables", () => {
    const storage = createMemoryStorage();
    const style = createStyleTarget();

    saveChatWidthPreference(storage, style, "820px");

    expect(storage.getItem("tutor-chat-max-width")).toBe("820px");
    expect(style.values.get("--tutor-chat-max-width")).toBe("820px");
  });

  it("writes developer diagnostics preference to storage", () => {
    const storage = createMemoryStorage();

    saveDevDiagnosticsPreference(storage, true);

    expect(storage.getItem("privateTutor.devDiagnostics.enabled")).toBe("true");
  });

  it("applies stored display preferences back onto the root style target", () => {
    const storage = createMemoryStorage({
      "tutor-chat-font-size": "19px",
      "tutor-chat-max-width": "95%",
    });
    const style = createStyleTarget();

    const preferences = applyStoredDisplayPreferences(storage, style);

    expect(preferences).toEqual({
      fontSize: "19px",
      chatWidth: "95%",
    });
    expect(style.values.get("--tutor-chat-font-size")).toBe("19px");
    expect(style.values.get("--tutor-chat-max-width")).toBe("95%");
  });
});
