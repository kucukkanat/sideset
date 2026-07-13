import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  FEATURE_PREFERENCES_STORAGE_KEY,
  loadFeaturePreferences,
} from "@app/features/preference-storage.ts";
import {
  type FeaturePreferenceMutationResult,
  type FeaturePreferencesController,
  isCurrentFeatureId,
  useFeaturePreferences,
} from "@app/features/useFeaturePreferences.ts";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let current: FeaturePreferencesController | undefined;

const controller = (): FeaturePreferencesController => {
  if (current === undefined) throw new Error("Feature preference probe is not mounted");
  return current;
};

interface ProbeProps {
  readonly initialization: "new-install" | "legacy-v1";
  readonly warnings: string[];
  readonly announcements: string[];
  readonly storage?: Pick<Storage, "getItem" | "setItem">;
}

const Probe = ({ initialization, warnings, announcements, storage }: ProbeProps): ReactElement => {
  current = useFeaturePreferences({
    initialization,
    onWarning: (message) => warnings.push(message),
    onAnnouncement: (message) => announcements.push(message),
    ...(storage === undefined ? {} : { storage }),
  });
  return createElement("output", null, current.persistence.mode);
};

const mount = async (props: ProbeProps): Promise<void> => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(createElement(Probe, props));
  });
};

const invoke = async (
  operation: (preferences: FeaturePreferencesController) => FeaturePreferenceMutationResult,
): Promise<FeaturePreferenceMutationResult> => {
  let result: FeaturePreferenceMutationResult | undefined;
  await act(async () => {
    result = operation(controller());
  });
  if (result === undefined) throw new Error("Feature preference operation did not run");
  return result;
};

beforeEach(() => localStorage.clear());

afterEach(async () => {
  const mountedRoot = root;
  if (mountedRoot !== undefined) {
    await act(async () => {
      mountedRoot.unmount();
    });
  }
  container?.remove();
  localStorage.clear();
  root = undefined;
  container = undefined;
  current = undefined;
});

