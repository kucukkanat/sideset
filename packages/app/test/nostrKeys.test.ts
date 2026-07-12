import { describe, expect, test } from "bun:test";
import { nip19 } from "nostr-tools";
import { nostrDisplayKeys } from "../src/nostrKeys.ts";
import { generateNostrIdentity } from "../src/tools.ts";

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
});
