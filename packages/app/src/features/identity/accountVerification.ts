import type { Card, IdentityKeyPair, ProviderId } from "@keychain/core";
import { generateNostrIdentity } from "@shared/lib/nostrKeys.ts";
import { nip19 } from "nostr-tools";
import { finalizeEvent, getPublicKey, type NostrEvent, verifyEvent } from "nostr-tools/pure";

export type GithubProfile = {
  readonly login: string;
  readonly bio: string | null;
};

export type GithubVerificationResult =
  | { readonly ok: true; readonly username: string; readonly verificationCode: string }
  | {
      readonly ok: false;
      readonly reason:
        | "invalid-username"
        | "not-found"
        | "rate-limited"
        | "network"
        | "missing-code"
        | "invalid-code";
    };

type SignedProofEnvelope = {
  readonly version: 1;
  readonly event: NostrEvent;
};

const GITHUB_USERNAME = /^(?!-)[A-Za-z0-9-]{1,39}(?<!-)$/;

export const isGithubUsername = (value: string): boolean => GITHUB_USERNAME.test(value.trim());

export const githubProfileSettingsUrl = "https://github.com/settings/profile";

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

const fromBase64Url = (value: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
};

const decodeJson = (value: string): Record<string, unknown> | null => {
  const bytes = fromBase64Url(value);
  if (bytes === null) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder(undefined, { fatal: true }).decode(bytes));
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const proofMessage = (
  provider: ProviderId,
  username: string,
  publicKey: string,
  nonce: string,
): Uint8Array =>
  new TextEncoder().encode(`keychain-proof-v1|${provider}|${username}|${publicKey}|${nonce}`);

export const generateIdentityKeyPair = async (): Promise<IdentityKeyPair> => {
  return generateNostrIdentity();
};

const toHex = (value: Uint8Array): string =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** Accept the portable Nostr secret-key format, then derive the matching public key. */
export const identityFromPrivateKey = (value: string): IdentityKeyPair | null => {
  const normalized = value.trim();
  try {
    const decoded = nip19.decode(normalized);
    if (decoded.type !== "nsec") return null;
    const secret = decoded.data;
    return { privateKey: toHex(secret), publicKey: getPublicKey(secret) };
  } catch {
    return null;
  }
};

export const createGithubVerificationCode = async (
  identity: IdentityKeyPair,
  username: string,
): Promise<string> => {
  const normalized = username.trim();
  if (!isGithubUsername(normalized)) throw new TypeError("Invalid GitHub username");
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(12)));
  const event = finalizeEvent(
    {
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["nonce", nonce]],
      content: new TextDecoder().decode(
        proofMessage("github", normalized, identity.publicKey, nonce),
      ),
    },
    Uint8Array.from(identity.privateKey.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16)),
  );
  return `kc1.${toBase64Url(new TextEncoder().encode(JSON.stringify(event)))}`;
};

const parseSignedProof = (code: string): SignedProofEnvelope | null => {
  const parts = code.trim().split(".");
  if (parts.length !== 2 || parts[0] !== "kc1" || parts[1] === undefined) return null;
  const decoded = decodeJson(parts[1]);
  if (decoded === null) return null;
  const event = decoded as NostrEvent;
  return verifyEvent(event) ? { version: 1, event } : null;
};

export const verifySignedProof = async (
  code: string,
  expected: {
    readonly provider: ProviderId;
    readonly username: string;
    readonly publicKey: string;
  },
): Promise<boolean> => {
  const parsed = parseSignedProof(code);
  if (parsed === null || expected.publicKey.length === 0) return false;
  const nonce = parsed.event.tags.find((tag) => tag[0] === "nonce")?.[1];
  if (nonce === undefined || parsed.event.pubkey !== expected.publicKey) return false;
  return (
    parsed.event.content ===
    new TextDecoder().decode(
      proofMessage(expected.provider, expected.username.trim(), expected.publicKey, nonce),
    )
  );
};

export const addVerifiedGithubProof = (
  cards: readonly Card[],
  cardId: string,
  username: string,
  verificationCode: string,
  identity: IdentityKeyPair,
): readonly Card[] => {
  const normalized = username.trim();
  if (normalized.length === 0 || verificationCode.trim().length === 0) return cards;
  return cards.map((card) => {
    if (card.id !== cardId) return card;
    const proofs = card.proofs ?? [];
    const existing = proofs.find((proof) => proof.provider === "github");
    if (existing?.verificationCode !== undefined) return card;
    return {
      ...card,
      identity,
      proofs: [
        ...proofs.filter((proof) => proof.provider !== "github"),
        { provider: "github", username: normalized, verificationCode },
      ],
    };
  });
};

/** Keep provider responses untrusted until the fields used by the verifier are validated. */
export const parseGithubProfile = (value: unknown): GithubProfile | null => {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const login = record.login;
  const bio = record.bio;
  if (typeof login !== "string" || !isGithubUsername(login)) return null;
  if (bio !== null && typeof bio !== "string") return null;
  return { login, bio };
};

export const verifyGithubProfile = async (
  username: string,
  verificationCode: string,
  publicKey: string,
): Promise<GithubVerificationResult> => {
  const normalized = username.trim();
  const code = verificationCode.trim();
  if (!isGithubUsername(normalized) || code.length === 0 || publicKey.length === 0) {
    return { ok: false, reason: "invalid-username" };
  }
  if (!(await verifySignedProof(code, { provider: "github", username: normalized, publicKey }))) {
    return { ok: false, reason: "invalid-code" };
  }

  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(normalized)}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (response.status === 404) return { ok: false, reason: "not-found" };
    if (response.status === 403 || response.status === 429) {
      return { ok: false, reason: "rate-limited" };
    }
    if (!response.ok) return { ok: false, reason: "network" };
    const profile = parseGithubProfile(await response.json());
    if (profile === null) return { ok: false, reason: "network" };
    if (profile.login.toLowerCase() !== normalized.toLowerCase()) {
      return { ok: false, reason: "not-found" };
    }
    if (!(profile.bio ?? "").includes(code)) {
      return { ok: false, reason: "missing-code" };
    }
    return { ok: true, username: profile.login, verificationCode: code };
  } catch {
    return { ok: false, reason: "network" };
  }
};
