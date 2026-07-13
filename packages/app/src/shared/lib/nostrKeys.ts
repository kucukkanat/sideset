import type { IdentityKeyPair } from "@keychain/core";
import { nip19 } from "nostr-tools";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";

const HEX_KEY = /^[0-9a-f]{64}$/u;

const keyBytes = (key: string): Uint8Array => {
  if (!HEX_KEY.test(key)) throw new TypeError("Expected a 64-character lowercase hex Nostr key");
  return Uint8Array.from(key.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16));
};

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const generateNostrIdentity = (): IdentityKeyPair => {
  const secret = generateSecretKey();
  return { privateKey: hex(secret), publicKey: getPublicKey(secret) };
};

export const nostrDisplayKeys = (
  identity: IdentityKeyPair,
): { readonly publicKey: string; readonly privateKey: string } => ({
  publicKey: nip19.npubEncode(identity.publicKey),
  privateKey: nip19.nsecEncode(keyBytes(identity.privateKey)),
});

export const nostrPublicKey = (value: string): string | null => {
  const normalized = value.trim();
  if (HEX_KEY.test(normalized)) return nip19.npubEncode(normalized);
  try {
    const decoded = nip19.decode(normalized);
    return decoded.type === "npub" && typeof decoded.data === "string"
      ? nip19.npubEncode(decoded.data)
      : null;
  } catch {
    return normalized.startsWith("npub1") ? normalized : null;
  }
};

export const nostrPublicKeyHex = (value: string): string | null => {
  const normalized = value.trim();
  if (HEX_KEY.test(normalized)) return normalized;
  try {
    const decoded = nip19.decode(normalized);
    return decoded.type === "npub" && typeof decoded.data === "string" ? decoded.data : null;
  } catch {
    return null;
  }
};
