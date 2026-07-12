import type { Card, IdentityKeyPair } from "@keychain/core";
import { schnorr } from "@noble/curves/secp256k1.js";
import { nip44 } from "nostr-tools";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";

const encoder = new TextEncoder();
const decoder = new TextDecoder(undefined, { fatal: true });
const HEX = /^[0-9a-f]{64}$/u;
const buffer = (value: Uint8Array): ArrayBuffer => new Uint8Array(value).buffer;

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const bytes = (value: string): Uint8Array => {
  if (!HEX.test(value)) throw new TypeError("Expected a 64-character lowercase hex Nostr key");
  return Uint8Array.from(value.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16));
};
const validateIdentity = (identity: IdentityKeyPair): Uint8Array => {
  if (!HEX.test(identity.publicKey) || !HEX.test(identity.privateKey))
    throw new TypeError("The active identity is not a valid Nostr keypair");
  const secret = bytes(identity.privateKey);
  if (getPublicKey(secret) !== identity.publicKey)
    throw new TypeError("The active identity is not a valid Nostr keypair");
  return secret;
};
const b64 = (value: Uint8Array): string => {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const unb64 = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (part) => part.charCodeAt(0));

export const generateNostrIdentity = (): IdentityKeyPair => {
  const secret = generateSecretKey();
  return { privateKey: hex(secret), publicKey: getPublicKey(secret) };
};

type RecipientEnvelope = {
  readonly v: 1;
  readonly mode: "nip44";
  readonly sender: string;
  readonly recipient: string;
  readonly payload: string;
};
type PassphraseEnvelope = {
  readonly v: 1;
  readonly mode: "passphrase";
  readonly salt: string;
  readonly iv: string;
  readonly payload: string;
};

const passphraseKey = async (passphrase: string, salt: Uint8Array): Promise<CryptoKey> => {
  if (passphrase.length < 8) throw new TypeError("Passphrase must be at least 8 characters");
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: buffer(salt), iterations: 310_000 },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

export const encryptForRecipient = (
  data: Uint8Array,
  identity: IdentityKeyPair,
  recipient: string,
): string => {
  if (!HEX.test(recipient))
    throw new TypeError("Recipient must be a 64-character lowercase hex Nostr public key");
  const key = nip44.v2.utils.getConversationKey(validateIdentity(identity), recipient);
  return JSON.stringify({
    v: 1,
    mode: "nip44",
    sender: identity.publicKey,
    recipient,
    payload: nip44.v2.encrypt(b64(data), key),
  } satisfies RecipientEnvelope);
};

export const decryptFromRecipient = (value: string, identity: IdentityKeyPair): Uint8Array => {
  const envelope = JSON.parse(value) as RecipientEnvelope;
  if (
    envelope.v !== 1 ||
    envelope.mode !== "nip44" ||
    !HEX.test(envelope.sender) ||
    !HEX.test(envelope.recipient)
  )
    throw new Error("Invalid NIP-44 envelope");
  const secret = validateIdentity(identity);
  if (envelope.sender !== identity.publicKey && envelope.recipient !== identity.publicKey)
    throw new Error("The active identity is not a participant in this envelope");
  const peer = envelope.sender === identity.publicKey ? envelope.recipient : envelope.sender;
  return unb64(nip44.v2.decrypt(envelope.payload, nip44.v2.utils.getConversationKey(secret, peer)));
};

export const encryptWithPassphrase = async (
  data: Uint8Array,
  passphrase: string,
): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: buffer(iv) },
    await passphraseKey(passphrase, salt),
    buffer(data),
  );
  return JSON.stringify({
    v: 1,
    mode: "passphrase",
    salt: b64(salt),
    iv: b64(iv),
    payload: b64(new Uint8Array(payload)),
  } satisfies PassphraseEnvelope);
};

export const decryptWithPassphrase = async (
  value: string,
  passphrase: string,
): Promise<Uint8Array> => {
  const envelope = JSON.parse(value) as PassphraseEnvelope;
  if (envelope.v !== 1 || envelope.mode !== "passphrase")
    throw new Error("Invalid passphrase envelope");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: buffer(unb64(envelope.iv)) },
    await passphraseKey(passphrase, unb64(envelope.salt)),
    buffer(unb64(envelope.payload)),
  );
  return new Uint8Array(plain);
};

type SignedProfile = {
  /** Present only in legacy signed documents; local card labels are not public profile data. */
  readonly name?: string;
  readonly handle: string;
  readonly username?: string;
  readonly email?: string;
  readonly avatar: string;
  readonly bio: string;
  readonly publicKey: string;
};

export type SignedTextVerification =
  | {
      readonly ok: true;
      readonly valid: boolean;
      readonly profile: SignedProfile;
      readonly text: string;
    }
  | { readonly ok: false };

const signedPayload = (profile: SignedProfile, text: string): string =>
  JSON.stringify({ version: 1, profile, text });

export const signText = async (text: string, card: Card): Promise<string> => {
  const identity = card.identity;
  if (identity === undefined) throw new Error("The active identity is not ready");
  if (text.length === 0) throw new TypeError("Enter text to sign");
  const profile: SignedProfile = {
    handle: card.handle,
    ...(card.username ? { username: card.username } : {}),
    ...(card.email ? { email: card.email } : {}),
    avatar: card.avatar,
    bio: card.bio,
    publicKey: identity.publicKey,
  };
  const payload = signedPayload(profile, text);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer(textBytes(payload))));
  const signature = hex(schnorr.sign(digest, bytes(identity.privateKey)));
  return JSON.stringify({ version: 1, profile, text, signature });
};

export const verifySignedText = async (signedValue: string): Promise<SignedTextVerification> => {
  try {
    const value: unknown = JSON.parse(signedValue);
    if (typeof value !== "object" || value === null) return { ok: false };
    const record = value as Record<string, unknown>;
    const profile = record.profile;
    if (typeof profile !== "object" || profile === null) return { ok: false };
    const fields = profile as Record<string, unknown>;
    const text = record.text;
    const signature = record.signature;
    if (
      record.version !== 1 ||
      typeof text !== "string" ||
      text.length === 0 ||
      typeof signature !== "string" ||
      !/^[0-9a-f]{128}$/u.test(signature) ||
      (fields.name !== undefined && typeof fields.name !== "string") ||
      typeof fields.handle !== "string" ||
      typeof fields.avatar !== "string" ||
      typeof fields.bio !== "string" ||
      typeof fields.publicKey !== "string" ||
      !HEX.test(fields.publicKey)
    )
      return { ok: false };
    const verifiedProfile: SignedProfile = {
      ...(typeof fields.name === "string" ? { name: fields.name } : {}),
      handle: fields.handle,
      ...(typeof fields.username === "string" ? { username: fields.username } : {}),
      ...(typeof fields.email === "string" ? { email: fields.email } : {}),
      avatar: fields.avatar,
      bio: fields.bio,
      publicKey: fields.publicKey,
    };
    const digest = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        buffer(textBytes(signedPayload(verifiedProfile, text))),
      ),
    );
    const signatureBytes = Uint8Array.from(signature.match(/../gu) ?? [], (pair) =>
      Number.parseInt(pair, 16),
    );
    return {
      ok: true,
      valid: schnorr.verify(signatureBytes, digest, bytes(verifiedProfile.publicKey)),
      profile: verifiedProfile,
      text,
    };
  } catch {
    return { ok: false };
  }
};

export const textBytes = (value: string): Uint8Array => encoder.encode(value);
export const bytesText = (value: Uint8Array): string => decoder.decode(value);
