import type { ActivityItem } from "@features/activity/activity.ts";
import type { Card, Contact } from "@keychain/core";

export type Theme = "system" | "light" | "dark";

export interface WalletState {
  readonly cards: readonly Card[];
  readonly contacts: readonly Contact[];
  readonly activeId: string;
  readonly theme: Theme;
  readonly activity: readonly ActivityItem[];
}

/** Portable aggregate format used by backups and legacy storage migration. */
export interface WalletSnapshotV1 extends WalletState {
  readonly version: 1;
}

export type SnapshotResult =
  | { readonly ok: true; readonly state: WalletState }
  | { readonly ok: false; readonly reason: "invalid" | "unsupported" };

export type FeatureStorageNamespace = "people" | "activity";

export interface FeatureStorageIssue {
  readonly feature: FeatureStorageNamespace;
  readonly reason: "invalid" | "unsupported" | "unavailable" | "missing-revision" | "protected";
}

export type StorageResult =
  | {
      readonly ok: true;
      readonly state: WalletState;
      readonly issues?: readonly FeatureStorageIssue[];
      /** Optional namespaces that could not supply the revision referenced by split core. */
      readonly unavailableFeatures?: readonly FeatureStorageNamespace[];
    }
  | {
      readonly ok: false;
      readonly state: WalletState;
      readonly reason: "unavailable" | "invalid" | "unsupported";
    };
