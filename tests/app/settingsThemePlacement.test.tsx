import { describe, expect, it } from "vitest";
import React from "react";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import SettingsPage from "../../src/app/settings/page";

describe("settings theme placement", () => {
  it("renders the workspace palette controls in Settings", () => {
    const html = renderToStaticMarkup(<SettingsPage />);
    expect(html).toContain("Workspace palette");
    expect(html).toContain('data-testid="theme-picker-trigger"');
    expect(html).toContain("Customize palette");
  });

  it("does not render ThemePicker in the daily sidebar page", () => {
    const homeSource = fs.readFileSync(
      "/Users/nevobiton/private-tutor-project/privateTutor/src/app/page.tsx",
      "utf8"
    );

    expect(homeSource).not.toContain('import ThemePicker from "../components/settings/ThemePicker";');
    expect(homeSource).not.toContain("<ThemePicker />");
  });
});
