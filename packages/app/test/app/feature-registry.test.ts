import { describe, expect, test } from "bun:test";
import { featureById, featureRegistry, isFeatureId } from "@app/features/registry.ts";
import {
  defineFeatureRegistry,
  FeatureRegistryConfigurationError,
  validateFeatureRegistry,
} from "../../src/contracts/feature-registry.ts";
import { activityFeature } from "../../src/features/activity/manifest.ts";
import { peopleFeature } from "../../src/features/contacts/manifest.ts";
import { toolsFeature } from "../../src/features/tools/manifest.ts";
import { walletFeature } from "../../src/features/wallet/manifest.ts";

describe("feature registry", () => {
  test("classifies the current product surface independently from dock placement", () => {
    expect(
      featureRegistry.map((feature) => ({
        id: feature.id,
        kind: feature.kind,
        defaultEnabled: feature.defaultEnabled,
        dock: "dock" in feature ? feature.dock.policy : null,
      })),
    ).toEqual([
      { id: "wallet", kind: "core", defaultEnabled: true, dock: "fixed" },
      { id: "people", kind: "destination", defaultEnabled: true, dock: "configurable" },
      { id: "activity", kind: "capability", defaultEnabled: true, dock: null },
      { id: "tools", kind: "destination", defaultEnabled: false, dock: "configurable" },
      { id: "settings", kind: "core", defaultEnabled: true, dock: "fixed" },
    ]);
  });

  test("derives feature IDs from the registry", () => {
    expect(isFeatureId("tools")).toBe(true);
    expect(isFeatureId("unknown")).toBe(false);
    expect(featureById("people")).toBe(peopleFeature);
  });

  test("loads Tools only through its runtime manifest", async () => {
    const runtime = await toolsFeature.load();
    expect(typeof runtime.Tools).toBe("function");
  });

  test("rejects duplicate identifiers and dependency cycles", () => {
    const duplicate = validateFeatureRegistry([walletFeature, walletFeature]);
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.issues).toContainEqual({ code: "duplicate-feature-id", value: "wallet" });
    expect(duplicate.issues).toContainEqual({ code: "duplicate-route-prefix", value: "/wallet" });

    const cycle = validateFeatureRegistry([
      { ...walletFeature, consumes: [] },
      {
        ...peopleFeature,
        consumes: [{ id: "activity.journal", requirement: "optional", fallback: "drop-fact" }],
      },
      {
        ...activityFeature,
        consumes: [
          {
            id: "people.recipient-source",
            requirement: "optional",
            fallback: "manual-input",
          },
        ],
      },
    ]);
    expect(cycle.ok).toBe(false);
    if (cycle.ok) return;
    expect(cycle.issues.some(({ code }) => code === "dependency-cycle")).toBe(true);
  });

  test("fails loudly when an invalid registry is defined", () => {
    expect(() => defineFeatureRegistry(walletFeature, walletFeature)).toThrow(
      FeatureRegistryConfigurationError,
    );
  });
});
