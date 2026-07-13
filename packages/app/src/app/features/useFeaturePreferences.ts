import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type FeaturePreferencesLoadResult,
  loadFeaturePreferences,
  saveFeaturePreferences,
} from "./preference-storage.ts";
import {
  CURRENT_FEATURE_PREFERENCES,
  type CurrentFeatureId,
  createCurrentFeaturePreferences,
  disableFeature,
  enableFeature,
  type FeaturePreferenceChange,
  type FeaturePreferenceFailure,
  type NormalizedFeaturePreferences,
  normalizeFeaturePreferences,
  type PreferenceInitialization,
  pinFeature,
  reorderPinnedFeature,
  type StoredFeaturePreferencesV1,
  unpinFeature,
} from "./preferences.ts";
import { featureById } from "./registry.ts";

type LoadFailure = Extract<FeaturePreferencesLoadResult, { readonly ok: false }>["reason"];
type SaveFailure = "invalid" | "unavailable";

export type FeaturePreferencesPersistence =
  | { readonly mode: "pending" }
  | { readonly mode: "persistent" }
  | { readonly mode: "protected"; readonly reason: Exclude<LoadFailure, "unavailable"> }
  | { readonly mode: "session-only"; readonly reason: SaveFailure };

export type FeaturePreferenceMutation =
  | { readonly action: "enable"; readonly featureId: CurrentFeatureId }
  | { readonly action: "disable"; readonly featureId: CurrentFeatureId }
  | { readonly action: "pin"; readonly featureId: CurrentFeatureId }
  | { readonly action: "unpin"; readonly featureId: CurrentFeatureId }
  | {
      readonly action: "reorder";
      readonly featureId: CurrentFeatureId;
      readonly direction: "earlier" | "later";
    };

interface FeaturePreferenceMutationResultBase {
  readonly mutation: FeaturePreferenceMutation;
  readonly stored: StoredFeaturePreferencesV1;
  readonly normalized: NormalizedFeaturePreferences<CurrentFeatureId>;
  /** A successful session mutation can still be session-only when persistence is unavailable. */
  readonly persistence: FeaturePreferencesPersistence;
}

export type FeaturePreferenceMutationResult =
  | (FeaturePreferenceMutationResultBase & { readonly ok: true; readonly changed: boolean })
  | (FeaturePreferenceMutationResultBase & {
      readonly ok: false;
      readonly reason: FeaturePreferenceFailure;
    });

export interface FeaturePreferenceResetResult {
  readonly ok: true;
  readonly action: "reset";
  readonly initializedFrom: PreferenceInitialization;
  readonly stored: StoredFeaturePreferencesV1;
  readonly normalized: NormalizedFeaturePreferences<CurrentFeatureId>;
  readonly persistence: FeaturePreferencesPersistence;
}

export interface FeaturePreferencesController {
  readonly stored: StoredFeaturePreferencesV1;
  readonly normalized: NormalizedFeaturePreferences<CurrentFeatureId>;
  readonly persistence: FeaturePreferencesPersistence;
  readonly enable: (id: CurrentFeatureId) => FeaturePreferenceMutationResult;
  readonly disable: (id: CurrentFeatureId) => FeaturePreferenceMutationResult;
  readonly pin: (id: CurrentFeatureId) => FeaturePreferenceMutationResult;
  readonly unpin: (id: CurrentFeatureId) => FeaturePreferenceMutationResult;
  readonly reorder: (
    id: CurrentFeatureId,
    direction: "earlier" | "later",
  ) => FeaturePreferenceMutationResult;
  /** Resets to focused new-install defaults unless an initialization policy is supplied. */
  readonly reset: (initializedFrom?: PreferenceInitialization) => FeaturePreferenceResetResult;
}

export interface UseFeaturePreferencesOptions {
  /** Used only for the first load. Legacy migration is intentionally not repeated on reset. */
  readonly initialization: PreferenceInitialization;
  readonly onWarning?: (message: string) => void;
  readonly onAnnouncement?: (message: string) => void;
  readonly storage?: Pick<Storage, "getItem" | "setItem">;
}

