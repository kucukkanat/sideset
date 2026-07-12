import { describe, expect, test } from "bun:test";
import {
  bytesText,
  decryptFromRecipient,
  decryptWithPassphrase,
  encryptForRecipient,
  encryptWithPassphrase,
  generateNostrIdentity,
  signText,
  textBytes,
  verifySignedText,
} from "@features/tools/tools.ts";
import type { Card } from "@keychain/core";
import { nip19 } from "nostr-tools";

describe("Nostr content tools", () => {
  test("encrypts for a recipient and lets either participant decrypt", () => {
    const sender = generateNostrIdentity();
    const recipient = generateNostrIdentity();
    const encrypted = encryptForRecipient(
      textBytes("private hello"),
      sender,
      nip19.npubEncode(recipient.publicKey),
    );
    expect(JSON.parse(encrypted)).toMatchObject({
      sender: nip19.npubEncode(sender.publicKey),
      recipient: nip19.npubEncode(recipient.publicKey),
    });
    expect(decryptFromRecipient(encrypted, recipient)).toEqual({
      data: textBytes("private hello"),
      role: "recipient",
    });
    expect(decryptFromRecipient(encrypted, sender)).toEqual({
      data: textBytes("private hello"),
      role: "sender",
    });
    expect(() => decryptFromRecipient(encrypted, generateNostrIdentity())).toThrow();
  });

  test("decrypts legacy envelopes containing hex public keys", () => {
    const sender = generateNostrIdentity();
    const recipient = generateNostrIdentity();
    const encrypted = JSON.parse(
      encryptForRecipient(textBytes("legacy hello"), sender, recipient.publicKey),
    ) as Record<string, unknown>;
    const legacy = JSON.stringify({
      ...encrypted,
      sender: sender.publicKey,
      recipient: recipient.publicKey,
    });
    expect(bytesText(decryptFromRecipient(legacy, recipient).data)).toBe("legacy hello");
  });

  test("rejects non-Nostr and mismatched identities", () => {
    const recipient = generateNostrIdentity();
    const first = generateNostrIdentity();
    const second = generateNostrIdentity();
    expect(() =>
      encryptForRecipient(
        textBytes("private hello"),
        { publicKey: "A".repeat(43), privateKey: "B".repeat(86) },
        recipient.publicKey,
      ),
    ).toThrow("valid Nostr keypair");
    expect(() =>
      encryptForRecipient(
        textBytes("private hello"),
        { publicKey: first.publicKey, privateKey: second.privateKey },
        recipient.publicKey,
      ),
    ).toThrow("valid Nostr keypair");
  });

  test("round-trips passphrase encryption and rejects the wrong passphrase", async () => {
    const encrypted = await encryptWithPassphrase(textBytes("file bytes"), "correct horse");
    expect(bytesText(await decryptWithPassphrase(encrypted, "correct horse"))).toBe("file bytes");
    expect(decryptWithPassphrase(encrypted, "wrong horse")).rejects.toThrow();
  });

  test("signs text with a profile and detects changed content", async () => {
    const identity = generateNostrIdentity();
    const card: Card = {
      id: "c1",
      name: "Ada",
      handle: "@ada",
      username: "ada",
      email: "ada@example.com",
      avatar: "🧑",
      color: 0,
      tag: "",
      bio: "Builder",
      proofs: [],
      identity,
    };
    const signed = await signText("signed", card);
    expect(JSON.parse(signed).profile).not.toHaveProperty("name");
    expect(await verifySignedText(signed)).toEqual({
      ok: true,
      valid: true,
      profile: {
        handle: "@ada",
        username: "ada",
        email: "ada@example.com",
        avatar: "🧑",
        bio: "Builder",
        publicKey: nip19.npubEncode(identity.publicKey),
      },
      text: "signed",
    });
    const changed = JSON.stringify({ ...JSON.parse(signed), text: "changed" });
    expect(await verifySignedText(changed)).toMatchObject({
      ok: true,
      valid: false,
      text: "changed",
    });
  });
});
