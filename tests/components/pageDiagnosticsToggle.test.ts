import { describe, expect, it } from "vitest";
import {
  DEV_DIAGNOSTICS_STORAGE_KEY,
  parseDeveloperDiagnosticsFlag,
  serializeDeveloperDiagnosticsFlag,
} from "../../src/lib/settings/settingsPreferences";

describe("developer diagnostics toggle persistence helpers", () => {
  it("uses the expected localStorage key", () => {
    expect(DEV_DIAGNOSTICS_STORAGE_KEY).toBe("privateTutor.devDiagnostics.enabled");
  });

  it("parses only \"true\" as enabled", () => {
    expect(parseDeveloperDiagnosticsFlag("true")).toBe(true);
    expect(parseDeveloperDiagnosticsFlag("false")).toBe(false);
    expect(parseDeveloperDiagnosticsFlag(null)).toBe(false);
    expect(parseDeveloperDiagnosticsFlag("1")).toBe(false);
  });

  it("serializes boolean value correctly", () => {
    expect(serializeDeveloperDiagnosticsFlag(true)).toBe("true");
    expect(serializeDeveloperDiagnosticsFlag(false)).toBe("false");
  });
});
