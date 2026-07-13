import type { CapabilityId } from "./capabilities.ts";
import type { FeatureDescriptor } from "./feature.ts";

export type FeatureRegistryIssue =
  | { readonly code: "dependency-cycle"; readonly value: string }
  | { readonly code: "duplicate-capability-provider"; readonly value: CapabilityId }
  | { readonly code: "duplicate-feature-id"; readonly value: string }
  | { readonly code: "duplicate-route-id"; readonly value: string }
  | { readonly code: "duplicate-route-prefix"; readonly value: string }
  | { readonly code: "invalid-feature-id"; readonly value: string }
  | { readonly code: "invalid-route-id"; readonly value: string }
  | { readonly code: "invalid-route-prefix"; readonly value: string }
  | { readonly code: "invalid-storage-budget"; readonly value: string }
  | { readonly code: "missing-required-core-provider"; readonly value: CapabilityId }
  | { readonly code: "unknown-dock-owner"; readonly value: string };

export type FeatureRegistryValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly FeatureRegistryIssue[] };

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;
const ROUTE_PREFIX = /^\/[a-z][a-z0-9-]*$/u;

const duplicates = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate];
};

const dependencyCycles = (features: readonly FeatureDescriptor[]): readonly string[] => {
  const providerByCapability = new Map<CapabilityId, string>();
  for (const feature of features) {
    for (const capability of feature.provides) providerByCapability.set(capability, feature.id);
  }

  const dependencies = new Map<string, ReadonlySet<string>>();
  for (const feature of features) {
    dependencies.set(
      feature.id,
      new Set(
        feature.consumes.flatMap(({ id }) => {
          const provider = providerByCapability.get(id);
          return provider === undefined ? [] : [provider];
        }),
      ),
    );
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const cycles = new Set<string>();
  const visit = (id: string, path: readonly string[]): void => {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      cycles.add([...path.slice(start), id].join(" -> "));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) visit(dependency, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const feature of features) visit(feature.id, []);
  return [...cycles];
};

export const validateFeatureRegistry = (
  features: readonly FeatureDescriptor[],
): FeatureRegistryValidation => {
  const issues: FeatureRegistryIssue[] = [];
  const featureIds = features.map(({ id }) => id);
  const routes = features.flatMap(({ routes: definitions }) => definitions);

  for (const id of featureIds) {
    if (!IDENTIFIER.test(id)) issues.push({ code: "invalid-feature-id", value: id });
  }
  for (const id of duplicates(featureIds)) issues.push({ code: "duplicate-feature-id", value: id });
  for (const id of routes.map(({ id }) => id)) {
    if (!IDENTIFIER.test(id)) issues.push({ code: "invalid-route-id", value: id });
  }
  for (const id of duplicates(routes.map(({ id }) => id))) {
    issues.push({ code: "duplicate-route-id", value: id });
  }
  for (const prefix of routes.map(({ prefix }) => prefix)) {
    if (!ROUTE_PREFIX.test(prefix)) issues.push({ code: "invalid-route-prefix", value: prefix });
  }
  for (const prefix of duplicates(routes.map(({ prefix }) => prefix))) {
    issues.push({ code: "duplicate-route-prefix", value: prefix });
  }

  const dockIds = new Set(
    features.flatMap((feature) => (feature.dock === undefined ? [] : [feature.id])),
  );
  for (const { dockOwner } of routes) {
    if (dockOwner !== null && !dockIds.has(dockOwner)) {
      issues.push({ code: "unknown-dock-owner", value: dockOwner });
    }
  }

  const providers = new Map<CapabilityId, readonly FeatureDescriptor[]>();
  for (const feature of features) {
    for (const capability of feature.provides) {
      providers.set(capability, [...(providers.get(capability) ?? []), feature]);
    }
  }
  for (const [capability, capabilityProviders] of providers) {
    if (capabilityProviders.length > 1) {
      issues.push({ code: "duplicate-capability-provider", value: capability });
    }
  }
  for (const feature of features) {
    for (const consumption of feature.consumes) {
      if (consumption.requirement !== "required-core") continue;
      const capabilityProviders = providers.get(consumption.id) ?? [];
      if (capabilityProviders.length !== 1 || capabilityProviders[0]?.kind !== "core") {
        issues.push({ code: "missing-required-core-provider", value: consumption.id });
      }
    }
    const hasVersion = feature.dataVersion !== undefined;
    const hasBudget = feature.maxStoredBytes !== undefined;
    if (
      hasVersion !== hasBudget ||
      (feature.dataVersion !== undefined && feature.dataVersion < 1) ||
      (feature.maxStoredBytes !== undefined && feature.maxStoredBytes < 1)
    ) {
      issues.push({ code: "invalid-storage-budget", value: feature.id });
    }
  }
  for (const cycle of dependencyCycles(features)) {
    issues.push({ code: "dependency-cycle", value: cycle });
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
};

export class FeatureRegistryConfigurationError extends Error {
  readonly issues: readonly FeatureRegistryIssue[];

  constructor(issues: readonly FeatureRegistryIssue[]) {
    super(
      `Invalid feature registry: ${issues.map(({ code, value }) => `${code} (${value})`).join(", ")}`,
    );
    this.name = "FeatureRegistryConfigurationError";
    this.issues = issues;
  }
}

export const defineFeatureRegistry = <const Registry extends readonly FeatureDescriptor[]>(
  ...features: Registry
): Registry => {
  const validation = validateFeatureRegistry(features);
  if (!validation.ok) throw new FeatureRegistryConfigurationError(validation.issues);
  return features;
};
