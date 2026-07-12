import type { Card, Contact, IdentityKeyPair, Proof, ProviderId } from "@keychain/core";
import type { ActivityIcon, ActivityItem } from "./activity.ts";
import { isAvatar } from "./avatar.ts";

export const WALLET_STORAGE_KEY = "keychain.wallet.v1";
export const MAX_CARDS = 100;
export const MAX_CONTACTS = 500;

const PROVIDERS: readonly ProviderId[] = [
  "twitter",
  "github",
  "reddit",
  "facebook",
  "slack",
  "confluence",
  "email",
];

export type Theme = "system" | "light" | "dark";

export interface WalletState {
  readonly cards: readonly Card[];
  readonly contacts: readonly Contact[];
  readonly activeId: string;
  readonly theme: Theme;
  readonly activity: readonly ActivityItem[];
}

export interface WalletSnapshotV1 extends WalletState {
  readonly version: 1;
}

export type SnapshotResult =
  | { readonly ok: true; readonly state: WalletState }
  | { readonly ok: false; readonly reason: "invalid" | "unsupported" };

export type StorageResult =
  | { readonly ok: true; readonly state: WalletState }
  | {
      readonly ok: false;
      readonly state: WalletState;
      readonly reason: "unavailable" | "invalid" | "unsupported";
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isText = (value: unknown, max: number, allowEmpty = true): value is string =>
  typeof value === "string" && value.length <= max && (allowEmpty || value.length > 0);

const isProvider = (value: unknown): value is ProviderId =>
  typeof value === "string" && PROVIDERS.some((provider) => provider === value);

const isNostrKey = (value: string): boolean => /^[0-9a-f]{64}$/u.test(value);

const isIdentity = (value: unknown): value is IdentityKeyPair =>
  isRecord(value) &&
  typeof value.publicKey === "string" &&
  typeof value.privateKey === "string" &&
  isNostrKey(value.publicKey) &&
  isNostrKey(value.privateKey);

const isProof = (value: unknown): value is Proof =>
  isRecord(value) &&
  isProvider(value.provider) &&
  isText(value.username, 120, false) &&
  (value.verificationCode === undefined || isText(value.verificationCode, 2_000, false));

const hasUniqueProofs = (value: unknown[]): value is Proof[] =>
  value.every(isProof) && new Set(value.map((proof) => proof.provider)).size === value.length;

const isCard = (value: unknown): value is Card =>
  isRecord(value) &&
  isText(value.id, 100, false) &&
  isText(value.name, 50, false) &&
  isText(value.handle, 80) &&
  (value.username === undefined || isText(value.username, 80)) &&
  (value.email === undefined || isText(value.email, 254)) &&
  isAvatar(value.avatar) &&
  typeof value.color === "number" &&
  Number.isInteger(value.color) &&
  isText(value.tag, 100) &&
  isText(value.bio, 280) &&
  (value.proofs === undefined ||
    (Array.isArray(value.proofs) &&
      value.proofs.length <= PROVIDERS.length &&
      hasUniqueProofs(value.proofs))) &&
  (value.identity === undefined || isIdentity(value.identity));

const isContact = (value: unknown): value is Contact =>
  isRecord(value) &&
  isText(value.id, 100, false) &&
  isText(value.name, 80, false) &&
  isText(value.handle, 81, false) &&
  value.handle.startsWith("@") &&
  isText(value.avatar, 16, false) &&
  typeof value.color === "number" &&
  Number.isInteger(value.color) &&
  typeof value.mutuals === "number" &&
  Number.isInteger(value.mutuals) &&
  isText(value.bio, 280) &&
  Array.isArray(value.proofs) &&
  value.proofs.length <= PROVIDERS.length &&
  hasUniqueProofs(value.proofs) &&
  isText(value.npub, 200);

const isActivityIcon = (value: unknown): value is ActivityIcon => {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  return value.kind === "provider"
    ? isProvider(value.provider)
    : value.kind === "emoji" &&
        isText(value.emoji, 16, false) &&
        typeof value.bg === "string" &&
        /^#[0-9A-Fa-f]{6}$/u.test(value.bg);
};

const isActivity = (value: unknown): value is ActivityItem =>
  isRecord(value) &&
  isText(value.id, 100, false) &&
  isActivityIcon(value.icon) &&
  isText(value.title, 160, false) &&
  isText(value.sub, 240) &&
  typeof value.occurredAt === "number" &&
  Number.isFinite(value.occurredAt);

const isTheme = (value: unknown): value is Theme =>
  value === "system" || value === "light" || value === "dark";

const normalizeCard = (card: Card): Card => ({
  ...card,
  username: card.username ?? card.handle,
  email: card.email ?? card.proofs?.find((proof) => proof.provider === "email")?.username ?? "",
});

export const createInitialWalletState = (_now = Date.now()): WalletState => ({
  cards: [],
  contacts: [],
  activeId: "",
  theme: "system",
  activity: [],
});

export const walletSnapshot = (state: WalletState): WalletSnapshotV1 => ({ version: 1, ...state });

export const decodeWalletSnapshot = (value: unknown): SnapshotResult => {
  if (!isRecord(value)) return { ok: false, reason: "invalid" };
  if (typeof value.version !== "number" || !Number.isInteger(value.version)) {
    return { ok: false, reason: "invalid" };
  }
  if (value.version !== 1) return { ok: false, reason: "unsupported" };
  const cards = value.cards;
  const contacts = value.contacts;
  const activity = value.activity;
  if (
    !Array.isArray(cards) ||
    cards.length > MAX_CARDS ||
    !cards.every(isCard) ||
    new Set(cards.map((card) => card.id)).size !== cards.length ||
    !Array.isArray(contacts) ||
    contacts.length > MAX_CONTACTS ||
    !contacts.every(isContact) ||
    new Set(contacts.map((person) => person.id)).size !== contacts.length ||
    typeof value.activeId !== "string" ||
    (cards.length === 0
      ? value.activeId !== ""
      : !cards.some((card) => card.id === value.activeId)) ||
    !isTheme(value.theme) ||
    !Array.isArray(activity) ||
    activity.length > 100 ||
    !activity.every(isActivity) ||
    new Set(activity.map((item) => item.id)).size !== activity.length
  ) {
    return { ok: false, reason: "invalid" };
  }
  return {
    ok: true,
    state: {
      cards: cards.map(normalizeCard),
      contacts,
      activeId: value.activeId,
      theme: value.theme,
      activity,
    },
  };
};

export const loadWalletState = (
  storage: Pick<Storage, "getItem"> = localStorage,
): StorageResult => {
  const fallback = createInitialWalletState();
  let stored: string | null;
  try {
    stored = storage.getItem(WALLET_STORAGE_KEY);
  } catch {
    return { ok: false, state: fallback, reason: "unavailable" };
  }
  if (stored === null) return { ok: true, state: fallback };
  try {
    const decoded = decodeWalletSnapshot(JSON.parse(stored));
    return decoded.ok
      ? { ok: true, state: decoded.state }
      : { ok: false, state: fallback, reason: decoded.reason };
  } catch {
    return { ok: false, state: fallback, reason: "invalid" };
  }
};

export const saveWalletState = (
  state: WalletState,
  storage: Pick<Storage, "setItem"> = localStorage,
): { readonly ok: true } | { readonly ok: false; readonly reason: "invalid" | "unavailable" } => {
  const snapshot = walletSnapshot(state);
  if (!decodeWalletSnapshot(snapshot).ok) return { ok: false, reason: "invalid" };
  try {
    storage.setItem(WALLET_STORAGE_KEY, JSON.stringify(snapshot));
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
};
