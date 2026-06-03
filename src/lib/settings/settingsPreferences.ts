export const CHAT_FONT_SIZE_KEY = "tutor-chat-font-size";
export const CHAT_MAX_WIDTH_KEY = "tutor-chat-max-width";
export const DEV_DIAGNOSTICS_STORAGE_KEY = "privateTutor.devDiagnostics.enabled";

export const DEFAULT_CHAT_FONT_SIZE = "15px";
export const DEFAULT_CHAT_MAX_WIDTH = "680px";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type StyleTarget = Pick<CSSStyleDeclaration, "setProperty">;

export function parseDeveloperDiagnosticsFlag(raw: string | null): boolean {
  return raw === "true";
}

export function serializeDeveloperDiagnosticsFlag(enabled: boolean): string {
  return enabled ? "true" : "false";
}

function readStoredSetting(
  storage: Pick<StorageLike, "getItem">,
  key: string,
  fallback: string
): string {
  try {
    return storage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStoredSetting(storage: StorageLike, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage write errors to keep the UI responsive.
  }
}

function applyRootVar(styleTarget: StyleTarget, name: string, value: string): void {
  styleTarget.setProperty(name, value);
}

export function applyStoredDisplayPreferences(
  storage: Pick<StorageLike, "getItem">,
  styleTarget: StyleTarget
): { fontSize: string; chatWidth: string } {
  const fontSize = readStoredSetting(storage, CHAT_FONT_SIZE_KEY, DEFAULT_CHAT_FONT_SIZE);
  const chatWidth = readStoredSetting(storage, CHAT_MAX_WIDTH_KEY, DEFAULT_CHAT_MAX_WIDTH);

  applyRootVar(styleTarget, "--tutor-chat-font-size", fontSize);
  applyRootVar(styleTarget, "--tutor-chat-max-width", chatWidth);

  return { fontSize, chatWidth };
}

export function readStoredDevDiagnosticsPreference(
  storage: Pick<StorageLike, "getItem">
): boolean {
  return parseDeveloperDiagnosticsFlag(
    readStoredSetting(storage, DEV_DIAGNOSTICS_STORAGE_KEY, "false")
  );
}

export function saveChatFontSizePreference(
  storage: StorageLike,
  styleTarget: StyleTarget,
  value: string
): void {
  applyRootVar(styleTarget, "--tutor-chat-font-size", value);
  writeStoredSetting(storage, CHAT_FONT_SIZE_KEY, value);
}

export function saveChatWidthPreference(
  storage: StorageLike,
  styleTarget: StyleTarget,
  value: string
): void {
  applyRootVar(styleTarget, "--tutor-chat-max-width", value);
  writeStoredSetting(storage, CHAT_MAX_WIDTH_KEY, value);
}

export function saveDevDiagnosticsPreference(storage: StorageLike, enabled: boolean): void {
  writeStoredSetting(
    storage,
    DEV_DIAGNOSTICS_STORAGE_KEY,
    serializeDeveloperDiagnosticsFlag(enabled)
  );
}
