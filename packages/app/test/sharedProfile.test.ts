import { describe, expect, test } from "bun:test";
import type { Card } from "@keychain/core";
import {
  createGithubVerificationCode,
  generateIdentityKeyPair,
} from "../src/accountVerification.ts";
import { nostrPublicKey } from "../src/nostrKeys.ts";
import {
  decodeSharedProfile,
  encodeSharedProfile,
  parseEd25519PublicKey,
  type SharedProfile,
  sharedProfileFromPublicKey,
  sharedProfileToContact,
  sharedProfileTokenFromInput,
  verifySharedProfile,
} from "../src/sharedProfile.ts";
import { createInitialWalletState, decodeWalletSnapshot, walletSnapshot } from "../src/storage.ts";

const PROFILE: Pick<
  Card,
  "id" | "name" | "handle" | "username" | "email" | "avatar" | "color" | "bio" | "proofs"
> = {
  id: "card-unicode",
  name: "  Çağrı 李  ",
  handle: "cagri_李",
  username: "cagri_李",
  email: "cagri@example.test",
  avatar: "🧑🏽‍💻",
  color: 4,
  bio: "İstanbul’dan merhaba — こんにちは 🌊",
  proofs: [
    { provider: "github", username: "çağrı" },
    { provider: "email", username: "cagri@example.test" },
  ],
};

const encodeJson = (value: unknown): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

const decodedProfile = (): SharedProfile => {
  const result = decodeSharedProfile(encodeSharedProfile(PROFILE));
  if (!result.ok) throw new Error(`Expected a valid shared profile, received ${result.reason}`);
  return result.profile;
};

describe("shared profile encoding", () => {
  test("round-trips Unicode as an unpadded base64url token", () => {
    const encoded = encodeSharedProfile(PROFILE);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);

    const result = decodeSharedProfile(encoded);
    expect(result).toEqual({
      ok: true,
      profile: {
        version: 1,
        sourceId: PROFILE.id,
        name: "Çağrı 李",
        handle: PROFILE.handle,
        username: PROFILE.username,
        email: PROFILE.email,
        avatar: PROFILE.avatar,
        color: PROFILE.color,
        bio: PROFILE.bio,
      },
    });
  });

  test("distinguishes unsupported versions from invalid payloads", () => {
    expect(decodeSharedProfile(encodeJson({ version: 2 }))).toEqual({
      ok: false,
      reason: "unsupported",
    });

    const invalidValues = [
      "not-base64!",
      "_w",
      encodeJson(null),
      encodeJson({}),
      encodeJson({ version: 1 }),
      encodeJson({
        version: 1,
        sourceId: "source-1",
        name: "   ",
        handle: "handle",
        avatar: "🙂",
        color: 0,
        bio: "",
      }),
      encodeJson({
        version: 1,
        sourceId: "source-1",
        name: "Name",
        handle: "handle",
        avatar: "🙂",
        color: 0.5,
        bio: "",
      }),
      encodeJson({
        version: 1,
        sourceId: "source-1",
        identityId: "",
        name: "Name",
        handle: "handle",
        avatar: "🙂",
        color: 0,
        bio: "",
      }),
    ] as const;

    for (const value of invalidValues) {
      expect(decodeSharedProfile(value)).toEqual({ ok: false, reason: "invalid" });
    }
  });

  test("enforces public field length limits", () => {
    const base = {
      version: 1,
      sourceId: "source-1",
      name: "Name",
      handle: "handle",
      avatar: "🙂",
      color: 0,
      bio: "",
    } as const;

    for (const value of [
      { ...base, name: "n".repeat(81) },
      { ...base, handle: "h".repeat(81) },
      { ...base, handle: "@" },
      { ...base, avatar: "a".repeat(17) },
      { ...base, bio: "b".repeat(281) },
    ]) {
      expect(decodeSharedProfile(encodeJson(value))).toEqual({ ok: false, reason: "invalid" });
    }
  });

  test("accepts an empty avatar as the generated-avatar sentinel", () => {
    const encoded = encodeSharedProfile({
      id: "generated-avatar",
      name: "GF",
      handle: "Gilfoyle",
      avatar: "",
      color: 0,
      bio: "",
    });

    expect(decodeSharedProfile(encoded)).toEqual({
      ok: true,
      profile: {
        version: 1,
        sourceId: "generated-avatar",
        name: "GF",
        handle: "Gilfoyle",
        avatar: "",
        color: 0,
        bio: "",
      },
    });
  });
});

