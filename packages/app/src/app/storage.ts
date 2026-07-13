import {
  createInitialWalletState,
  decodeWalletSnapshot,
  isRecord,
  MAX_CARDS,
  MAX_CONTACTS,
  walletSnapshot,
} from "./storage/codecs.ts";
import type { WalletSnapshotV1, WalletState } from "./storage/model.ts";
import {
  ACTIVITY_STORAGE_KEY,
  loadPersistedWalletState,
  MAX_ACTIVITY_STORAGE_BYTES,
  MAX_COMMITTED_STORAGE_BYTES,
  MAX_PEOPLE_STORAGE_BYTES,
  PEOPLE_STORAGE_KEY,
  resetPersistedWalletState,
  savePersistedWalletState,
  WALLET_STORAGE_KEY,
  walletPreferenceInitialization,
  walletStorageCapacityForChange,
} from "./storage/persistence.ts";

export type {
  FeatureStorageIssue,
  FeatureStorageNamespace,
  SnapshotResult,
  StorageResult,
  Theme,
  WalletSnapshotV1,
  WalletState,
} from "./storage/model.ts";
export type {
  WalletSaveOptions,
  WalletSaveResult,
  WalletStorageCapacity,
} from "./storage/persistence.ts";
export {
  ACTIVITY_STORAGE_KEY,
  createInitialWalletState,
  decodeWalletSnapshot,
  MAX_ACTIVITY_STORAGE_BYTES,
  MAX_CARDS,
  MAX_COMMITTED_STORAGE_BYTES,
  MAX_CONTACTS,
  MAX_PEOPLE_STORAGE_BYTES,
  PEOPLE_STORAGE_KEY,
  WALLET_STORAGE_KEY,
  walletPreferenceInitialization,
  walletSnapshot,
  walletStorageCapacityForChange,
};

export interface WalletBackupV2 {
  readonly version: 2;
  readonly included: { readonly settings: boolean; readonly contacts: boolean };
  readonly state: WalletSnapshotV1;
}

export const walletBackup = (
  state: WalletState,
  selection: {
    readonly cardIds: readonly string[];
    readonly settings: boolean;
    readonly contacts: boolean;
  },
): WalletBackupV2 => {
  const cards = state.cards.filter(({ id }) => selection.cardIds.includes(id));
  return {
    version: 2,
    included: { settings: selection.settings, contacts: selection.contacts },
    state: walletSnapshot({
      cards,
      contacts: selection.contacts ? state.contacts : [],
      activeId: cards.some(({ id }) => id === state.activeId)
        ? state.activeId
        : (cards[0]?.id ?? ""),
      theme: selection.settings ? state.theme : "system",
      activity: selection.settings ? state.activity : [],
    }),
  };
};

export type BackupDecodeResult =
  | {
      readonly ok: true;
      readonly state: WalletState;
      readonly included: { readonly settings: boolean; readonly contacts: boolean };
    }
  | { readonly ok: false; readonly reason: "invalid" | "unsupported" };

export const decodeWalletBackup = (value: unknown): BackupDecodeResult => {
  if (isRecord(value) && value.version === 2) {
    if (
      !isRecord(value.included) ||
      typeof value.included.settings !== "boolean" ||
      typeof value.included.contacts !== "boolean"
    ) {
      return { ok: false, reason: "invalid" };
    }
    const decoded = decodeWalletSnapshot(value.state);
    return decoded.ok
      ? {
          ok: true,
          state: decoded.state,
          included: { settings: value.included.settings, contacts: value.included.contacts },
        }
      : decoded;
  }
  const decoded = decodeWalletSnapshot(value);
  return decoded.ok
    ? { ok: true, state: decoded.state, included: { settings: true, contacts: true } }
    : decoded;
};

export const loadWalletState = loadPersistedWalletState;
export const saveWalletState = savePersistedWalletState;

/** Destructive reset is explicit so automatic saves cannot replace protected feature data. */
export const resetWalletState = resetPersistedWalletState;
