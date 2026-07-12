import type { Card, Contact, Proof, ProviderId } from "@keychain/core";
import { verifySignedProof } from "./accountVerification.ts";

export interface SharedProfile {
  readonly version: 1;
  readonly sourceId: string;
  readonly identityId?: string;
  readonly publicKey?: string;
  readonly name: string;
  readonly handle: string;
  readonly avatar: string;
  readonly color: number;
  readonly bio: string;
  readonly proofs?: readonly Proof[];
}

export type SharedProfileVerificationResult =
  | { readonly ok: true; readonly proofs: readonly Proof[] }
  | { readonly ok: false; readonly reason: "invalid-signature" };

export type SharedProfileResult =
  | { readonly ok: true; readonly profile: SharedProfile }
  | { readonly ok: false; readonly reason: "invalid" | "unsupported" };

type ShareableProfile = Pick<Card, "id" | "name" | "handle" | "avatar" | "color" | "bio"> & {
  readonly npub?: string;
  readonly identity?: Card["identity"];
  readonly proofs?: readonly Proof[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSharedHandle = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const handle = value.trim();
  if (handle.length === 0 || handle === "@") return false;
  return handle.startsWith("@") ? handle.length <= 81 : handle.length <= 80;
};

const isProvider = (value: unknown): value is ProviderId =>
  value === "twitter" ||
  value === "github" ||
  value === "reddit" ||
  value === "facebook" ||
  value === "slack" ||
  value === "confluence" ||
  value === "email";

const isBase64Url = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]+$/u.test(value);

export const parseEd25519PublicKey = (value: string): string | null => {
  const normalized = value.trim();
  return normalized.length === 43 && isBase64Url(normalized) ? normalized : null;
};

const isEd25519PublicKey = (value: string): boolean => parseEd25519PublicKey(value) !== null;

export const sharedProfileFromPublicKey = (
  value: string,
  displayName: string,
): SharedProfile | null => {
  const publicKey = parseEd25519PublicKey(value);
  const name = displayName.trim();
  if (publicKey === null || name.length === 0 || name.length > 80) return null;
  return {
    version: 1,
    sourceId: publicKey,
    publicKey,
    name,
    handle: `${publicKey.slice(0, 8)}…${publicKey.slice(-6)}`,
    avatar: "🔑",
    color: 3,
    bio: "",
  };
};

const isSharedProof = (value: unknown): value is Proof => {
  if (!isRecord(value) || !isProvider(value.provider)) return false;
  return (
    typeof value.username === "string" &&
    value.username.trim().length > 0 &&
    value.username.length <= 120 &&
    typeof value.verificationCode === "string" &&
    value.verificationCode.length > 0 &&
    value.verificationCode.length <= 512
  );
};

const toBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

const fromBase64Url = (value: string): string => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder(undefined, { fatal: true }).decode(bytes);
};

export const encodeSharedProfile = (profile: ShareableProfile): string => {
  const identityId = profile.npub?.trim();
  const publicKey =
    profile.identity?.publicKey?.trim() ??
    (identityId !== undefined && isEd25519PublicKey(identityId) ? identityId : undefined);
  const proofs = (profile.proofs ?? [])
    .filter((proof) => proof.verificationCode !== undefined)
    .map((proof) => ({
      provider: proof.provider,
      username: proof.username,
      ...(proof.verificationCode === undefined ? {} : { verificationCode: proof.verificationCode }),
    }));
  return toBase64Url(
    JSON.stringify({
      version: 1,
      sourceId: profile.id,
      ...(identityId && identityId !== publicKey ? { identityId } : {}),
      ...(publicKey ? { publicKey } : {}),
      name: profile.name,
      handle: profile.handle,
      avatar: profile.avatar,
      color: profile.color,
      bio: profile.bio,
      ...(proofs.length > 0 ? { proofs } : {}),
    } satisfies SharedProfile),
  );
};

