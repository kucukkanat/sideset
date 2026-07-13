import {
  isToolOperation,
  TOOL_OPERATIONS,
  type ToolOperation,
} from "../../contracts/tool-operation.ts";

export const TOOL_PREFERENCES_STORAGE_KEY = "keychain.preferences.tools.v1";

export interface ToolPreferences {
  readonly version: 1;
  readonly enabled: readonly ToolOperation[];
}

export type ToolPreferencesLoadResult =
  | {
      readonly ok: true;
      readonly source: "created" | "stored";
      readonly preferences: ToolPreferences;
    }
  | {
      readonly ok: false;
      readonly reason: "invalid" | "unavailable" | "unsupported";
      readonly preferences: ToolPreferences;
    };

export const createToolPreferences = (): ToolPreferences => ({
  version: 1,
  enabled: TOOL_OPERATIONS,
});

const decode = (
  value: unknown,
): ToolPreferencesLoadResult["preferences"] | "invalid" | "unsupported" => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "invalid";
  const candidate = value as Readonly<Record<string, unknown>>;
  if (candidate.version !== 1)
    return typeof candidate.version === "number" ? "unsupported" : "invalid";
  const enabled = candidate.enabled;
  if (
    !Array.isArray(enabled) ||
    !enabled.every((id) => typeof id === "string" && isToolOperation(id))
  )
    return "invalid";
  return { version: 1, enabled: TOOL_OPERATIONS.filter((id) => enabled.includes(id)) };
};

export const loadToolPreferences = (
  storage: Pick<Storage, "getItem"> = localStorage,
): ToolPreferencesLoadResult => {
  const fallback = createToolPreferences();
  let serialized: string | null;
  try {
    serialized = storage.getItem(TOOL_PREFERENCES_STORAGE_KEY);
  } catch {
    return { ok: false, reason: "unavailable", preferences: fallback };
  }
  if (serialized === null) return { ok: true, source: "created", preferences: fallback };
  try {
    const decoded: unknown = JSON.parse(serialized);
    const preferences = decode(decoded);
    return typeof preferences === "string"
      ? { ok: false, reason: preferences, preferences: fallback }
      : { ok: true, source: "stored", preferences };
  } catch {
    return { ok: false, reason: "invalid", preferences: fallback };
  }
};

export const saveToolPreferences = (
  preferences: ToolPreferences,
  storage: Pick<Storage, "setItem"> = localStorage,
): boolean => {
  if (typeof decode(preferences) === "string") return false;
  try {
    storage.setItem(TOOL_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
};

export const setToolEnabled = (
  preferences: ToolPreferences,
  operation: ToolOperation,
  enabled: boolean,
): ToolPreferences => ({
  ...preferences,
  enabled: enabled
    ? TOOL_OPERATIONS.filter(
        (candidate) => candidate === operation || preferences.enabled.includes(candidate),
      )
    : preferences.enabled.filter((candidate) => candidate !== operation),
});