describe("shared profile contacts", () => {
  test("creates a local contact profile from a Nostr public key", () => {
    const publicKey = "a".repeat(64);
    expect(parseEd25519PublicKey(`  ${publicKey}\n`)).toBe(publicKey);
    expect(sharedProfileFromPublicKey(publicKey, "  Ada Key  ")).toEqual({
      version: 1,
      sourceId: publicKey,
      publicKey,
      name: "Ada Key",
      handle: `${nostrPublicKey(publicKey)?.slice(0, 12)}…`,
      avatar: "🔑",
      color: 3,
      bio: "",
    });

    for (const value of [
      "",
      "A".repeat(42),
      "A".repeat(44),
      `${"A".repeat(42)}=`,
      `${"A".repeat(42)}+`,
      `${"A".repeat(42)}/`,
    ]) {
      expect(parseEd25519PublicKey(value)).toBeNull();
    }
    expect(sharedProfileFromPublicKey(publicKey, " ")).toBeNull();
    expect(sharedProfileFromPublicKey(publicKey, "A".repeat(81))).toBeNull();
  });

  test("accepts an npub and normalizes it to its hex public key", () => {
    const npub = "npub1mlp5mcn6st4g45zp8t3ulm47qkj059q0gegq4dxp5gthu6gwj89shuc5h7";

    expect(parseEd25519PublicKey(npub)).toBe(
      "dfc34de27a82ea8ad0413ae3cfeebe05a4fa140f46500ab4c1a2177e690e91cb",
    );
    expect(sharedProfileFromPublicKey(npub, "Valid npub")).toMatchObject({
      publicKey: "dfc34de27a82ea8ad0413ae3cfeebe05a4fa140f46500ab4c1a2177e690e91cb",
      name: "Valid npub",
    });
  });

  test("preserves and verifies signed provider connections with the shared public key", async () => {
    const identity = await generateIdentityKeyPair();
    const verificationCode = await createGithubVerificationCode(identity, "octocat");
    const encoded = encodeSharedProfile({
      ...PROFILE,
      identity,
      proofs: [{ provider: "github", username: "octocat", verificationCode }],
    });
    const decoded = decodeSharedProfile(encoded);
    if (!decoded.ok) throw new Error("Expected the signed profile to decode");

    expect(decoded.profile.publicKey).toBe(identity.publicKey);
    expect(await verifySharedProfile(decoded.profile)).toEqual({
      ok: true,
      proofs: [{ provider: "github", username: "octocat", verificationCode }],
    });
    expect(
      await verifySharedProfile({
        ...decoded.profile,
        proofs: [{ provider: "github", username: "someone-else", verificationCode }],
      }),
    ).toEqual({ ok: false, reason: "invalid-signature" });
  });

  test("keeps an imported public key verifiable when a contact is shared again", async () => {
    const identity = await generateIdentityKeyPair();
    const verificationCode = await createGithubVerificationCode(identity, "octocat");
    const decoded = decodeSharedProfile(
      encodeSharedProfile({
        ...PROFILE,
        npub: identity.publicKey,
        proofs: [{ provider: "github", username: "octocat", verificationCode }],
      }),
    );
    if (!decoded.ok) throw new Error("Expected the imported profile to decode");

    const reshared = decodeSharedProfile(
      encodeSharedProfile({
        id: decoded.profile.sourceId,
        name: decoded.profile.name,
        handle: decoded.profile.handle,
        avatar: decoded.profile.avatar,
        color: decoded.profile.color,
        bio: decoded.profile.bio,
        ...(decoded.profile.publicKey ? { npub: decoded.profile.publicKey } : {}),
        ...(decoded.profile.proofs ? { proofs: decoded.profile.proofs } : {}),
      }),
    );
    if (!reshared.ok) throw new Error("Expected the re-shared profile to decode");

    expect(reshared.profile.publicKey).toBe(identity.publicKey);
    expect(await verifySharedProfile(reshared.profile)).toEqual({
      ok: true,
      proofs: [{ provider: "github", username: "octocat", verificationCode }],
    });
  });

  test("creates a deterministic local contact and normalizes its handle", () => {
    const profile = decodedProfile();
    const contact = sharedProfileToContact(profile);

    expect(contact).toEqual({
      id: expect.stringMatching(/^p-[a-z0-9]+$/),
      name: profile.name,
      handle: `@${profile.handle}`,
      avatar: profile.avatar,
      color: profile.color,
      mutuals: 0,
      bio: profile.bio,
      proofs: [],
      npub: "",
    });
    expect(sharedProfileToContact(profile).id).toBe(contact.id);
    expect(sharedProfileToContact({ ...profile, bio: `${profile.bio}!` }).id).toBe(contact.id);
    expect(sharedProfileToContact({ ...profile, sourceId: "another-source" }).id).not.toBe(
      contact.id,
    );
    expect(sharedProfileToContact({ ...profile, handle: "@already" }).handle).toBe("@already");
  });

  test("preserves an internal identity identifier without exposing it in display fields", () => {
    const encoded = encodeSharedProfile({ ...PROFILE, npub: "internal-public-identity" });
    const decoded = decodeSharedProfile(encoded);
    if (!decoded.ok) throw new Error("Expected the contact profile to decode");

    expect(decoded.profile.identityId).toBe("internal-public-identity");
    expect(sharedProfileToContact(decoded.profile).npub).toBe("");
  });

  test("every accepted maximum-length handle converts into persistable contact state", () => {
    const decoded = decodeSharedProfile(
      encodeJson({
        version: 1,
        sourceId: "source-max-handle",
        name: "Long Handle",
        handle: "h".repeat(80),
        avatar: "🙂",
        color: 0,
        bio: "",
      }),
    );
    if (!decoded.ok) throw new Error("Expected the boundary profile to decode");

    const contact = sharedProfileToContact(decoded.profile);
    const state = {
      ...createInitialWalletState(),
      contacts: [contact],
    };
    expect(decodeWalletSnapshot(walletSnapshot(state))).toEqual({ ok: true, state });
    expect(decodeSharedProfile(encodeSharedProfile(contact)).ok).toBe(true);
  });
});

