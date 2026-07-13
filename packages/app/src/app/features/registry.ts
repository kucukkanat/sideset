import type { DockIconToken, FeatureRouteDefinition } from "../../contracts/feature.ts";
import { defineFeatureRegistry } from "../../contracts/feature-registry.ts";
import { activityFeature } from "../../features/activity/manifest.ts";
import { peopleFeature } from "../../features/contacts/manifest.ts";
import { settingsFeature } from "../../features/settings/manifest.ts";
import { toolsFeature } from "../../features/tools/manifest.ts";
import { walletFeature } from "../../features/wallet/manifest.ts";

export const featureRegistry = defineFeatureRegistry(
  walletFeature,
  peopleFeature,
  activityFeature,
  toolsFeature,
  settingsFeature,
);

export type RegisteredFeature = (typeof featureRegistry)[number];
export type FeatureId = RegisteredFeature["id"];

export const isFeatureId = (value: string): value is FeatureId =>
  featureRegistry.some(({ id }) => id === value);

export const featureById = <Id extends FeatureId>(
  id: Id,
): Extract<RegisteredFeature, { readonly id: Id }> => {
  const feature = featureRegistry.find((candidate) => candidate.id === id);
  if (feature === undefined) throw new Error(`Registered feature is missing: ${id}`);
  return feature as Extract<RegisteredFeature, { readonly id: Id }>;
};

export interface DockFeature {
  readonly id: FeatureId;
  readonly label: string;
  readonly icon: DockIconToken;
  readonly entryPath: `/${string}`;
}

export const dockFeatureById = (id: FeatureId): DockFeature => {
  const feature = featureById(id);
  if (!("dock" in feature) || feature.dock === undefined) {
    throw new TypeError(`${id} is not dock eligible`);
  }
  return {
    id: feature.id,
    label: feature.dock.label,
    icon: feature.dock.icon,
    entryPath: feature.dock.entryPath,
  };
};

interface RegisteredRoute {
  readonly featureId: FeatureId;
  readonly route: FeatureRouteDefinition;
}

const registeredRoutes = featureRegistry.flatMap((feature): readonly RegisteredRoute[] =>
  feature.routes.map((route) => ({ featureId: feature.id, route })),
);

const registeredRouteForPath = (pathname: string): RegisteredRoute | undefined =>
  registeredRoutes
    .filter(({ route }) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`))
    .sort((left, right) => right.route.prefix.length - left.route.prefix.length)[0];

export const featureOwnerForPath = (pathname: string): FeatureId | null =>
  registeredRouteForPath(pathname)?.featureId ?? null;

export const dockOwnerForPath = (pathname: string): FeatureId | null => {
  const match = registeredRouteForPath(pathname)?.route;
  return match !== undefined && match.dockOwner !== null && isFeatureId(match.dockOwner)
    ? match.dockOwner
    : null;
};
