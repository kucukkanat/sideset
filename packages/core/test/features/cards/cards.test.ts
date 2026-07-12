import { describe, expect, test } from "bun:test";
import {
  addProof,
  createCard,
  PALETTES,
  paletteFor,
  removeProof,
  SEED_CARDS,
  SEED_CONTACTS,
  searchCards,
  updateCard,
} from "@keychain/core";

describe("createCard", () => {
  test("trims the name and derives the handle", () => {
    const identity = { publicKey: "public", privateKey: "private" };
    const c = createCard({
      id: "x1",
      name: "  Side Project ",
      avatar: "🚀",
      color: 3,
      identity,
    });
    expect(c.name).toBe("Side Project");
    expect(c.handle).toBe("sideproject");
    expect(c.username).toBe("sideproject");
    expect(c.email).toBe("");
    expect(c.tag).toBe("New card");
    expect(c.proofs).toEqual([]);
    expect(c.identity).toBe(identity);
  });
});

describe("addProof / removeProof", () => {
  const cards = SEED_CARDS;
  test("adds a proof with the derived username", () => {
    const next = addProof(cards, "c3", "twitter");
    const anon = next.find((c) => c.id === "c3");
    expect(anon?.proofs).toEqual([{ provider: "twitter", username: "@shadowfox" }]);
  });
  test("adds the first proof when proofs are absent", () => {
    const source = SEED_CARDS[2];
    if (source === undefined) throw new Error("Expected a seeded card");
    const { proofs: _proofs, ...withoutProofs } = source;
    expect(addProof([withoutProofs], source.id, "github")[0]?.proofs).toEqual([
      { provider: "github", username: "shadowfox" },
    ]);
  });
  test("is idempotent per provider and leaves other cards untouched", () => {
    const once = addProof(cards, "c1", "twitter");
    expect(once).toEqual(cards); // c1 already has a twitter proof
    expect(addProof(cards, "c3", "github").find((c) => c.id === "c1")).toBe(
      cards.find((c) => c.id === "c1"),
    );
  });
  test("removes only the named provider", () => {
    const next = removeProof(cards, "c1", "twitter");
    const c1 = next.find((c) => c.id === "c1");
    expect(c1?.proofs?.some((p) => p.provider === "twitter")).toBe(false);
    expect(c1?.proofs?.some((p) => p.provider === "github")).toBe(true);
  });
});

describe("updateCard", () => {
  test("patches only the target card", () => {
    const next = updateCard(SEED_CARDS, "c2", { name: "Studio", bio: "New bio" });
    expect(next.find((c) => c.id === "c2")?.name).toBe("Studio");
    expect(next.find((c) => c.id === "c1")).toBe(SEED_CARDS.find((c) => c.id === "c1"));
  });
  test("keeps the legacy handle synchronized with the Nostr username", () => {
    const updated = updateCard(SEED_CARDS, "c1", { username: "new-name" })[0];
    expect(updated?.username).toBe("new-name");
    expect(updated?.handle).toBe("new-name");
  });
});

describe("searchCards", () => {
  test("searches all public identity fields without exposing private keys", () => {
    const first = SEED_CARDS[0];
    if (first === undefined) throw new Error("Expected a seeded card");
    const cards = [
      {
        ...first,
        identity: { publicKey: "public-search-key", privateKey: "never-search-this-secret" },
      },
      ...SEED_CARDS.slice(1),
    ];
    expect(searchCards(cards, "coffee").map(({ id }) => id)).toEqual(["c1"]);
    expect(searchCards(cards, "slack").map(({ id }) => id)).toEqual(["c2"]);
    expect(searchCards(cards, "public-search-key").map(({ id }) => id)).toEqual(["c1"]);
    expect(searchCards(cards, "never-search-this-secret")).toEqual([]);
  });
});

describe("paletteFor", () => {
  test("wraps around the palette ring", () => {
    expect(paletteFor(0)).toBe(PALETTES[0]);
    expect(paletteFor(PALETTES.length)).toBe(PALETTES[0]);
    expect(paletteFor(-1)).toBe(PALETTES[PALETTES.length - 1] ?? PALETTES[0]);
  });
});

describe("seed data", () => {
  test("cards and contacts are well-formed", () => {
    expect(SEED_CARDS.length).toBeGreaterThan(0);
    expect(SEED_CONTACTS.length).toBeGreaterThan(0);
    for (const c of SEED_CONTACTS) expect(c.npub.startsWith("npub1")).toBe(true);
  });
});
