import { describe, expect, test } from "bun:test";
import {
  acknowledgeFeatureDiscovery,
  CURRENT_FEATURE_PREFERENCES,
  createCurrentFeaturePreferences,
  createFeaturePreferences,
  disableFeature,
  enableFeature,
  MAX_OPTIONAL_PINS,
  normalizeFeaturePreferences,
  pinFeature,
  reorderPinnedFeature,
  type StoredFeaturePreferencesV1,
  unpinFeature,
} from "@app/features/preferences.ts";

const stored = (
  overrides: Partial<StoredFeaturePreferencesV1> = {},
): StoredFeaturePreferencesV1 => ({
  version: 1,
  initializedFrom: "new-install",
  enabled: [],
  pinned: [],
  discovery: [],
  ...overrides,
});

const availableDefinitions = [
  {
    id: "first",
    available: true,
    dockEligible: true,
    defaults: {
      newInstall: { enabled: false, pinned: false, discovered: false },
      legacyV1: { enabled: true, pinned: true, discovered: true },
    },
  },
  {
    id: "second",
    available: true,
    dockEligible: true,
    defaults: {
      newInstall: { enabled: false, pinned: false, discovered: false },
      legacyV1: { enabled: true, pinned: true, discovered: true },
    },
  },
  {
    id: "third",
    available: true,
    dockEligible: true,
    defaults: {
      newInstall: { enabled: false, pinned: false, discovered: false },
      legacyV1: { enabled: true, pinned: true, discovered: true },
    },
  },
  {
    id: "supporting",
    available: true,
    dockEligible: false,
    defaults: {
      newInstall: { enabled: false, pinned: false, discovered: false },
      legacyV1: { enabled: true, pinned: false, discovered: true },
    },
  },
  {
    id: "unavailable",
    available: false,
    dockEligible: true,
    defaults: {
      newInstall: { enabled: true, pinned: true, discovered: false },
      legacyV1: { enabled: true, pinned: true, discovered: true },
    },
  },
] as const;

describe("feature preference defaults", () => {
  test("uses the focused new-install dock without enabling Tools", () => {
    const preferences = createCurrentFeaturePreferences("new-install");
    const normalized = normalizeFeaturePreferences(preferences, CURRENT_FEATURE_PREFERENCES);

    expect(preferences).toEqual({
      version: 1,
      initializedFrom: "new-install",
      enabled: ["people", "activity"],
      pinned: ["people"],
      discovery: ["people", "activity", "tools"],
    });
    expect(normalized.dock).toEqual([
      { kind: "fixed", id: "wallet" },
      { kind: "feature", id: "people" },
      { kind: "fixed", id: "settings" },
    ]);
  });

  test("preserves the current four-item dock for a legacy migration", () => {
    const preferences = createCurrentFeaturePreferences("legacy-v1");
    const normalized = normalizeFeaturePreferences(preferences, CURRENT_FEATURE_PREFERENCES);

    expect(preferences.enabled).toEqual(["people", "activity", "tools"]);
    expect(preferences.pinned).toEqual(["people", "tools"]);
    expect(normalized.dock).toEqual([
      { kind: "fixed", id: "wallet" },
      { kind: "feature", id: "people" },
      { kind: "feature", id: "tools" },
      { kind: "fixed", id: "settings" },
    ]);
  });

  test("seeds generic definitions from the requested initialization policy", () => {
    expect(createFeaturePreferences(availableDefinitions, "new-install")).toEqual({
      version: 1,
      initializedFrom: "new-install",
      enabled: ["unavailable"],
      pinned: ["unavailable"],
      discovery: [],
    });
    expect(createFeaturePreferences(availableDefinitions, "legacy-v1")).toEqual({
      version: 1,
      initializedFrom: "legacy-v1",
      enabled: ["first", "second", "third", "supporting", "unavailable"],
      pinned: ["first", "second", "third", "unavailable"],
      discovery: ["first", "second", "third", "supporting", "unavailable"],
    });
  });
});

