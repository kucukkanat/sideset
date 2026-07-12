import { describe, expect, test } from "bun:test";
import { sharedProfileTokenFromInput } from "@features/profile-sharing/sharedProfile.ts";
import { profileShareUrl } from "@features/profile-sharing/sharing.ts";
import encodeQr, { Bitmap } from "qr";
import decodeQr from "qr/decode.js";

describe("profileShareUrl", () => {
  test("preserves the document URL and replaces its hash with a stable contact route", () => {
    const token = "eyJuYW1lIjoiXyJ9-_";
    const result = profileShareUrl(
      "https://wallet.example/app/index.html?installed=true#/settings?sheet=help",
      token,
    );
    const url = new URL(result);

    expect(url.origin).toBe("https://wallet.example");
    expect(url.pathname).toBe("/app/index.html");
    expect(url.search).toBe("");
    expect(url.hash).toBe(`#/people?sheet=add&profile=${token}`);
    expect(sharedProfileTokenFromInput(result, "https://unused.example/")).toBe(token);
  });

  test("percent-encodes arbitrary profile values", () => {
    expect(profileShareUrl("https://wallet.example/", "value with spaces")).toBe(
      "https://wallet.example/#/people?sheet=add&profile=value+with+spaces",
    );
  });

  test("produces a profile URL that survives a standards-compliant QR round-trip", () => {
    const url = profileShareUrl("https://wallet.example/app", "e30".repeat(120));
    const cells = encodeQr(url, "raw", { border: 4, ecc: "low" });
    const bitmap = new Bitmap(cells.length, cells);

    expect(decodeQr(bitmap.toImage())).toBe(url);
  });
});
