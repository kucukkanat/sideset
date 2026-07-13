const BACKUP_FORMAT = "keychain-wallet-backup";
const ITERATIONS = 250_000;
/** Covers the maximum current core + People + Activity payload after AES-GCM/base64 expansion. */
export const MAX_BACKUP_BYTES = 30_000_000;
export const MAX_BACKUP_PLAINTEXT_BYTES = 21_000_000;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class BackupTooLargeError extends Error {
  constructor() {
    super("The selected backup data exceeds the supported backup size");
    this.name = "BackupTooLargeError";
  }
}

interface BackupEnvelopeV1 {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: 1;
  readonly iterations: number;
  readonly salt: string;
  readonly iv: string;
  readonly ciphertext: string;
}

export type BackupReadResult =
  | { readonly ok: true; readonly value: unknown }
  | {
      readonly ok: false;
      readonly reason: "invalid-file" | "unsupported" | "wrong-password-or-damaged";
    };

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const deriveKey = async (
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

export const createEncryptedBackup = async (value: unknown, password: string): Promise<string> => {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError("Backup data is not serializable");
  const plaintext = new TextEncoder().encode(serialized);
  if (plaintext.byteLength > MAX_BACKUP_PLAINTEXT_BYTES) throw new BackupTooLargeError();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );
  const contents = JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: 1,
      iterations: ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(ciphertext),
    } satisfies BackupEnvelopeV1,
    null,
    2,
  );
  if (contents.length > MAX_BACKUP_BYTES) throw new BackupTooLargeError();
  return contents;
};

const parseEnvelope = (
  contents: string,
):
  | { readonly ok: true; readonly envelope: BackupEnvelopeV1 }
  | { readonly ok: false; readonly reason: "invalid-file" | "unsupported" } => {
  try {
    const value: unknown = JSON.parse(contents);
    if (typeof value !== "object" || value === null) return { ok: false, reason: "invalid-file" };
    const record = value as Record<string, unknown>;
    if (record.format !== BACKUP_FORMAT || record.version !== 1) {
      return { ok: false, reason: "unsupported" };
    }
    if (
      typeof record.iterations !== "number" ||
      !Number.isInteger(record.iterations) ||
      record.iterations !== ITERATIONS ||
      typeof record.salt !== "string" ||
      !BASE64.test(record.salt) ||
      typeof record.iv !== "string" ||
      !BASE64.test(record.iv) ||
      typeof record.ciphertext !== "string" ||
      !BASE64.test(record.ciphertext)
    ) {
      return { ok: false, reason: "invalid-file" };
    }
    return {
      ok: true,
      envelope: {
        format: BACKUP_FORMAT,
        version: 1,
        iterations: record.iterations,
        salt: record.salt,
        iv: record.iv,
        ciphertext: record.ciphertext,
      },
    };
  } catch {
    return { ok: false, reason: "invalid-file" };
  }
};

export const readEncryptedBackup = async (
  contents: string,
  password: string,
): Promise<BackupReadResult> => {
  if (
    contents.length > MAX_BACKUP_BYTES ||
    new TextEncoder().encode(contents).byteLength > MAX_BACKUP_BYTES
  ) {
    return { ok: false, reason: "invalid-file" };
  }
  const parsed = parseEnvelope(contents);
  if (!parsed.ok) return parsed;
  try {
    const salt = base64ToBytes(parsed.envelope.salt);
    const iv = base64ToBytes(parsed.envelope.iv);
    const ciphertext = base64ToBytes(parsed.envelope.ciphertext);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length === 0) {
      return { ok: false, reason: "invalid-file" };
    }
    const key = await deriveKey(password, salt, parsed.envelope.iterations);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const value: unknown = JSON.parse(
      new TextDecoder(undefined, { fatal: true }).decode(plaintext),
    );
    return { ok: true, value };
  } catch {
    return { ok: false, reason: "wrong-password-or-damaged" };
  }
};
