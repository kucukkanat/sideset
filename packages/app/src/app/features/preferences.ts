import { featureRegistry, type RegisteredFeature } from "./registry.ts";

export const MAX_OPTIONAL_PINS = 2;

export const FIXED_DOCK_ENDPOINTS = ["wallet", "settings"] as const;
export type FixedDockEndpoint = (typeof FIXED_DOCK_ENDPOINTS)[number];

export type PreferenceInitialization = "new-install" | "legacy-v1";

export interface FeaturePreferenceDefault {
  readonly enabled: boolean;
  readonly pinned: boolean;
  readonly discovered: boolean;
}

export interface FeaturePreferenceDefinition<Id extends string> {
  readonly id: Id;
  readonly available: boolean;
  readonly dockEligible: boolean;
  readonly defaults: Readonly<{
    newInstall: FeaturePreferenceDefault;
    legacyV1: FeaturePreferenceDefault;
  }>;
}

export interface StoredFeaturePreferencesV1 {
  readonly version: 1;
  readonly initializedFrom: PreferenceInitialization;
  readonly enabled: readonly string[];
  readonly pinned: readonly string[];
  readonly discovery: readonly string[];
}

export type DockEndpoint<Id extends string> =
  | { readonly kind: "fixed"; readonly id: FixedDockEndpoint }
  | { readonly kind: "feature"; readonly id: Id };

export interface NormalizedFeaturePreferences<Id extends string> {
  /** The untouched persisted value. Unknown IDs and their order round-trip through older builds. */
  readonly stored: StoredFeaturePreferencesV1;
  readonly available: readonly Id[];
  readonly enabled: readonly Id[];
  readonly pinned: readonly Id[];
  readonly dock: readonly DockEndpoint<Id>[];
  readonly discovery: Readonly<{
    readonly acknowledged: readonly Id[];
    readonly pending: readonly Id[];
  }>;
  readonly inactive: Readonly<{
    readonly overflowPinned: readonly Id[];
    readonly unavailableEnabled: readonly Id[];
    readonly unavailablePinned: readonly Id[];
    readonly unknownEnabled: readonly string[];
    readonly unknownPinned: readonly string[];
    readonly unknownDiscovery: readonly string[];
  }>;
}

export type FeaturePreferenceFailure =
  | "unknown-feature"
  | "unavailable"
  | "not-enabled"
  | "not-dock-eligible"
  | "dock-full"
  | "not-pinned"
  | "at-boundary";

export type FeaturePreferenceChange =
  | { readonly ok: true; readonly preferences: StoredFeaturePreferencesV1 }
  | {
      readonly ok: false;
      readonly reason: FeaturePreferenceFailure;
      readonly preferences: StoredFeaturePreferencesV1;
    };

const uniqueMatchingIds = <Id extends string>(
  values: readonly string[],
  definitions: readonly FeaturePreferenceDefinition<Id>[],
  include: (definition: FeaturePreferenceDefinition<Id>) => boolean,
): readonly Id[] => {
  const result: Id[] = [];
  for (const value of values) {
    const definition = definitions.find(({ id }) => id === value);
    if (definition !== undefined && include(definition) && !result.includes(definition.id)) {
      result.push(definition.id);
    }
  }
  return result;
};

const unknownIds = <Id extends string>(
  values: readonly string[],
  definitions: readonly FeaturePreferenceDefinition<Id>[],
): readonly string[] =>
  values.filter((value) => !definitions.some((definition) => definition.id === value));

const definitionFor = <Id extends string>(
  definitions: readonly FeaturePreferenceDefinition<Id>[],
  id: Id,
): FeaturePreferenceDefinition<Id> | undefined =>
  definitions.find((definition) => definition.id === id);

const changed = (preferences: StoredFeaturePreferencesV1): FeaturePreferenceChange => ({
  ok: true,
  preferences,
});

const unchanged = (
  preferences: StoredFeaturePreferencesV1,
  reason: FeaturePreferenceFailure,
): FeaturePreferenceChange => ({ ok: false, reason, preferences });

