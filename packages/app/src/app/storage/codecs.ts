import {
  type ActivityIcon,
  type ActivityItem,
  MAX_ACTIVITY_ITEMS,
} from "@features/activity/activity.ts";
import type { Card, Contact, IdentityKeyPair, Proof, ProviderId } from "@keychain/core";
import { isAvatar } from "@shared/lib/avatar.ts";
import type { SnapshotResult, Theme, WalletSnapshotV1, WalletState } from "./model.ts";

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

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

const hasUniqueProofs = (value: readonly unknown[]): value is readonly Proof[] =>
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
  isAvatar(value.avatar) &&
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

export const isTheme = (value: unknown): value is Theme =>
  value === "system" || value === "light" || value === "dark";

const uniqueById = <Value extends { readonly id: string }>(values: readonly Value[]): boolean =>
  new Set(values.map(({ id }) => id)).size === values.length;

export const decodeCards = (value: unknown): readonly Card[] | null => {
  if (!Array.isArray(value) || value.length > MAX_CARDS || !value.every(isCard)) return null;
  if (!uniqueById(value)) return null;
  return value.map((card) => ({
    ...card,
    username: card.username ?? card.handle,
    email: card.email ?? card.proofs?.find((proof) => proof.provider === "email")?.username ?? "",
  }));
};

export const decodeContacts = (value: unknown): readonly Contact[] | null => {
  if (!Array.isArray(value) || value.length > MAX_CONTACTS || !value.every(isContact)) return null;
  return uniqueById(value) ? value : null;
};

export const decodeActivity = (value: unknown): readonly ActivityItem[] | null => {
  if (!Array.isArray(value) || value.length > MAX_ACTIVITY_ITEMS || !value.every(isActivity)) {
    return null;
  }
  return uniqueById(value) ? value : null;
};

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
  const cards = decodeCards(value.cards);
  const contacts = decodeContacts(value.contacts);
  const activity = decodeActivity(value.activity);
  if (
    cards === null ||
    contacts === null ||
    activity === null ||
    typeof value.activeId !== "string" ||
    (cards.length === 0
      ? value.activeId !== ""
      : !cards.some((card) => card.id === value.activeId)) ||
    !isTheme(value.theme)
  ) {
    return { ok: false, reason: "invalid" };
  }
  return {
    ok: true,
    state: { cards, contacts, activeId: value.activeId, theme: value.theme, activity },
  };
};