describe("feature preference normalization", () => {
  test("derives an effective view without changing unknown or unavailable values", () => {
    const preferences = stored({
      enabled: ["future", "first", "first", "second", "supporting", "unavailable"],
      pinned: ["future", "first", "second", "third", "unavailable"],
      discovery: ["future", "first", "first", "unavailable"],
    });
    const normalized = normalizeFeaturePreferences(preferences, availableDefinitions);

    expect(normalized.stored).toBe(preferences);
    expect(normalized.available).toEqual(["first", "second", "third", "supporting"]);
    expect(normalized.enabled).toEqual(["first", "second", "supporting", "unavailable"]);
    expect(normalized.pinned).toEqual(["first", "second"]);
    expect(normalized.inactive).toEqual({
      overflowPinned: [],
      unavailableEnabled: ["unavailable"],
      unavailablePinned: ["unavailable"],
      unknownEnabled: ["future"],
      unknownPinned: ["future"],
      unknownDiscovery: ["future"],
    });
    expect(normalized.discovery).toEqual({
      acknowledged: ["first"],
      pending: ["second", "third", "supporting"],
    });
  });

  test("reports otherwise valid pins beyond the two-slot capacity", () => {
    const normalized = normalizeFeaturePreferences(
      stored({ enabled: ["first", "second", "third"], pinned: ["first", "second", "third"] }),
      availableDefinitions,
    );

    expect(normalized.pinned).toEqual(["first", "second"]);
    expect(normalized.inactive.overflowPinned).toEqual(["third"]);
    expect(normalized.dock).toHaveLength(MAX_OPTIONAL_PINS + 2);
  });
});

