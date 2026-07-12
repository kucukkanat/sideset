import { describe, expect, test } from "bun:test";
import { isAvatar, MAX_AVATAR_BYTES } from "../src/avatar.ts";

const dataUrl = (bytes: number): string =>
  `data:image/png;base64,${"A".repeat(4 * Math.ceil(bytes / 3))}`;

describe("profile image limits", () => {
  test("accepts a 4 MB image and rejects larger encoded images", () => {
    expect(MAX_AVATAR_BYTES).toBe(4_000_000);
    expect(isAvatar(dataUrl(MAX_AVATAR_BYTES))).toBe(true);
    expect(isAvatar(dataUrl(MAX_AVATAR_BYTES + 3))).toBe(false);
  });
});
