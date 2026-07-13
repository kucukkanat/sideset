import { describe, expect, test } from "bun:test";
import {
  BackupTooLargeError,
  createEncryptedBackup,
  MAX_BACKUP_BYTES,
  MAX_BACKUP_PLAINTEXT_BYTES,
  readEncryptedBackup,
} from "@features/backup/backup.ts";

const supportsWebCrypto =
  typeof crypto === "object" &&
  typeof crypto.getRandomValues === "function" &&
  typeof crypto.subtle === "object";
const cryptoTest = supportsWebCrypto ? test : test.skip;

describe("encrypted backups", () => {
  cryptoTest("round-trips Unicode data and rejects a wrong password", async () => {
    const value = {
      version: 1,
      cards: [{ id: "c1", name: "Çağrı 李", avatar: "🧑🏽‍💻" }],
      nested: { enabled: true, count: 42 },
    };
    const contents = await createEncryptedBackup(value, "Correct Horse 7! 🔐");

    expect(contents).not.toContain("Çağrı");
    expect(await readEncryptedBackup(contents, "Correct Horse 7! 🔐")).toEqual({
      ok: true,
      value,
    });
    expect(await readEncryptedBackup(contents, "wrong password")).toEqual({
      ok: false,
      reason: "wrong-password-or-damaged",
    });
  });

  test("classifies invalid and unsupported files before decryption", async () => {
    expect(await readEncryptedBackup("not JSON", "password")).toEqual({
      ok: false,
      reason: "invalid-file",
    });
    expect(
      await readEncryptedBackup(
        JSON.stringify({ format: "keychain-wallet-backup", version: 2 }),
        "password",
      ),
    ).toEqual({ ok: false, reason: "unsupported" });
    expect(
      await readEncryptedBackup(
        JSON.stringify({
          format: "keychain-wallet-backup",
          version: 1,
          iterations: 1,
          salt: "",
          iv: "",
          ciphertext: "",
        }),
        "password",
      ),
    ).toEqual({ ok: false, reason: "invalid-file" });
  });

  test("classifies malformed base64 fields as an invalid file", async () => {
    const contents = JSON.stringify({
      format: "keychain-wallet-backup",
      version: 1,
      iterations: 250_000,
      salt: "%%%not-base64%%%",
      iv: "%%%not-base64%%%",
      ciphertext: "%%%not-base64%%%",
    });

    expect(await readEncryptedBackup(contents, "password")).toEqual({
      ok: false,
      reason: "invalid-file",
    });
  });

  test("rejects oversized files before parsing or key derivation", async () => {
    expect(await readEncryptedBackup(" ".repeat(MAX_BACKUP_BYTES + 1), "password")).toEqual({
      ok: false,
      reason: "invalid-file",
    });
  });

  test("never creates a backup larger than the reader accepts", async () => {
    expect(
      createEncryptedBackup("x".repeat(MAX_BACKUP_PLAINTEXT_BYTES + 1), "password"),
    ).rejects.toBeInstanceOf(BackupTooLargeError);
  });
});
