import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { AcquirableFeatureId, FeatureAcquisitionResult } from "@app/features/acquisition.ts";
import {
  loadFeaturePreferences,
  saveFeaturePreferences,
} from "@app/features/preference-storage.ts";
import {
  createCurrentFeaturePreferences,
  type PreferenceInitialization,
} from "@app/features/preferences.ts";
import { type FeatureHost, useFeatureHost } from "@app/features/useFeatureHost.ts";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type {
  FeatureDisposer,
  FeatureRuntime,
  FeatureRuntimeContext,
} from "../../src/contracts/feature.ts";

interface HostConfiguration {
  readonly initialization?: PreferenceInitialization;
  readonly onMessage?: (message: string) => void;
  readonly acquireRuntimeFeature?: (id: AcquirableFeatureId) => Promise<FeatureAcquisitionResult>;
  readonly loadFeatureRuntime?: (id: AcquirableFeatureId) => Promise<FeatureRuntime>;
  readonly unavailableFeatures?: readonly ("activity" | "people" | "tools")[];
}

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

const deferred = <Value,>(): Deferred<Value> => {
  let resolve = (_value: Value): void => {
    throw new Error("Deferred promise was resolved before initialization");
  };
  const promise = new Promise<Value>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

const runtimeContext: FeatureRuntimeContext = {
  capabilities: {
    required: (id) => {
      throw new Error(`Unexpected required capability: ${id}`);
    },
    optional: () => null,
  },
};

const acquired = (featureId: AcquirableFeatureId): FeatureAcquisitionResult => ({
  status: "acquired",
  featureId,
  buildVersion: "test-build",
  assetCount: 1,
  offlineReady: true,
});

const acquireImmediately = async (
  featureId: AcquirableFeatureId,
): Promise<FeatureAcquisitionResult> => acquired(featureId);

const tick = async (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let current: FeatureHost | undefined;
let configuration: HostConfiguration = {};

const host = (): FeatureHost => {
  if (current === undefined) throw new Error("Feature host probe is not mounted");
  return current;
};

const Probe = (): ReactElement => {
  current = useFeatureHost({
    initialization: configuration.initialization ?? "new-install",
    onMessage: configuration.onMessage ?? (() => undefined),
    runtimeContext,
    ...(configuration.acquireRuntimeFeature === undefined
      ? {}
      : { acquireRuntimeFeature: configuration.acquireRuntimeFeature }),
    ...(configuration.loadFeatureRuntime === undefined
      ? {}
      : { loadFeatureRuntime: configuration.loadFeatureRuntime }),
    ...(configuration.unavailableFeatures === undefined
      ? {}
      : { unavailableFeatures: configuration.unavailableFeatures }),
  });
  return createElement("output", null, String(current.isEnabled("tools")));
};

const mount = async (next: HostConfiguration = {}): Promise<void> => {
  const element = container;
  if (element === undefined) throw new Error("Feature host test container is unavailable");
  configuration = next;
  root = createRoot(element);
  await act(async () => {
    root?.render(createElement(Probe));
    await tick();
  });
};

const flush = async (): Promise<void> => {
  await act(async () => tick());
};

const unmount = async (): Promise<void> => {
  const mountedRoot = root;
  if (mountedRoot !== undefined) await act(async () => mountedRoot.unmount());
  root = undefined;
  current = undefined;
};

beforeEach(() => {
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(async () => {
  await unmount();
  container?.remove();
  localStorage.clear();
  container = undefined;
  configuration = {};
});

describe("feature host intent ordering", () => {
  test("does not commit a delayed enable after reset", async () => {
    await mount();
    await act(async () => {
      const pendingEnable = host().enable("tools");
      host().reset();
      await pendingEnable;
    });

    expect(host().isEnabled("tools")).toBe(false);
    expect(loadFeaturePreferences("new-install").preferences.enabled).toEqual([
      "people",
      "activity",
    ]);
  });

  test("does not commit a delayed enable after disable", async () => {
    await mount();
    await act(async () => {
      const pendingEnable = host().enable("tools");
      host().disable("tools");
      await pendingEnable;
    });

    expect(host().isEnabled("tools")).toBe(false);
  });

  test("disposes an activation that finishes after disable without committing enablement", async () => {
    const activation = deferred<FeatureDisposer>();
    let activations = 0;
    let disposals = 0;
    const runtime: FeatureRuntime = {
      activate: () => {
        activations += 1;
        return activation.promise;
      },
    };
    await mount({
      acquireRuntimeFeature: acquireImmediately,
      loadFeatureRuntime: async () => runtime,
    });

    let pendingEnable: Promise<void> | undefined;
    await act(async () => {
      pendingEnable = host().enable("tools");
      await tick();
    });
    if (pendingEnable === undefined) throw new Error("Tools enable did not start");
    expect(activations).toBe(1);

    await act(async () => {
      host().disable("tools");
      activation.resolve(() => {
        disposals += 1;
      });
      await pendingEnable;
    });
    await flush();

    expect(disposals).toBe(1);
    expect(host().isEnabled("tools")).toBe(false);
    expect(host().readiness("tools")).toBe("idle");
  });

  test("serializes duplicate enables into one live activation", async () => {
    let activations = 0;
    let disposals = 0;
    const runtime: FeatureRuntime = {
      activate: () => {
        activations += 1;
        return () => {
          disposals += 1;
        };
      },
    };
    await mount({
      acquireRuntimeFeature: acquireImmediately,
      loadFeatureRuntime: async () => runtime,
    });

    await act(async () => {
      await Promise.all([host().enable("tools"), host().enable("tools")]);
    });

    expect(activations).toBe(1);
    expect(host().isEnabled("tools")).toBe(true);
    expect(host().readiness("tools")).toBe("ready");

    await act(async () => {
      host().disable("tools");
      await tick();
    });
    expect(disposals).toBe(1);
  });

  test("keeps enablement off and exposes failed readiness when runtime loading fails", async () => {
    const messages: string[] = [];
    await mount({
      onMessage: (message) => messages.push(message),
      acquireRuntimeFeature: acquireImmediately,
      loadFeatureRuntime: () => Promise.reject(new Error("runtime module rejected")),
    });

    await act(async () => host().enable("tools"));

    expect(host().isEnabled("tools")).toBe(false);
    expect(host().readiness("tools")).toBe("failed");
    expect(messages).toContain("Tools was not enabled: runtime module rejected");
  });

  test("exposes a typed update-required state instead of an endless acquisition retry", async () => {
    await mount({
      acquireRuntimeFeature: async (featureId) => ({
        status: "failed",
        featureId,
        code: "version-mismatch",
        message: "The page and service worker use different builds",
        offlineReady: false,
      }),
    });

    await act(async () => host().enable("tools"));

    expect(host().isEnabled("tools")).toBe(false);
    expect(host().readiness("tools")).toBe("update-required");
    expect(host().libraryEntries.find(({ id }) => id === "tools")?.readiness).toBe(
      "update-required",
    );
  });

  test("disposes on runtime error, reactivates on retry, and disposes once on reset", async () => {
    let activations = 0;
    let disposals = 0;
    const runtime: FeatureRuntime = {
      activate: () => {
        activations += 1;
        return () => {
          disposals += 1;
        };
      },
    };
    await mount({
      acquireRuntimeFeature: acquireImmediately,
      loadFeatureRuntime: async () => runtime,
    });
    await act(async () => host().enable("tools"));

    await act(async () => {
      host().fail("tools", new Error("render failed"));
      await tick();
    });
    expect(disposals).toBe(1);
    expect(host().isEnabled("tools")).toBe(true);
    expect(host().readiness("tools")).toBe("failed");

    await act(async () => host().prepare("tools"));
    expect(activations).toBe(2);
    expect(host().readiness("tools")).toBe("ready");

    await act(async () => {
      host().reset();
      await tick();
    });
    expect(disposals).toBe(2);
    expect(host().isEnabled("tools")).toBe(false);
    expect(host().readiness("tools")).toBe("idle");
  });

  test("activates an enabled migrated runtime on mount and disposes it on unmount", async () => {
    expect(saveFeaturePreferences(createCurrentFeaturePreferences("legacy-v1"))).toEqual({
      ok: true,
    });
    let activations = 0;
    let disposals = 0;
    const runtime: FeatureRuntime = {
      activate: () => {
        activations += 1;
        return () => {
          disposals += 1;
        };
      },
    };
    await mount({
      initialization: "legacy-v1",
      acquireRuntimeFeature: acquireImmediately,
      loadFeatureRuntime: async () => runtime,
    });
    await flush();

    expect(activations).toBe(1);
    expect(host().readiness("tools")).toBe("ready");
    await unmount();
    expect(disposals).toBe(1);
  });

  test("keeps data-unavailable precedence without loading the runtime", async () => {
    let acquisitions = 0;
    let loads = 0;
    await mount({
      unavailableFeatures: ["tools"],
      acquireRuntimeFeature: async (id) => {
        acquisitions += 1;
        return acquired(id);
      },
      loadFeatureRuntime: async () => {
        loads += 1;
        return { activate: () => () => undefined };
      },
    });

    await act(async () => host().enable("tools"));

    expect(host().isEnabled("tools")).toBe(true);
    expect(host().readiness("tools")).toBe("data-unavailable");
    expect(acquisitions).toBe(0);
    expect(loads).toBe(0);
  });
});