const ignoreMessage = (_message: string): void => undefined;

const initialPersistence = (load: FeaturePreferencesLoadResult): FeaturePreferencesPersistence => {
  if (load.ok) return load.source === "created" ? { mode: "pending" } : { mode: "persistent" };
  return load.reason === "unavailable"
    ? { mode: "session-only", reason: "unavailable" }
    : { mode: "protected", reason: load.reason };
};

const loadWarning = (reason: LoadFailure): string => {
  switch (reason) {
    case "invalid":
      return "Feature preferences are invalid. Existing data was preserved; changes stay in this session until you reset feature preferences.";
    case "unsupported":
      return "Feature preferences were written by a newer version. Existing data was preserved; changes stay in this session until you reset feature preferences.";
    case "unavailable":
      return "Feature preferences cannot access local storage. Changes stay in this session.";
  }
};

const saveWarning = (reason: SaveFailure): string =>
  reason === "unavailable"
    ? "Feature preferences could not be saved. Changes stay in this session."
    : "Feature preferences became too large to save. Changes stay in this session.";

const mutationChange = (
  stored: StoredFeaturePreferencesV1,
  mutation: FeaturePreferenceMutation,
): FeaturePreferenceChange => {
  switch (mutation.action) {
    case "enable":
      return enableFeature(stored, CURRENT_FEATURE_PREFERENCES, mutation.featureId);
    case "disable":
      return disableFeature(stored, CURRENT_FEATURE_PREFERENCES, mutation.featureId);
    case "pin":
      return pinFeature(stored, CURRENT_FEATURE_PREFERENCES, mutation.featureId);
    case "unpin":
      return unpinFeature(stored, CURRENT_FEATURE_PREFERENCES, mutation.featureId);
    case "reorder":
      return reorderPinnedFeature(
        stored,
        CURRENT_FEATURE_PREFERENCES,
        mutation.featureId,
        mutation.direction,
      );
  }
};

const mutationAnnouncement = (mutation: FeaturePreferenceMutation, wasPinned: boolean): string => {
  const title = featureById(mutation.featureId).title;
  switch (mutation.action) {
    case "enable":
      return `${title} turned on.`;
    case "disable":
      return wasPinned ? `${title} turned off and removed from the dock.` : `${title} turned off.`;
    case "pin":
      return `${title} added to the dock.`;
    case "unpin":
      return `${title} removed from the dock.`;
    case "reorder":
      return `${title} moved ${mutation.direction} in the dock.`;
  }
};

const mutationWarning = (
  mutation: FeaturePreferenceMutation,
  reason: FeaturePreferenceFailure,
): string => {
  const title = featureById(mutation.featureId).title;
  switch (reason) {
    case "unknown-feature":
      return "That feature is no longer registered.";
    case "unavailable":
      return `${title} is not available in this build.`;
    case "not-enabled":
      return `Turn on ${title} before adding it to the dock.`;
    case "not-dock-eligible":
      return `${title} cannot be added to the dock.`;
    case "dock-full":
      return `The dock has room for two optional features. Remove one before adding ${title}.`;
    case "not-pinned":
      return `${title} is not in the dock.`;
    case "at-boundary":
      return `${title} cannot move any further ${
        mutation.action === "reorder" ? mutation.direction : "in the dock"
      }.`;
  }
};

const normalized = (
  stored: StoredFeaturePreferencesV1,
): NormalizedFeaturePreferences<CurrentFeatureId> =>
  normalizeFeaturePreferences(stored, CURRENT_FEATURE_PREFERENCES);

export const isCurrentFeatureId = (value: string): value is CurrentFeatureId =>
  CURRENT_FEATURE_PREFERENCES.some(({ id }) => id === value);

