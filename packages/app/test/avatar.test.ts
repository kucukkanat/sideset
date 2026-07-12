import { describe, expect, test } from "bun:test";
import { isAvatar, MAX_AVATAR_BYTES, readAvatarFile } from "../src/avatar.ts";

const dataUrl = (bytes: number): string =>
  `data:image/png;base64,${"A".repeat(4 * Math.ceil(bytes / 3))}`;

describe("profile image limits", () => {
  test("accepts a 4 MB image and rejects larger encoded images", () => {
    expect(MAX_AVATAR_BYTES).toBe(4_000_000);
    expect(isAvatar(dataUrl(MAX_AVATAR_BYTES))).toBe(true);
    expect(isAvatar(dataUrl(MAX_AVATAR_BYTES + 3))).toBe(false);
  });

  test("validates and reads supported profile images", async () => {
    expect(await readAvatarFile(new File(["avatar"], "avatar.png", { type: "image/png" }))).toEqual(
      { ok: true, avatar: "data:image/png;base64,YXZhdGFy" },
    );
    expect(await readAvatarFile(new File(["text"], "avatar.txt", { type: "text/plain" }))).toEqual({
      ok: false,
      message: "Choose a JPEG, PNG, WebP, or GIF image",
    });
    expect(
      await readAvatarFile(
        new File([new Uint8Array(MAX_AVATAR_BYTES + 1)], "avatar.png", { type: "image/png" }),
      ),
    ).toEqual({ ok: false, message: "Choose an image no larger than 4 MB" });
  });
});