describe("feature preference controller", () => {
  test("narrows only configurable feature identifiers", () => {
    expect(["people", "activity", "tools"].every(isCurrentFeatureId)).toBe(true);
    expect(isCurrentFeatureId("wallet")).toBe(false);
    expect(isCurrentFeatureId("future-feature")).toBe(false);
  });

  test("persists first-run defaults and returns explicit mutation results", async () => {
    const warnings: string[] = [];
    const announcements: string[] = [];
    await mount({ initialization: "new-install", warnings, announcements });

    expect(controller().persistence).toEqual({ mode: "persistent" });
    expect(loadFeaturePreferences("legacy-v1")).toMatchObject({
      ok: true,
      source: "stored",
      preferences: { initializedFrom: "new-install", pinned: ["people"] },
    });

    const enabled = await invoke(({ enable }) => enable("tools"));
    expect(enabled).toMatchObject({
      ok: true,
      changed: true,
      mutation: { action: "enable", featureId: "tools" },
      persistence: { mode: "persistent" },
      stored: { enabled: ["people", "activity", "tools"], pinned: ["people"] },
    });

    const pinned = await invoke(({ pin }) => pin("tools"));
    expect(pinned).toMatchObject({
      ok: true,
      changed: true,
      normalized: {
        dock: [
          { kind: "fixed", id: "wallet" },
          { kind: "feature", id: "people" },
          { kind: "feature", id: "tools" },
          { kind: "fixed", id: "settings" },
        ],
      },
    });

    const reordered = await invoke(({ reorder }) => reorder("tools", "earlier"));
    expect(reordered).toMatchObject({
      ok: true,
      changed: true,
      stored: { pinned: ["tools", "people"] },
    });
    expect(controller().normalized.pinned).toEqual(["tools", "people"]);
    expect(warnings).toEqual([]);
    expect(announcements).toEqual([
      "Tools turned on.",
      "Tools added to the dock.",
      "Tools moved earlier in the dock.",
    ]);
  });

  test("preserves malformed data through session changes until an explicit reset", async () => {
    const raw = "{broken";
    localStorage.setItem(FEATURE_PREFERENCES_STORAGE_KEY, raw);
    const warnings: string[] = [];
    const announcements: string[] = [];
    await mount({ initialization: "new-install", warnings, announcements });

    expect(controller().persistence).toEqual({ mode: "protected", reason: "invalid" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Existing data was preserved");

    const enabled = await invoke(({ enable }) => enable("tools"));
    expect(enabled).toMatchObject({ ok: true, persistence: { mode: "protected" } });
    expect(controller().stored.enabled).toContain("tools");
    expect(localStorage.getItem(FEATURE_PREFERENCES_STORAGE_KEY)).toBe(raw);

    let resetResult: ReturnType<FeaturePreferencesController["reset"]> | undefined;
    await act(async () => {
      resetResult = controller().reset();
    });
    if (resetResult === undefined) throw new Error("Feature preference reset did not run");
    expect(resetResult).toMatchObject({
      ok: true,
      action: "reset",
      initializedFrom: "new-install",
      persistence: { mode: "persistent" },
      stored: { enabled: ["people", "activity"], pinned: ["people"] },
    });
    expect(localStorage.getItem(FEATURE_PREFERENCES_STORAGE_KEY)).not.toBe(raw);
    expect(announcements).toEqual(["Tools turned on.", "Feature preferences reset."]);
  });

  test("protects newer documents and reports rejected actions without mutating state", async () => {
    const raw = JSON.stringify({ version: 2, enabled: ["future-feature"] });
    localStorage.setItem(FEATURE_PREFERENCES_STORAGE_KEY, raw);
    const warnings: string[] = [];
    const announcements: string[] = [];
    await mount({ initialization: "new-install", warnings, announcements });

    expect(controller().persistence).toEqual({ mode: "protected", reason: "unsupported" });
    const before = controller().stored;
    const rejected = await invoke(({ pin }) => pin("tools"));
    expect(rejected).toEqual({
      ok: false,
      mutation: { action: "pin", featureId: "tools" },
      reason: "not-enabled",
      stored: before,
      normalized: controller().normalized,
      persistence: { mode: "protected", reason: "unsupported" },
    });
    expect(controller().stored).toBe(before);
    expect(localStorage.getItem(FEATURE_PREFERENCES_STORAGE_KEY)).toBe(raw);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("newer version");
    expect(warnings[1]).toBe("Turn on Tools before adding it to the dock.");
    expect(announcements).toEqual([]);
  });

  test("lets an explicit reset recover persistence after a transient write failure", async () => {
    const values = new Map<string, string>();
    let writes = 0;
    const storage = {
      getItem: (key: string): string | null => values.get(key) ?? null,
      setItem: (key: string, value: string): void => {
        writes += 1;
        if (writes === 1) throw new Error("temporarily unavailable");
        values.set(key, value);
      },
    };
    const warnings: string[] = [];
    const announcements: string[] = [];
    await mount({ initialization: "new-install", warnings, announcements, storage });

    expect(controller().persistence).toEqual({ mode: "session-only", reason: "unavailable" });
    expect(values.has(FEATURE_PREFERENCES_STORAGE_KEY)).toBe(false);

    let resetResult: ReturnType<FeaturePreferencesController["reset"]> | undefined;
    await act(async () => {
      resetResult = controller().reset();
    });
    if (resetResult === undefined) throw new Error("Feature preference reset did not run");

    expect(resetResult.persistence).toEqual({ mode: "persistent" });
    expect(controller().persistence).toEqual({ mode: "persistent" });
    expect(loadFeaturePreferences("legacy-v1", storage)).toMatchObject({
      ok: true,
      source: "stored",
      preferences: { initializedFrom: "new-install" },
    });
    expect(warnings).toHaveLength(1);
    expect(announcements).toEqual(["Feature preferences reset."]);
  });

  test("applies a delayed caller through the latest preference state", async () => {
    const warnings: string[] = [];
    const announcements: string[] = [];
    await mount({ initialization: "new-install", warnings, announcements });
    const enableAfterLoad = controller().enable;

    await invoke(({ disable }) => disable("activity"));
    let enabled: FeaturePreferenceMutationResult | undefined;
    await act(async () => {
      enabled = enableAfterLoad("tools");
    });
    if (enabled === undefined) throw new Error("Delayed enable did not run");

    expect(enabled).toMatchObject({ ok: true, changed: true });
    expect(controller().stored.enabled).toEqual(["people", "tools"]);
    expect(loadFeaturePreferences("new-install").preferences.enabled).toEqual(["people", "tools"]);
    expect(warnings).toEqual([]);
  });
});
