import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  FeatureDisposer,
  FeatureRuntime,
  FeatureRuntimeContext,
} from "../../contracts/feature.ts";
import {
  type AcquirableFeatureId,
  acquireFeature,
  type FeatureAcquisitionResult,
} from "./acquisition.ts";
import {
  CURRENT_FEATURE_PREFERENCES,
  type CurrentFeatureId,
  type NormalizedFeaturePreferences,
  type PreferenceInitialization,
} from "./preferences.ts";
import { featureById, featureRegistry, type RegisteredFeature } from "./registry.ts";
import {
  type FeaturePreferenceResetResult,
  isCurrentFeatureId,
  useFeaturePreferences,
} from "./useFeaturePreferences.ts";

export type FeatureReadiness =
  | "idle"
  | "preparing"
  | "ready"
  | "online-only"
  | "failed"
  | "update-required"
  | "data-unavailable";

export interface FeatureLibraryEntry {
  readonly id: CurrentFeatureId;
  readonly title: string;
  readonly summary: string;
  readonly enabled: boolean;
  readonly pinned: boolean;
  readonly dockPosition: number | null;
  readonly dockEligible: boolean;
  readonly readiness: Exclude<FeatureReadiness, "idle">;
  readonly canMoveEarlier: boolean;
  readonly canMoveLater: boolean;
}

type RuntimeFeature = Extract<RegisteredFeature, { readonly load: unknown }>;

const isRuntimeFeature = (feature: RegisteredFeature): feature is RuntimeFeature =>
  "load" in feature;

const runtimeFeatureIds: readonly AcquirableFeatureId[] = featureRegistry.flatMap(
  (feature): readonly AcquirableFeatureId[] => (isRuntimeFeature(feature) ? [feature.id] : []),
);

type AcquireRuntimeFeature = (id: AcquirableFeatureId) => Promise<FeatureAcquisitionResult>;
type LoadFeatureRuntime = (id: AcquirableFeatureId) => Promise<FeatureRuntime>;

const loadRegisteredRuntime: LoadFeatureRuntime = async (id) => featureById(id).load();

interface UseFeatureHostOptions {
  readonly initialization: PreferenceInitialization;
  readonly onMessage: (message: string) => void;
  readonly runtimeContext: FeatureRuntimeContext;
  readonly unavailableFeatures?: readonly CurrentFeatureId[];
  readonly acquireRuntimeFeature?: AcquireRuntimeFeature;
  readonly loadFeatureRuntime?: LoadFeatureRuntime;
}

export interface FeatureHost {
  readonly preferences: NormalizedFeaturePreferences<CurrentFeatureId>;
  readonly libraryEntries: readonly FeatureLibraryEntry[];
  readonly isEnabled: (id: CurrentFeatureId) => boolean;
  readonly readiness: (id: CurrentFeatureId) => FeatureReadiness;
  readonly prepare: (id: AcquirableFeatureId) => Promise<FeatureAcquisitionResult>;
  readonly enable: (id: string) => Promise<void>;
  readonly disable: (id: string) => void;
  readonly pin: (id: string) => void;
  readonly unpin: (id: string) => void;
  readonly reorder: (id: string, direction: "earlier" | "later") => void;
  readonly retry: (id: string) => void;
  readonly fail: (id: string, error: unknown) => void;
  readonly reset: () => FeaturePreferenceResetResult;
}

type RuntimeActivationResult =
  | {
      readonly status: "active";
      readonly acquisition: FeatureAcquisitionResult;
    }
  | {
      readonly status: "failed";
      readonly acquisition: FeatureAcquisitionResult;
      readonly message: string;
    }
  | {
      readonly status: "stale";
      readonly acquisition: FeatureAcquisitionResult;
    };

