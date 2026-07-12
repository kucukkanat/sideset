import type { IdentityKeyPair } from "@keychain/core";
import { nip19 } from "nostr-tools";

const HEX_KEY = /^[0-9a-f]{64}$/u;

const keyBytes = (key: string): Uint8Array => {
  if (!HEX_KEY.test(key)) throw new TypeError("Expected a 64-character lowercase hex Nostr key");
  return Uint8Array.from(key.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16));
};

export const nostrDisplayKeys = (
  identity: IdentityKeyPair,
): { readonly publicKey: string; readonly privateKey: string } => ({
  publicKey: nip19.npubEncode(identity.publicKey),
  privateKey: nip19.nsecEncode(keyBytes(identity.privateKey)),
});
