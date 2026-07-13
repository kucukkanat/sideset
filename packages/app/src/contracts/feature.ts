import type { CapabilityConsumption, CapabilityId, CapabilityResolver } from "./capabilities.ts";

export type FeatureKind = "core" | "destination" | "capability" | "experiment";
export type DockIconToken = "gear" | "people" | "tools" | "wallet";
export type PlatformCapabilityId = "clipboard-write" | "file-open" | "file-save" | "network";

export interface FeatureRouteDefinition {
  readonly id: string;
  readonly prefix: `/${string}`;
  readonly dockOwner: string | null;
}

export interface FixedDockDefinition {
  readonly policy: "fixed";
  readonly position: "first" | "last";
  readonly entryPath: `/${string}`;
  readonly label: string;
  readonly icon: DockIconToken;
}

export interface ConfigurableDockDefinition {
  readonly policy: "configurable";
  readonly defaultPinned: boolean;
  readonly entryPath: `/${string}`;
  readonly label: string;
  readonly icon: DockIconToken;
}

interface FeatureDescriptorBase<Id extends string> {
  readonly id: Id;
  readonly title: string;
  readonly summary: string;
  readonly routes: readonly FeatureRouteDefinition[];
  readonly permissions: readonly PlatformCapabilityId[];
  readonly consumes: readonly CapabilityConsumption[];
  readonly provides: readonly CapabilityId[];
  readonly dataVersion?: number;
  readonly maxStoredBytes?: number;
}

export interface CoreFeatureDescriptor<Id extends string = string>
  extends FeatureDescriptorBase<Id> {
  readonly kind: "core";
  readonly defaultEnabled: true;
  readonly dock?: FixedDockDefinition;
}

export interface DestinationFeatureDescriptor<Id extends string = string>
  extends FeatureDescriptorBase<Id> {
  readonly kind: "destination";
  readonly defaultEnabled: boolean;
  readonly dock: ConfigurableDockDefinition;
}

export interface CapabilityFeatureDescriptor<Id extends string = string>
  extends FeatureDescriptorBase<Id> {
  readonly kind: "capability";
  readonly defaultEnabled: boolean;
  readonly dock?: never;
}

export interface ExperimentFeatureDescriptor<Id extends string = string>
  extends FeatureDescriptorBase<Id> {
  readonly kind: "experiment";
  readonly defaultEnabled: false;
  readonly dock?: never;
}

export type FeatureDescriptor<Id extends string = string> =
  | CoreFeatureDescriptor<Id>
  | DestinationFeatureDescriptor<Id>
  | CapabilityFeatureDescriptor<Id>
  | ExperimentFeatureDescriptor<Id>;

export type FeatureDisposer = () => void;

export interface FeatureRuntimeContext {
  readonly capabilities: CapabilityResolver;
}

export interface FeatureRuntime {
  readonly activate: (context: FeatureRuntimeContext) => FeatureDisposer | Promise<FeatureDisposer>;
}

export type FeatureRuntimeLoader<Module extends FeatureRuntime = FeatureRuntime> =
  () => Promise<Module>;

export type RuntimeFeatureManifest<
  Descriptor extends FeatureDescriptor,
  Module extends FeatureRuntime,
> = Descriptor & {
  readonly load: FeatureRuntimeLoader<Module>;
};

export const defineFeature = <const Manifest extends FeatureDescriptor>(
  manifest: Manifest,
): Manifest => manifest;

export const defineRuntimeFeature = <
  const Manifest extends FeatureDescriptor & {
    readonly load: FeatureRuntimeLoader<FeatureRuntime>;
  },
>(
  manifest: Manifest,
): Manifest => manifest;
