import { describe, expect, test } from "bun:test";
import { generateNostrIdentity } from "@features/tools/tools.ts";
import { nostrDisplayKeys, nostrPublicKey, nostrPublicKeyHex } from "@shared/lib/nostrKeys.ts";
import { nip19 } from "nostr-tools";

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

describe("Nostr display keys", () => {
  test("renders stored hex keys as matching npub and nsec values", () => {
    const identity = generateNostrIdentity();
    const displayed = nostrDisplayKeys(identity);
    const publicKey = nip19.decode(displayed.publicKey);
    const privateKey = nip19.decode(displayed.privateKey);

    expect(displayed.publicKey).toStartWith("npub1");
    expect(displayed.privateKey).toStartWith("nsec1");
    expect(publicKey).toEqual({ type: "npub", data: identity.publicKey });
    expect(privateKey.type).toBe("nsec");
    if (privateKey.type !== "nsec") throw new Error("Expected an nsec key");
    expect(hex(privateKey.data)).toBe(identity.privateKey);
  });

  test("rejects malformed internal key material", () => {
    expect(() => nostrDisplayKeys({ publicKey: "invalid", privateKey: "invalid" })).toThrow();
  });

  test("normalizes public keys at the UI and cryptography boundaries", () => {
    const identity = generateNostrIdentity();
    const npub = nip19.npubEncode(identity.publicKey);

    expect(nostrPublicKey(identity.publicKey)).toBe(npub);
    expect(nostrPublicKey(npub)).toBe(npub);
    expect(nostrPublicKeyHex(npub)).toBe(identity.publicKey);
    expect(nostrPublicKeyHex("not-a-key")).toBeNull();
  });
});
