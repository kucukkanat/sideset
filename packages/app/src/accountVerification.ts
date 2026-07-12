import type { Card, IdentityKeyPair, ProviderId } from "@keychain/core";

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

export type SignedProofEnvelope = {
  readonly version: 1;
  readonly nonce: string;
  readonly signature: string;
};

const GITHUB_USERNAME = /^(?!-)[A-Za-z0-9-]{1,39}(?<!-)$/;
const SIGNING_ALGORITHM = { name: "Ed25519" } as const;

export const isGithubUsername = (value: string): boolean => GITHUB_USERNAME.test(value.trim());

export const githubProfileSettingsUrl = "https://github.com/settings/profile";

export const githubProfileUrl = (username: string): string =>
  `https://github.com/${encodeURIComponent(username.trim())}`;

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

const encodeJson = (value: unknown): string =>
  toBase64Url(new TextEncoder().encode(JSON.stringify(value)));

const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  new Uint8Array(bytes).buffer as ArrayBuffer;

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

const publicJwk = (publicKey: string): JsonWebKey => ({
  kty: "OKP",
  crv: "Ed25519",
  x: publicKey,
  ext: true,
});

const proofMessage = (
  provider: ProviderId,
  username: string,
  publicKey: string,
  nonce: string,
): Uint8Array =>
  new TextEncoder().encode(`keychain-proof-v1|${provider}|${username}|${publicKey}|${nonce}`);

export const generateIdentityKeyPair = async (): Promise<IdentityKeyPair> => {
  const generated = await crypto.subtle.generateKey(SIGNING_ALGORITHM, true, ["sign", "verify"]);
  const keyPair = generated as CryptoKeyPair;
  const publicJwkValue = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwkValue = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  if (typeof publicJwkValue.x !== "string" || typeof privateJwkValue.d !== "string") {
    throw new Error("The browser did not return an Ed25519 key pair");
  }
  return { publicKey: publicJwkValue.x, privateKey: encodeJson(privateJwkValue) };
};

const importPrivateKey = async (identity: IdentityKeyPair): Promise<CryptoKey> => {
  const jwk = decodeJson(identity.privateKey);
  if (jwk === null || typeof jwk.d !== "string" || typeof jwk.x !== "string") {
    throw new Error("The saved identity key is invalid");
  }
  return crypto.subtle.importKey("jwk", jwk, SIGNING_ALGORITHM, false, ["sign"]);
};

export const createGithubVerificationCode = async (
  identity: IdentityKeyPair,
  username: string,
): Promise<string> => {
  const normalized = username.trim();
  if (!isGithubUsername(normalized)) throw new TypeError("Invalid GitHub username");
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(12)));
  const key = await importPrivateKey(identity);
  const signature = await crypto.subtle.sign(
    SIGNING_ALGORITHM,
    key,
    asArrayBuffer(proofMessage("github", normalized, identity.publicKey, nonce)),
  );
  return `kc1.${nonce}.${toBase64Url(new Uint8Array(signature))}`;
};

export const parseSignedProof = (code: string): SignedProofEnvelope | null => {
  const parts = code.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "kc1") return null;
  const nonce = parts[1];
  const signature = parts[2];
  if (nonce === undefined || signature === undefined) return null;
  const nonceBytes = fromBase64Url(nonce);
  const signatureBytes = fromBase64Url(signature);
  if (
    nonceBytes === null ||
    nonceBytes.length !== 12 ||
    signatureBytes === null ||
    signatureBytes.length !== 64
  ) {
    return null;
  }
  return { version: 1, nonce, signature };
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
  const signatureBytes = fromBase64Url(parsed.signature);
  if (signatureBytes === null) return false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      publicJwk(expected.publicKey),
      SIGNING_ALGORITHM,
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      SIGNING_ALGORITHM,
      key,
      asArrayBuffer(signatureBytes),
      asArrayBuffer(
        proofMessage(expected.provider, expected.username.trim(), expected.publicKey, parsed.nonce),
      ),
    );
  } catch {
    return false;
  }
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
    const existing = card.proofs.find((proof) => proof.provider === "github");
    if (existing?.verificationCode !== undefined) return card;
    return {
      ...card,
      identity,
      proofs: [
        ...card.proofs.filter((proof) => proof.provider !== "github"),
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