export const createFeaturePreferences = <Id extends string>(
  definitions: readonly FeaturePreferenceDefinition<Id>[],
  initializedFrom: PreferenceInitialization,
): StoredFeaturePreferencesV1 => {
  const defaultsFor = (definition: FeaturePreferenceDefinition<Id>): FeaturePreferenceDefault =>
    initializedFrom === "new-install"
      ? definition.defaults.newInstall
      : definition.defaults.legacyV1;

  return {
    version: 1,
    initializedFrom,
    enabled: definitions
      .filter((definition) => defaultsFor(definition).enabled)
      .map(({ id }) => id),
    pinned: definitions.filter((definition) => defaultsFor(definition).pinned).map(({ id }) => id),
    discovery: definitions
      .filter((definition) => defaultsFor(definition).discovered)
      .map(({ id }) => id),
  };
};

export const normalizeFeaturePreferences = <Id extends string>(
  stored: StoredFeaturePreferencesV1,
  definitions: readonly FeaturePreferenceDefinition<Id>[],
): NormalizedFeaturePreferences<Id> => {
  const definitionIds = definitions.map(({ id }) => id);
  const available = uniqueMatchingIds(definitionIds, definitions, ({ available }) => available);
  // Enablement is the user's durable intent; availability only controls whether it can run now.
  const enabled = uniqueMatchingIds(stored.enabled, definitions, () => true);
  const unavailableEnabled = enabled.filter(
    (id) => definitionFor(definitions, id)?.available === false,
  );
  const requestedPins = uniqueMatchingIds(
    stored.pinned,
    definitions,
    (definition) => definition.dockEligible && enabled.includes(definition.id),
  );
  const eligiblePins = uniqueMatchingIds(
    stored.pinned,
    definitions,
    (definition) =>
      definition.available && definition.dockEligible && enabled.includes(definition.id),
  );
  const pinned = eligiblePins.slice(0, MAX_OPTIONAL_PINS);
  const acknowledged = uniqueMatchingIds(
    stored.discovery,
    definitions,
    (definition) => definition.available,
  );
  const dock: DockEndpoint<Id>[] = [{ kind: "fixed", id: "wallet" }];
  for (const id of pinned) dock.push({ kind: "feature", id });
  dock.push({ kind: "fixed", id: "settings" });

  return {
    stored,
    available,
    enabled,
    pinned,
    dock,
    discovery: {
      acknowledged,
      pending: available.filter((id) => !acknowledged.includes(id)),
    },
    inactive: {
      overflowPinned: eligiblePins.slice(MAX_OPTIONAL_PINS),
      unavailableEnabled,
      unavailablePinned: requestedPins.filter(
        (id) => definitionFor(definitions, id)?.available === false,
      ),
      unknownEnabled: unknownIds(stored.enabled, definitions),
      unknownPinned: unknownIds(stored.pinned, definitions),
      unknownDiscovery: unknownIds(stored.discovery, definitions),
    },
  };
};

export const enableFeature = <Id extends string>(
  preferences: StoredFeaturePreferencesV1,
  definitions: readonly FeaturePreferenceDefinition<Id>[],
  id: Id,
): FeaturePreferenceChange => {
  const definition = definitionFor(definitions, id);
  if (definition === undefined) return unchanged(preferences, "unknown-feature");
  if (!definition.available) return unchanged(preferences, "unavailable");
  if (preferences.enabled.includes(id)) return changed(preferences);
  return changed({ ...preferences, enabled: [...preferences.enabled, id] });
};

export const pinFeature = <Id extends string>(
  preferences: StoredFeaturePreferencesV1,
  definitions: readonly FeaturePreferenceDefinition<Id>[],
  id: Id,
): FeaturePreferenceChange => {
  const definition = definitionFor(definitions, id);
  if (definition === undefined) return unchanged(preferences, "unknown-feature");
  if (!definition.available) return unchanged(preferences, "unavailable");
  if (!preferences.enabled.includes(id)) return unchanged(preferences, "not-enabled");
  if (!definition.dockEligible) return unchanged(preferences, "not-dock-eligible");
  const normalized = normalizeFeaturePreferences(preferences, definitions);
  if (normalized.pinned.includes(id)) return changed(preferences);
  if (normalized.pinned.length >= MAX_OPTIONAL_PINS) return unchanged(preferences, "dock-full");
  return changed({ ...preferences, pinned: [...preferences.pinned, id] });
};