describe("shared profile token extraction", () => {
  const baseUrl = "https://wallet.example/app#/wallet";

  test("extracts tokens from absolute and hash-relative profile links", () => {
    expect(
      sharedProfileTokenFromInput(
        "  https://wallet.example/app#/people?sheet=add&profile=token_-9  ",
        baseUrl,
      ),
    ).toBe("token_-9");
    expect(sharedProfileTokenFromInput("#/people?profile=token_-9&sheet=add", baseUrl)).toBe(
      "token_-9",
    );
  });

  test("rejects empty, malformed, and token-free links", () => {
    for (const input of [
      "",
      "not a profile link",
      "https://wallet.example/app#/people?sheet=add",
    ]) {
      expect(sharedProfileTokenFromInput(input, baseUrl)).toBeNull();
    }
  });

  test("rejects ambiguous duplicate profile parameters", () => {
    expect(
      sharedProfileTokenFromInput(
        "https://wallet.example/app#/people?sheet=add&profile=one&profile=two",
        baseUrl,
      ),
    ).toBeNull();
  });

  test("rejects profile parameters outside the add-contact route", () => {
    for (const input of [
      "https://wallet.example/app#/people?profile=token_-9",
      "https://wallet.example/app#/wallet?sheet=add&profile=token_-9",
      "https://wallet.example/app#/people/p1?sheet=add&profile=token_-9",
    ]) {
      expect(sharedProfileTokenFromInput(input, baseUrl)).toBeNull();
    }
  });
});