export const useFeaturePreferences = ({
  initialization,
  onWarning = ignoreMessage,
  onAnnouncement = ignoreMessage,
  storage = localStorage,
}: UseFeaturePreferencesOptions): FeaturePreferencesController => {
  const storageRef = useRef(storage);
  const [load] = useState(() => loadFeaturePreferences(initialization, storageRef.current));
  const [stored, setStored] = useState(load.preferences);
  const [persistence, setPersistence] = useState(() => initialPersistence(load));
  const storedRef = useRef(stored);
  const persistenceRef = useRef(persistence);
  const initializedRef = useRef(false);

  const recordPersistence = useCallback((next: FeaturePreferencesPersistence): void => {
    persistenceRef.current = next;
    setPersistence(next);
  }, []);

  const persist = useCallback(
    (
      preferences: StoredFeaturePreferencesV1,
      replaceProtected: boolean,
    ): FeaturePreferencesPersistence => {
      const current = persistenceRef.current;
      if (current.mode === "session-only" && !replaceProtected) return current;
      if (current.mode === "protected" && !replaceProtected) return current;

      const result = saveFeaturePreferences(preferences, storageRef.current);
      if (!result.ok) {
        const next = { mode: "session-only", reason: result.reason } as const;
        recordPersistence(next);
        onWarning(saveWarning(result.reason));
        return next;
      }

      const next = { mode: "persistent" } as const;
      if (current.mode !== "persistent") recordPersistence(next);
      return next;
    },
    [onWarning, recordPersistence],
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (!load.ok) {
      onWarning(loadWarning(load.reason));
      return;
    }
    if (load.source === "created" && persistenceRef.current.mode === "pending") {
      persist(storedRef.current, false);
    }
  }, [load, onWarning, persist]);

  const mutate = useCallback(
    (mutation: FeaturePreferenceMutation): FeaturePreferenceMutationResult => {
      const current = storedRef.current;
      const currentNormalized = normalized(current);
      const change = mutationChange(current, mutation);
      if (!change.ok) {
        onWarning(mutationWarning(mutation, change.reason));
        return {
          ok: false,
          mutation,
          reason: change.reason,
          stored: current,
          normalized: currentNormalized,
          persistence: persistenceRef.current,
        };
      }

      const changed = change.preferences !== current;
      const nextPersistence = changed ? persist(change.preferences, false) : persistenceRef.current;
      if (changed) {
        storedRef.current = change.preferences;
        setStored(change.preferences);
        onAnnouncement(
          mutationAnnouncement(mutation, currentNormalized.pinned.includes(mutation.featureId)),
        );
      }
      return {
        ok: true,
        mutation,
        changed,
        stored: change.preferences,
        normalized: normalized(change.preferences),
        persistence: nextPersistence,
      };
    },
    [onAnnouncement, onWarning, persist],
  );

  const enable = useCallback(
    (id: CurrentFeatureId): FeaturePreferenceMutationResult =>
      mutate({ action: "enable", featureId: id }),
    [mutate],
  );
  const disable = useCallback(
    (id: CurrentFeatureId): FeaturePreferenceMutationResult =>
      mutate({ action: "disable", featureId: id }),
    [mutate],
  );
  const pin = useCallback(
    (id: CurrentFeatureId): FeaturePreferenceMutationResult =>
      mutate({ action: "pin", featureId: id }),
    [mutate],
  );
  const unpin = useCallback(
    (id: CurrentFeatureId): FeaturePreferenceMutationResult =>
      mutate({ action: "unpin", featureId: id }),
    [mutate],
  );
  const reorder = useCallback(
    (id: CurrentFeatureId, direction: "earlier" | "later"): FeaturePreferenceMutationResult =>
      mutate({ action: "reorder", featureId: id, direction }),
    [mutate],
  );

  const reset = useCallback(
    (initializedFrom: PreferenceInitialization = "new-install"): FeaturePreferenceResetResult => {
      const next = createCurrentFeaturePreferences(initializedFrom);
      const nextPersistence = persist(next, true);
      storedRef.current = next;
      setStored(next);
      onAnnouncement("Feature preferences reset.");
      return {
        ok: true,
        action: "reset",
        initializedFrom,
        stored: next,
        normalized: normalized(next),
        persistence: nextPersistence,
      };
    },
    [onAnnouncement, persist],
  );

  const effective = useMemo(() => normalized(stored), [stored]);

  return {
    stored,
    normalized: effective,
    persistence,
    enable,
    disable,
    pin,
    unpin,
    reorder,
    reset,
  };
};