export const decodeSharedProfile = (encoded: string): SharedProfileResult => {
  if (encoded.length === 0 || encoded.length > 12_000) return { ok: false, reason: "invalid" };
  try {
    const value: unknown = JSON.parse(fromBase64Url(encoded));
    if (!isRecord(value)) return { ok: false, reason: "invalid" };
    if (typeof value.version !== "number" || !Number.isInteger(value.version)) {
      return { ok: false, reason: "invalid" };
    }
    if (value.version !== 1) return { ok: false, reason: "unsupported" };
    const identityId = value.identityId;
    const publicKey = value.publicKey;
    const proofs = value.proofs;
    if (
      typeof value.sourceId !== "string" ||
      value.sourceId.trim().length === 0 ||
      value.sourceId.length > 100 ||
      (identityId !== undefined &&
        (typeof identityId !== "string" ||
          identityId.trim().length === 0 ||
          identityId.length > 200)) ||
      (publicKey !== undefined &&
        (typeof publicKey !== "string" || !isBase64Url(publicKey) || publicKey.length > 100)) ||
      typeof value.name !== "string" ||
      value.name.trim().length === 0 ||
      value.name.length > 80 ||
      !isSharedHandle(value.handle) ||
      typeof value.avatar !== "string" ||
      value.avatar.trim().length === 0 ||
      value.avatar.length > 16 ||
      typeof value.color !== "number" ||
      !Number.isInteger(value.color) ||
      typeof value.bio !== "string" ||
      value.bio.length > 280 ||
      (proofs !== undefined &&
        (!Array.isArray(proofs) || proofs.length > 7 || !proofs.every(isSharedProof)))
    ) {
      return { ok: false, reason: "invalid" };
    }
    return {
      ok: true,
      profile: {
        version: 1,
        sourceId: value.sourceId.trim(),
        ...(typeof identityId === "string" ? { identityId: identityId.trim() } : {}),
        ...(typeof publicKey === "string" ? { publicKey: publicKey.trim() } : {}),
        name: value.name.trim(),
        handle: value.handle.trim(),
        avatar: value.avatar.trim(),
        color: value.color,
        bio: value.bio,
        ...(Array.isArray(proofs) ? { proofs } : {}),
      },
    };
  } catch {
    return { ok: false, reason: "invalid" };
  }
};

export const verifySharedProfile = async (
  profile: SharedProfile,
): Promise<SharedProfileVerificationResult> => {
  const proofs = profile.proofs ?? [];
  if (proofs.length === 0) return { ok: true, proofs: [] };
  if (profile.publicKey === undefined) return { ok: false, reason: "invalid-signature" };
  for (const proof of proofs) {
    if (
      proof.verificationCode === undefined ||
      !(await verifySignedProof(proof.verificationCode, {
        provider: proof.provider,
        username: proof.username,
        publicKey: profile.publicKey,
      }))
    ) {
      return { ok: false, reason: "invalid-signature" };
    }
  }
  return { ok: true, proofs };
};

export const sharedProfileTokenFromInput = (input: string, baseUrl: string): string | null => {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  try {
    const url = new URL(trimmed, baseUrl);
    const queryStart = url.hash.indexOf("?");
    if (queryStart === -1) return null;
    if (url.hash.slice(0, queryStart) !== "#/people") return null;
    const params = new URLSearchParams(url.hash.slice(queryStart + 1));
    const sheets = params.getAll("sheet");
    const profiles = params.getAll("profile");
    if (sheets.length !== 1 || sheets[0] !== "add" || profiles.length !== 1) return null;
    return profiles[0] ?? null;
  } catch {
    return null;
  }
};

const stableId = (value: string): string => {
  let hash = 0xcbf29ce484222325n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `p-${hash.toString(36)}`;
};

export const sharedProfileToContact = (
  profile: SharedProfile,
  verifiedProofs: readonly Proof[] = [],
): Contact => ({
  id: stableId(profile.publicKey ?? profile.identityId ?? profile.sourceId),
  name: profile.name,
  handle: profile.handle.startsWith("@") ? profile.handle : `@${profile.handle}`,
  avatar: profile.avatar,
  color: profile.color,
  mutuals: 0,
  bio: profile.bio,
  proofs: verifiedProofs,
  npub: profile.publicKey ?? profile.identityId ?? "",
});