export const unpinFeature = <Id extends string>(
  preferences: StoredFeaturePreferencesV1,
  definitions: readonly FeaturePreferenceDefinition<Id>[],
  id: Id,
): FeaturePreferenceChange => {
  if (definitionFor(definitions, id) === undefined) {
    return unchanged(preferences, "unknown-feature");
  }
  if (!preferences.pinned.includes(id)) return unchanged(preferences, "not-pinned");
  return changed({
    ...preferences,
    pinned: preferences.pinned.filter((pinnedId) => pinnedId !== id),
  });
};

export const disableFeature = <Id extends string>(
  preferences: StoredFeaturePreferencesV1,
  definitions: readonly FeaturePreferenceDefinition<Id>[],
  id: Id,
): FeaturePreferenceChange => {
  if (definitionFor(definitions, id) === undefined) {
    return unchanged(preferences, "unknown-feature");
  }
  if (!preferences.enabled.includes(id)) return unchanged(preferences, "not-enabled");
  return changed({
    ...preferences,
    enabled: preferences.enabled.filter((enabledId) => enabledId !== id),
    pinned: preferences.pinned.filter((pinnedId) => pinnedId !== id),
  });
};

export const reorderPinnedFeature = <Id extends string>(
  preferences: StoredFeaturePreferencesV1,
  definitions: readonly FeaturePreferenceDefinition<Id>[],
  id: Id,
  direction: "earlier" | "later",
): FeaturePreferenceChange => {
  if (definitionFor(definitions, id) === undefined) {
    return unchanged(preferences, "unknown-feature");
  }
  const pinned = normalizeFeaturePreferences(preferences, definitions).pinned;
  const position = pinned.indexOf(id);
  if (position < 0) return unchanged(preferences, "not-pinned");
  const adjacentPosition = direction === "earlier" ? position - 1 : position + 1;
  const adjacent = pinned[adjacentPosition];
  if (adjacent === undefined) return unchanged(preferences, "at-boundary");

  const idIndex = preferences.pinned.indexOf(id);
  const adjacentIndex = preferences.pinned.indexOf(adjacent);
  if (idIndex < 0 || adjacentIndex < 0) return unchanged(preferences, "not-pinned");
  const reordered = [...preferences.pinned];
  reordered[idIndex] = adjacent;
  reordered[adjacentIndex] = id;
  return changed({ ...preferences, pinned: reordered });
};

export const acknowledgeFeatureDiscovery = <Id extends string>(
  preferences: StoredFeaturePreferencesV1,
  definitions: readonly FeaturePreferenceDefinition<Id>[],
  id: Id,
): FeaturePreferenceChange => {
  const definition = definitionFor(definitions, id);
  if (definition === undefined) return unchanged(preferences, "unknown-feature");
  if (!definition.available) return unchanged(preferences, "unavailable");
  if (preferences.discovery.includes(id)) return changed(preferences);
  return changed({ ...preferences, discovery: [...preferences.discovery, id] });
};

type CurrentOptionalFeature = Extract<
  RegisteredFeature,
  { readonly kind: "destination" | "capability" | "experiment" }
>;

export type CurrentFeatureId = CurrentOptionalFeature["id"];

export const CURRENT_FEATURE_PREFERENCES: readonly FeaturePreferenceDefinition<CurrentFeatureId>[] =
  featureRegistry.flatMap((feature) => {
    if (feature.kind === "core") return [];
    const dockEligible = feature.kind === "destination";
    const defaultPinned = dockEligible && feature.dock.defaultPinned;
    const migratedTools = feature.id === "tools";
    return [
      {
        id: feature.id,
        available: true,
        dockEligible,
        defaults: {
          newInstall: {
            enabled: feature.defaultEnabled,
            pinned: defaultPinned,
            discovered: true,
          },
          legacyV1: {
            enabled: feature.defaultEnabled || migratedTools,
            pinned: defaultPinned || migratedTools,
            discovered: true,
          },
        },
      },
    ];
  });

export const createCurrentFeaturePreferences = (
  initializedFrom: PreferenceInitialization,
): StoredFeaturePreferencesV1 =>
  createFeaturePreferences(CURRENT_FEATURE_PREFERENCES, initializedFrom);