export const useFeatureHost = ({
  initialization,
  onMessage,
  runtimeContext,
  unavailableFeatures = [],
  acquireRuntimeFeature = acquireFeature,
  loadFeatureRuntime = loadRegisteredRuntime,
}: UseFeatureHostOptions): FeatureHost => {
  const preferences = useFeaturePreferences({
    initialization,
    onWarning: onMessage,
    onAnnouncement: onMessage,
  });
  const [readinessById, setReadinessById] = useState<
    Readonly<Partial<Record<AcquirableFeatureId, FeatureReadiness>>>
  >({});
  const preparations = useRef(new Map<AcquirableFeatureId, Promise<FeatureAcquisitionResult>>());
  const intentVersions = useRef(new Map<CurrentFeatureId, number>());
  const runtimeOperations = useRef(new Map<AcquirableFeatureId, Promise<void>>());
  const runtimeDisposers = useRef(new Map<AcquirableFeatureId, FeatureDisposer>());
  const mounted = useRef(true);
  const onMessageRef = useRef(onMessage);
  const runtimeContextRef = useRef(runtimeContext);
  const acquireRuntimeFeatureRef = useRef(acquireRuntimeFeature);
  const loadFeatureRuntimeRef = useRef(loadFeatureRuntime);

  useLayoutEffect(() => {
    onMessageRef.current = onMessage;
    runtimeContextRef.current = runtimeContext;
    acquireRuntimeFeatureRef.current = acquireRuntimeFeature;
    loadFeatureRuntimeRef.current = loadFeatureRuntime;
  }, [acquireRuntimeFeature, loadFeatureRuntime, onMessage, runtimeContext]);

  const beginIntent = useCallback((id: CurrentFeatureId): number => {
    const version = (intentVersions.current.get(id) ?? 0) + 1;
    intentVersions.current.set(id, version);
    return version;
  }, []);
  const isCurrentIntent = useCallback(
    (id: CurrentFeatureId, version: number): boolean => intentVersions.current.get(id) === version,
    [],
  );

  const setRuntimeReadiness = useCallback(
    (id: AcquirableFeatureId, value: FeatureReadiness): void => {
      if (!mounted.current) return;
      setReadinessById((current) => ({ ...current, [id]: value }));
    },
    [],
  );

  const disposeSafely = useCallback((id: AcquirableFeatureId, disposer: FeatureDisposer): void => {
    try {
      disposer();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "unknown cleanup failure";
      if (mounted.current)
        onMessageRef.current(`${featureById(id).title} cleanup failed: ${message}`);
      else console.error(`${featureById(id).title} cleanup failed`, error);
    }
  }, []);

  const disposeRuntime = useCallback(
    (id: AcquirableFeatureId): void => {
      const disposer = runtimeDisposers.current.get(id);
      if (disposer === undefined) return;
      runtimeDisposers.current.delete(id);
      disposeSafely(id, disposer);
    },
    [disposeSafely],
  );

  const enqueueRuntimeOperation = useCallback(
    <Result>(id: AcquirableFeatureId, operation: () => Promise<Result>): Promise<Result> => {
      const previous = runtimeOperations.current.get(id) ?? Promise.resolve();
      const pending = previous.then(operation, operation);
      const settled = pending.then(
        () => undefined,
        () => undefined,
      );
      runtimeOperations.current.set(id, settled);
      void settled.then(() => {
        if (runtimeOperations.current.get(id) === settled) runtimeOperations.current.delete(id);
      });
      return pending;
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const id of runtimeFeatureIds) {
        const version = (intentVersions.current.get(id) ?? 0) + 1;
        intentVersions.current.set(id, version);
        disposeRuntime(id);
      }
    };
  }, [disposeRuntime]);

  const readiness = useCallback(
    (id: CurrentFeatureId): FeatureReadiness => {
      if (unavailableFeatures.includes(id)) return "data-unavailable";
      const feature = featureById(id);
      return isRuntimeFeature(feature) ? (readinessById[feature.id] ?? "idle") : "ready";
    },
    [readinessById, unavailableFeatures],
  );

  const acquireAssets = useCallback(
    async (id: AcquirableFeatureId): Promise<FeatureAcquisitionResult> => {
      const active = preparations.current.get(id);
      if (active !== undefined) return active;

      const pending = acquireRuntimeFeatureRef.current(id).catch(
        (error: unknown): FeatureAcquisitionResult => ({
          status: "failed",
          featureId: id,
          code: "channel-failure",
          message:
            error instanceof Error ? error.message : `Unable to prepare ${featureById(id).title}`,
          offlineReady: false,
        }),
      );
      preparations.current.set(id, pending);
      const result = await pending;
      if (preparations.current.get(id) === pending) preparations.current.delete(id);
      return result;
    },
    [],
  );

  const activateRuntime = useCallback(
    (id: AcquirableFeatureId, intent: number): Promise<RuntimeActivationResult> => {
      if (isCurrentIntent(id, intent)) setRuntimeReadiness(id, "preparing");
      return enqueueRuntimeOperation(id, async () => {
        const acquisition = await acquireAssets(id);
        if (!mounted.current || !isCurrentIntent(id, intent)) {
          return { status: "stale", acquisition };
        }
        if (acquisition.status === "failed") {
          setRuntimeReadiness(
            id,
            acquisition.code === "version-mismatch" ? "update-required" : "failed",
          );
          return { status: "failed", acquisition, message: acquisition.message };
        }

        const ready = acquisition.status === "unsupported" ? "online-only" : "ready";
        if (runtimeDisposers.current.has(id)) {
          setRuntimeReadiness(id, ready);
          return { status: "active", acquisition };
        }

        try {
          const runtime = await loadFeatureRuntimeRef.current(id);
          if (!mounted.current || !isCurrentIntent(id, intent)) {
            return { status: "stale", acquisition };
          }
          const disposer = await runtime.activate(runtimeContextRef.current);
          if (!mounted.current || !isCurrentIntent(id, intent)) {
            disposeSafely(id, disposer);
            return { status: "stale", acquisition };
          }
          runtimeDisposers.current.set(id, disposer);
          setRuntimeReadiness(id, ready);
          return { status: "active", acquisition };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : `Unable to activate ${featureById(id).title}`;
          if (!mounted.current || !isCurrentIntent(id, intent)) {
            return { status: "stale", acquisition };
          }
          setRuntimeReadiness(id, "failed");
          return { status: "failed", acquisition, message };
        }
      });
    },
    [acquireAssets, disposeSafely, enqueueRuntimeOperation, isCurrentIntent, setRuntimeReadiness],
  );

  const prepare = useCallback(
    async (id: AcquirableFeatureId): Promise<FeatureAcquisitionResult> => {
      const intent = beginIntent(id);
      return (await activateRuntime(id, intent)).acquisition;
    },
    [activateRuntime, beginIntent],
  );

  const enabled = preferences.normalized.enabled;
  useEffect(() => {
    const pending = runtimeFeatureIds.filter(
      (id) => enabled.includes(id) && readiness(id) === "idle",
    );
    if (pending.length === 0) return;
    const timer = setTimeout(() => {
      for (const id of pending) {
        const intent = beginIntent(id);
        void activateRuntime(id, intent);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activateRuntime, beginIntent, enabled, readiness]);

  const currentId = useCallback(
    (id: string): CurrentFeatureId | null => {
      if (isCurrentFeatureId(id)) return id;
      onMessage("That feature is not registered in this build");
      return null;
    },
    [onMessage],
  );

  const enable = useCallback(
    async (candidate: string): Promise<void> => {
      const id = currentId(candidate);
      if (id === null) return;
      const intent = beginIntent(id);
      const feature = featureById(id);
      let onlineOnly = false;
      if (!unavailableFeatures.includes(id) && isRuntimeFeature(feature)) {
        const activation = await activateRuntime(feature.id, intent);
        if (activation.status === "stale") return;
        if (activation.status === "failed") {
          onMessage(`${feature.title} was not enabled: ${activation.message}`);
          return;
        }
        onlineOnly = activation.acquisition.status === "unsupported";
      }
      if (!isCurrentIntent(id, intent)) return;
      const result = preferences.enable(id);
      if (result.ok && onlineOnly) {
        onMessage(`${feature.title} turned on; offline use is unavailable in this browser`);
      }
    },
    [
      activateRuntime,
      beginIntent,
      currentId,
      isCurrentIntent,
      onMessage,
      preferences,
      unavailableFeatures,
    ],
  );

  const withCurrent = useCallback(
    (candidate: string, action: (id: CurrentFeatureId) => void): void => {
      const id = currentId(candidate);
      if (id !== null) action(id);
    },
    [currentId],
  );
  const disable = useCallback(
    (id: string): void =>
      withCurrent(id, (current) => {
        beginIntent(current);
        preferences.disable(current);
        const feature = featureById(current);
        if (isRuntimeFeature(feature)) {
          void enqueueRuntimeOperation(feature.id, async () => {
            disposeRuntime(feature.id);
            setRuntimeReadiness(feature.id, "idle");
          });
        }
      }),
    [
      beginIntent,
      disposeRuntime,
      enqueueRuntimeOperation,
      preferences,
      setRuntimeReadiness,
      withCurrent,
    ],
  );
  const pin = useCallback(
    (id: string): void => withCurrent(id, (current) => void preferences.pin(current)),
    [preferences, withCurrent],
  );
  const unpin = useCallback(
    (id: string): void => withCurrent(id, (current) => void preferences.unpin(current)),
    [preferences, withCurrent],
  );
  const reorder = useCallback(
    (id: string, direction: "earlier" | "later"): void =>
      withCurrent(id, (current) => void preferences.reorder(current, direction)),
    [preferences, withCurrent],
  );
  const retry = useCallback(
    (candidate: string): void => {
      const id = currentId(candidate);
      if (id === null) return;
      const feature = featureById(id);
      if (isRuntimeFeature(feature)) {
        void prepare(feature.id);
        return;
      }
      onMessage("That feature does not require a download");
    },
    [currentId, onMessage, prepare],
  );
  const fail = useCallback(
    (candidate: string, _error: unknown): void =>
      withCurrent(candidate, (current) => {
        beginIntent(current);
        const feature = featureById(current);
        if (!isRuntimeFeature(feature)) return;
        void enqueueRuntimeOperation(feature.id, async () => {
          disposeRuntime(feature.id);
          setRuntimeReadiness(feature.id, "failed");
        });
      }),
    [beginIntent, disposeRuntime, enqueueRuntimeOperation, setRuntimeReadiness, withCurrent],
  );
  const reset = useCallback((): FeaturePreferenceResetResult => {
    for (const { id } of CURRENT_FEATURE_PREFERENCES) {
      beginIntent(id);
      const feature = featureById(id);
      if (isRuntimeFeature(feature)) {
        void enqueueRuntimeOperation(feature.id, async () => {
          disposeRuntime(feature.id);
          setRuntimeReadiness(feature.id, "idle");
        });
      }
    }
    return preferences.reset();
  }, [beginIntent, disposeRuntime, enqueueRuntimeOperation, preferences, setRuntimeReadiness]);

  const libraryEntries = useMemo(
    (): readonly FeatureLibraryEntry[] =>
      CURRENT_FEATURE_PREFERENCES.map((definition) => {
        const feature = featureById(definition.id);
        const pinnedIndex = preferences.normalized.pinned.indexOf(definition.id);
        const featureReadiness = readiness(definition.id);
        return {
          id: definition.id,
          title: feature.title,
          summary: feature.summary,
          enabled: enabled.includes(definition.id),
          pinned: pinnedIndex >= 0,
          dockPosition: pinnedIndex >= 0 ? pinnedIndex : null,
          dockEligible: definition.dockEligible,
          readiness: featureReadiness === "idle" ? "preparing" : featureReadiness,
          canMoveEarlier: pinnedIndex > 0,
          canMoveLater: pinnedIndex >= 0 && pinnedIndex < preferences.normalized.pinned.length - 1,
        };
      }),
    [enabled, preferences.normalized.pinned, readiness],
  );

  return {
    preferences: preferences.normalized,
    libraryEntries,
    isEnabled: (id) => enabled.includes(id),
    readiness,
    prepare,
    enable,
    disable,
    pin,
    unpin,
    reorder,
    retry,
    fail,
    reset,
  };
};
