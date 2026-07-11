import { describe, expect, test } from "bun:test";
import {
  friendlyId,
  greetingFor,
  passStrength,
  proofsSummary,
  proofUserFor,
  STRENGTH_COLORS,
  STRENGTH_LABELS,
} from "@keychain/core";

describe("proofsSummary", () => {
  test("empty list", () => {
    expect(proofsSummary([])).toBe("No proofs yet");
  });
  test("one or two proofs join with a dot", () => {
    expect(proofsSummary([{ provider: "twitter", username: "@a" }])).toBe("X");
    expect(
      proofsSummary([
        { provider: "twitter", username: "@a" },
        { provider: "github", username: "a" },
      ]),
    ).toBe("X · GitHub");
  });
  test("more than two collapse into +n", () => {
    expect(
      proofsSummary([
        { provider: "twitter", username: "@a" },
        { provider: "github", username: "a" },
        { provider: "reddit", username: "u/a" },
        { provider: "email", username: "a@hey.com" },
      ]),
    ).toBe("X · GitHub +2");
  });
});

describe("friendlyId", () => {
  test("lowercases and strips spaces", () => {
    expect(friendlyId("My Cool Card")).toBe("keychain.me/mycoolcard");
  });
});

describe("greetingFor", () => {
  test("day parts", () => {
    expect(greetingFor(0)).toBe("Good morning");
    expect(greetingFor(11)).toBe("Good morning");
    expect(greetingFor(12)).toBe("Good afternoon");
    expect(greetingFor(17)).toBe("Good afternoon");
    expect(greetingFor(18)).toBe("Good evening");
    expect(greetingFor(23)).toBe("Good evening");
  });
});

describe("passStrength", () => {
  test("empty and short passwords are weak", () => {
    expect(passStrength("")).toBe(0);
    expect(passStrength("abc")).toBe(0);
  });
  test("scoring rules", () => {
    expect(passStrength("alllower")).toBe(1); // length only
    expect(passStrength("Mixedcase")).toBe(2); // length + case
    expect(passStrength("Mixedcase1")).toBe(3); // length + case + digit
    expect(passStrength("Aa1")).toBe(2); // case + digit, too short
    expect(passStrength("LongMixedPassword")).toBe(3); // 12+ chars with 2 rules promotes to 3
  });
  test("labels and colors cover all strengths", () => {
    expect(STRENGTH_LABELS).toHaveLength(4);
    expect(STRENGTH_COLORS).toHaveLength(3);
  });
});

describe("proofUserFor", () => {
  const card = { name: "Finn River", handle: "finnriver" };
  test("per-provider formats", () => {
    expect(proofUserFor(card, "twitter")).toBe("@finnriver");
    expect(proofUserFor(card, "reddit")).toBe("u/finnriver");
    expect(proofUserFor(card, "email")).toBe("finnriver@hey.com");
    expect(proofUserFor(card, "facebook")).toBe("Finn River");
    expect(proofUserFor(card, "slack")).toBe("Acme HQ");
    expect(proofUserFor(card, "confluence")).toBe("finnriver@acme");
    expect(proofUserFor(card, "github")).toBe("finnriver");
  });
  test("falls back to normalised name when handle is empty", () => {
    expect(proofUserFor({ name: "Finn River", handle: "" }, "github")).toBe("finnriver");
  });
});