describe("feature preference changes", () => {
  test("enables without pinning, then pins within capacity", () => {
    const initial = stored({ enabled: ["first"], pinned: ["first"] });
    const enabled = enableFeature(initial, availableDefinitions, "second");
    expect(enabled).toEqual({
      ok: true,
      preferences: { ...initial, enabled: ["first", "second"] },
    });
    if (!enabled.ok) throw new Error("Expected enablement to succeed");
    expect(enabled.preferences.pinned).toEqual(["first"]);

    const pinned = pinFeature(enabled.preferences, availableDefinitions, "second");
    expect(pinned).toEqual({
      ok: true,
      preferences: { ...enabled.preferences, pinned: ["first", "second"] },
    });
  });

  test("unpins without disabling and disabling removes every matching pin", () => {
    const initial = stored({
      enabled: ["future", "first", "second"],
      pinned: ["future", "first", "second", "second"],
      discovery: ["future", "second"],
    });
    const unpinned = unpinFeature(initial, availableDefinitions, "second");
    expect(unpinned).toEqual({
      ok: true,
      preferences: { ...initial, pinned: ["future", "first"] },
    });
    if (!unpinned.ok) throw new Error("Expected unpinning to succeed");
    expect(unpinned.preferences.enabled).toContain("second");

    const disabled = disableFeature(initial, availableDefinitions, "second");
    expect(disabled).toEqual({
      ok: true,
      preferences: {
        ...initial,
        enabled: ["future", "first"],
        pinned: ["future", "first"],
      },
    });
    if (!disabled.ok) throw new Error("Expected disablement to succeed");
    expect(disabled.preferences.discovery).toEqual(["future", "second"]);
  });

  test("reorders effective pins while leaving unknown positions untouched", () => {
    const initial = stored({
      enabled: ["first", "second"],
      pinned: ["future-before", "first", "future-middle", "second", "future-after"],
    });
    const earlier = reorderPinnedFeature(initial, availableDefinitions, "second", "earlier");
    expect(earlier).toEqual({
      ok: true,
      preferences: {
        ...initial,
        pinned: ["future-before", "second", "future-middle", "first", "future-after"],
      },
    });
    if (!earlier.ok) throw new Error("Expected reordering to succeed");
    expect(
      reorderPinnedFeature(earlier.preferences, availableDefinitions, "second", "later"),
    ).toEqual({
      ok: true,
      preferences: initial,
    });
  });

  test("acknowledges discovery without changing enablement", () => {
    const initial = stored({ enabled: ["first"], discovery: ["future"] });
    const acknowledged = acknowledgeFeatureDiscovery(initial, availableDefinitions, "second");
    expect(acknowledged).toEqual({
      ok: true,
      preferences: { ...initial, discovery: ["future", "second"] },
    });
    if (!acknowledged.ok) throw new Error("Expected discovery acknowledgement to succeed");
    expect(acknowledged.preferences.enabled).toEqual(["first"]);
  });

  test("returns explicit failures and keeps the persisted value unchanged", () => {
    const empty = stored();
    const onePin = stored({ enabled: ["first"], pinned: ["first"] });
    const full = stored({
      enabled: ["first", "second", "third"],
      pinned: ["first", "second"],
    });

    expect(enableFeature(empty, availableDefinitions, "unavailable")).toEqual({
      ok: false,
      reason: "unavailable",
      preferences: empty,
    });
    expect(pinFeature(empty, availableDefinitions, "first")).toMatchObject({
      ok: false,
      reason: "not-enabled",
    });
    expect(
      pinFeature(stored({ enabled: ["supporting"] }), availableDefinitions, "supporting"),
    ).toMatchObject({
      ok: false,
      reason: "not-dock-eligible",
    });
    expect(pinFeature(full, availableDefinitions, "third")).toMatchObject({
      ok: false,
      reason: "dock-full",
    });
    expect(unpinFeature(empty, availableDefinitions, "first")).toMatchObject({
      ok: false,
      reason: "not-pinned",
    });
    expect(disableFeature(empty, availableDefinitions, "first")).toMatchObject({
      ok: false,
      reason: "not-enabled",
    });
    expect(reorderPinnedFeature(onePin, availableDefinitions, "first", "earlier")).toMatchObject({
      ok: false,
      reason: "at-boundary",
    });
    expect(reorderPinnedFeature(empty, availableDefinitions, "first", "later")).toMatchObject({
      ok: false,
      reason: "not-pinned",
    });
    expect(acknowledgeFeatureDiscovery(empty, availableDefinitions, "unavailable")).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
  });

  test("treats repeated successful requests as idempotent", () => {
    const initial = stored({
      enabled: ["first"],
      pinned: ["first"],
      discovery: ["first"],
    });
    expect(enableFeature(initial, availableDefinitions, "first")).toEqual({
      ok: true,
      preferences: initial,
    });
    expect(pinFeature(initial, availableDefinitions, "first")).toEqual({
      ok: true,
      preferences: initial,
    });
    expect(acknowledgeFeatureDiscovery(initial, availableDefinitions, "first")).toEqual({
      ok: true,
      preferences: initial,
    });
  });

  test("rejects IDs absent from the current registry", () => {
    const initial = stored({ enabled: ["first"], pinned: ["first"] });
    const definitions = availableDefinitions.filter(({ id }) => id !== "third");

    expect(enableFeature(initial, definitions, "third")).toMatchObject({
      ok: false,
      reason: "unknown-feature",
    });
    expect(unpinFeature(initial, definitions, "third")).toMatchObject({
      ok: false,
      reason: "unknown-feature",
    });
    expect(disableFeature(initial, definitions, "third")).toMatchObject({
      ok: false,
      reason: "unknown-feature",
    });
    expect(reorderPinnedFeature(initial, definitions, "third", "later")).toMatchObject({
      ok: false,
      reason: "unknown-feature",
    });
    expect(acknowledgeFeatureDiscovery(initial, definitions, "third")).toMatchObject({
      ok: false,
      reason: "unknown-feature",
    });
  });
});
