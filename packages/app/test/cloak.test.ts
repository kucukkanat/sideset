import { describe, expect, test } from "bun:test";
import {
  hideWithCloak,
  MAX_CLOAKED_MESSAGE_LENGTH,
  revealWithCloak,
  visibleCloakText,
} from "../src/cloak.ts";

describe("Cloak text tools", () => {
  test("hides and reveals a password-protected message without changing the visible text", async () => {
    const cover = "Dinner plans\nare still on.";
    const hidden = await hideWithCloak("Meet by the old bridge at six.", cover, "correct horse");
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;

    expect(visibleCloakText(hidden.value)).toBe(cover);
    expect(hidden.value).not.toBe(cover);
    expect(await revealWithCloak(hidden.value, "correct horse")).toEqual({
      ok: true,
      value: "Meet by the old bridge at six.",
    });
  });

  test("supports a cloak without a password", async () => {
    const hidden = await hideWithCloak("Bring snacks", "Movie night starts soon", "");
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    expect(await revealWithCloak(hidden.value, "")).toEqual({ ok: true, value: "Bring snacks" });
    expect(await revealWithCloak(hidden.value, "any password is ignored")).toEqual({
      ok: true,
      value: "Bring snacks",
    });
  });

  test("reports friendly validation and reveal failures", async () => {
    expect(await hideWithCloak("", "Two words", "")).toMatchObject({
      ok: false,
      error: { code: "empty-secret" },
    });
    expect(await hideWithCloak("Secret", "One", "")).toMatchObject({
      ok: false,
      error: { code: "short-cover" },
    });
    expect(await hideWithCloak("Secret", "Two words", "short")).toMatchObject({
      ok: false,
      error: { code: "short-password" },
    });
    expect(await hideWithCloak("Secret", "Two  words", "")).toMatchObject({
      ok: false,
      error: { code: "invalid-cover" },
    });
    expect(await hideWithCloak("Secret", "Two \u200cwords", "")).toMatchObject({
      ok: false,
      error: { code: "invalid-cover" },
    });
    expect(await revealWithCloak("ordinary visible text", "")).toMatchObject({
      ok: false,
      error: { code: "invalid-cloak" },
    });
    expect(await revealWithCloak("x".repeat(MAX_CLOAKED_MESSAGE_LENGTH + 1), "")).toMatchObject({
      ok: false,
      error: { code: "cloak-too-long" },
    });

    const hidden = await hideWithCloak("Secret", "At least two words", "right password");
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    expect(await revealWithCloak(hidden.value, "wrong password")).toMatchObject({
      ok: false,
      error: { code: "wrong-password" },
    });
  });
});
