import { describe, expect, test } from "bun:test";
import { SEED_CARDS } from "@keychain/core";
import { nip19 } from "nostr-tools";
import {
  addVerifiedGithubProof,
  createGithubVerificationCode,
  generateIdentityKeyPair,
  identityFromPrivateKey,
  isGithubUsername,
  parseGithubProfile,
  verifySignedProof,
} from "../src/accountVerification.ts";

describe("GitHub account verification helpers", () => {
  test("imports nsec private keys and derives the public key", async () => {
    const identity = await generateIdentityKeyPair();
    expect(identityFromPrivateKey(identity.privateKey)).toBeNull();
    const secret = Uint8Array.from(identity.privateKey.match(/../gu) ?? [], (pair) =>
      Number.parseInt(pair, 16),
    );
    expect(identityFromPrivateKey(nip19.nsecEncode(secret))).toEqual(identity);
    expect(identityFromPrivateKey("not-a-key")).toBeNull();
    expect(identityFromPrivateKey("0".repeat(64))).toBeNull();
  });
  test("accepts GitHub usernames and rejects malformed values", () => {
    expect(isGithubUsername("octocat")).toBe(true);
    expect(isGithubUsername("octo-cat")).toBe(true);
    expect(isGithubUsername("-octocat")).toBe(false);
    expect(isGithubUsername("octocat-")).toBe(false);
    expect(isGithubUsername("octo cat")).toBe(false);
  });

  test("creates a compact signed code that verifies with the public key", async () => {
    const identity = await generateIdentityKeyPair();
    const code = await createGithubVerificationCode(identity, "octocat");
    expect(code).toMatch(/^kc1\.[A-Za-z0-9_-]+$/u);
    expect(code.length).toBeLessThan(800);
    expect(
      await verifySignedProof(code, {
        provider: "github",
        username: "octocat",
        publicKey: identity.publicKey,
      }),
    ).toBe(true);
    expect(
      await verifySignedProof(code, {
        provider: "github",
        username: "other",
        publicKey: identity.publicKey,
      }),
    ).toBe(false);
  });

  test("parses only the public fields needed from a GitHub response", () => {
    expect(parseGithubProfile({ login: "octocat", bio: "hello" })).toEqual({
      login: "octocat",
      bio: "hello",
    });
    expect(parseGithubProfile({ login: "octocat", bio: null })).toEqual({
      login: "octocat",
      bio: null,
    });
    expect(parseGithubProfile({ login: "octocat", bio: 42 })).toBeNull();
    expect(parseGithubProfile({ login: "octo cat", bio: "hello" })).toBeNull();
    expect(parseGithubProfile(null)).toBeNull();
  });

  test("stores the signed GitHub login locally and stays idempotent", async () => {
    const identity = await generateIdentityKeyPair();
    const code = await createGithubVerificationCode(identity, "octocat");
    const next = addVerifiedGithubProof(SEED_CARDS, "c3", " octocat ", code, identity);
    expect(next.find((card) => card.id === "c3")?.proofs).toEqual([
      { provider: "github", username: "octocat", verificationCode: code },
    ]);
    const upgraded = addVerifiedGithubProof(SEED_CARDS, "c1", "other", code, identity);
    expect(upgraded.find((card) => card.id === "c1")?.proofs).toContainEqual({
      provider: "github",
      username: "other",
      verificationCode: code,
    });
    expect(upgraded.find((card) => card.id === "c1")?.identity).toEqual(identity);
    expect(addVerifiedGithubProof(SEED_CARDS, "c3", "  ", code, identity)).toEqual(SEED_CARDS);
  });
});
