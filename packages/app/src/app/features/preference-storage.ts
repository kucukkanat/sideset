import {
  createCurrentFeaturePreferences,
  type PreferenceInitialization,
  type StoredFeaturePreferencesV1,
} from "./preferences.ts";

export const FEATURE_PREFERENCES_STORAGE_KEY = "keychain.preferences.v1";
const MAX_PREFERENCES_BYTES = 64 * 1024;
const MAX_IDS = 100;
const MAX_ID_LENGTH = 100;
const serializedBytes = (value: string): number => new TextEncoder().encode(value).byteLength;

export type FeaturePreferencesLoadResult =
  | {
      readonly ok: true;
      readonly source: "created" | "stored";
      readonly preferences: StoredFeaturePreferencesV1;
    }
  | {
      readonly ok: false;
      readonly reason: "invalid" | "unavailable" | "unsupported";
      readonly preferences: StoredFeaturePreferencesV1;
    };

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isIds = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.length <= MAX_IDS &&
  value.every((id) => typeof id === "string" && id.length > 0 && id.length <= MAX_ID_LENGTH);

const decode = (
  value: unknown,
):
  | { readonly ok: true; readonly preferences: StoredFeaturePreferencesV1 }
  | { readonly ok: false; readonly reason: "invalid" | "unsupported" } => {
  if (!isRecord(value)) return { ok: false, reason: "invalid" };
  if (typeof value.version !== "number" || !Number.isInteger(value.version)) {
    return { ok: false, reason: "invalid" };
  }
  if (value.version !== 1) return { ok: false, reason: "unsupported" };
  if (
    (value.initializedFrom !== "new-install" && value.initializedFrom !== "legacy-v1") ||
    !isIds(value.enabled) ||
    !isIds(value.pinned) ||
    !isIds(value.discovery)
  ) {
    return { ok: false, reason: "invalid" };
  }
  return {
    ok: true,
    preferences: {
      version: 1,
      initializedFrom: value.initializedFrom,
      enabled: value.enabled,
      pinned: value.pinned,
      discovery: value.discovery,
    },
  };
};

export const loadFeaturePreferences = (
  initializedFrom: PreferenceInitialization,
  storage: Pick<Storage, "getItem"> = localStorage,
): FeaturePreferencesLoadResult => {
  const fallback = createCurrentFeaturePreferences(initializedFrom);
  let serialized: string | null;
  try {
    serialized = storage.getItem(FEATURE_PREFERENCES_STORAGE_KEY);
  } catch {
    return { ok: false, reason: "unavailable", preferences: fallback };
  }
  if (serialized === null) return { ok: true, source: "created", preferences: fallback };
  if (serializedBytes(serialized) > MAX_PREFERENCES_BYTES) {
    return { ok: false, reason: "invalid", preferences: fallback };
  }
  try {
    const decoded = decode(JSON.parse(serialized));
    return decoded.ok
      ? { ok: true, source: "stored", preferences: decoded.preferences }
      : { ok: false, reason: decoded.reason, preferences: fallback };
  } catch {
    return { ok: false, reason: "invalid", preferences: fallback };
  }
};

export const saveFeaturePreferences = (
  preferences: StoredFeaturePreferencesV1,
  storage: Pick<Storage, "setItem"> = localStorage,
): { readonly ok: true } | { readonly ok: false; readonly reason: "invalid" | "unavailable" } => {
  const decoded = decode(preferences);
  if (!decoded.ok) return { ok: false, reason: "invalid" };
  const serialized = JSON.stringify(decoded.preferences);
  if (serializedBytes(serialized) > MAX_PREFERENCES_BYTES) {
    return { ok: false, reason: "invalid" };
  }
  try {
    storage.setItem(FEATURE_PREFERENCES_STORAGE_KEY, serialized);
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
};
