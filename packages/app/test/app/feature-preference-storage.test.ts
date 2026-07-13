import { describe, expect, test } from "bun:test";
import {
  FEATURE_PREFERENCES_STORAGE_KEY,
  loadFeaturePreferences,
  saveFeaturePreferences,
} from "@app/features/preference-storage.ts";
import { createCurrentFeaturePreferences } from "@app/features/preferences.ts";

describe("feature preference persistence", () => {
  test("seeds new and migrated users independently", () => {
    const empty = new Map<string, string>();
    const storage = { getItem: (key: string) => empty.get(key) ?? null };

    expect(loadFeaturePreferences("new-install", storage)).toMatchObject({
      ok: true,
      source: "created",
      preferences: { enabled: ["people", "activity"], pinned: ["people"] },
    });
    expect(loadFeaturePreferences("legacy-v1", storage)).toMatchObject({
      ok: true,
      source: "created",
      preferences: {
        enabled: ["people", "activity", "tools"],
        pinned: ["people", "tools"],
      },
    });
  });

  test("round-trips unknown identifiers without normalizing the stored value", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const preferences = {
      ...createCurrentFeaturePreferences("new-install"),
      enabled: ["future", "people"],
      pinned: ["future", "people"],
    } as const;

    expect(saveFeaturePreferences(preferences, storage)).toEqual({ ok: true });
    expect(loadFeaturePreferences("legacy-v1", storage)).toEqual({
      ok: true,
      source: "stored",
      preferences,
    });
  });

  test("isolates malformed and newer values without overwriting them", () => {
    const values = new Map([[FEATURE_PREFERENCES_STORAGE_KEY, "{broken"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null };

    expect(loadFeaturePreferences("new-install", storage)).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    values.set(FEATURE_PREFERENCES_STORAGE_KEY, JSON.stringify({ version: 2 }));
    expect(loadFeaturePreferences("new-install", storage)).toMatchObject({
      ok: false,
      reason: "unsupported",
    });
  });

  test("reports storage failures explicitly", () => {
    const unavailable = {
      getItem: (): string | null => {
        throw new Error("blocked");
      },
      setItem: (): void => {
        throw new Error("blocked");
      },
    };

    expect(loadFeaturePreferences("new-install", unavailable)).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
    expect(
      saveFeaturePreferences(createCurrentFeaturePreferences("new-install"), unavailable),
    ).toEqual({ ok: false, reason: "unavailable" });
  });

  test("enforces its storage budget in UTF-8 bytes", () => {
    const multibyteId = "界".repeat(100);
    const oversized = {
      version: 1,
      initializedFrom: "new-install",
      enabled: Array.from({ length: 100 }, () => multibyteId),
      pinned: Array.from({ length: 100 }, () => multibyteId),
      discovery: Array.from({ length: 100 }, () => multibyteId),
    } as const;

    expect(JSON.stringify(oversized).length).toBeLessThan(64 * 1024);
    expect(saveFeaturePreferences(oversized)).toEqual({ ok: false, reason: "invalid" });
    localStorage.setItem(FEATURE_PREFERENCES_STORAGE_KEY, JSON.stringify(oversized));
    expect(loadFeaturePreferences("new-install")).toMatchObject({
      ok: false,
      reason: "invalid",
    });
  });
});
