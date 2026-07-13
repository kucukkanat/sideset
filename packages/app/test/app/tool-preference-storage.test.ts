import { describe, expect, test } from "bun:test";
import {
  loadToolPreferences,
  saveToolPreferences,
  setToolEnabled,
  TOOL_PREFERENCES_STORAGE_KEY,
} from "@app/features/tool-preference-storage.ts";

describe("nested tool preferences", () => {
  test("defaults every tool on and persists independent toggles", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const defaults = loadToolPreferences(storage);
    expect(defaults.preferences.enabled).toEqual(["encrypt", "decrypt", "sign", "verify", "cloak"]);

    const disabled = setToolEnabled(defaults.preferences, "sign", false);
    expect(saveToolPreferences(disabled, storage)).toBe(true);
    expect(loadToolPreferences(storage)).toEqual({
      ok: true,
      source: "stored",
      preferences: disabled,
    });

    expect(setToolEnabled(disabled, "sign", true).enabled).toEqual([
      "encrypt",
      "decrypt",
      "sign",
      "verify",
      "cloak",
    ]);
  });

  test("protects malformed and newer stored values", () => {
    const values = new Map([[TOOL_PREFERENCES_STORAGE_KEY, "{broken"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null };
    expect(loadToolPreferences(storage)).toMatchObject({ ok: false, reason: "invalid" });

    values.set(TOOL_PREFERENCES_STORAGE_KEY, JSON.stringify({ version: 2, enabled: [] }));
    expect(loadToolPreferences(storage)).toMatchObject({ ok: false, reason: "unsupported" });
  });
});
