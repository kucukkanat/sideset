import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SEED_CARDS, SEED_CONTACTS } from "@keychain/core";
import {
  createInitialWalletState,
  decodeWalletSnapshot,
  loadWalletState,
  saveWalletState,
  WALLET_STORAGE_KEY,
  type WalletState,
  walletSnapshot,
} from "../src/storage.ts";

beforeEach(() => localStorage.removeItem(WALLET_STORAGE_KEY));
afterEach(() => localStorage.removeItem(WALLET_STORAGE_KEY));

describe("wallet snapshot validation", () => {
  test("round-trips a valid versioned snapshot", () => {
    const state = createInitialWalletState(2_000_000_000_000);
    const snapshot = walletSnapshot(state);

    expect(snapshot.version).toBe(1);
    expect(decodeWalletSnapshot(snapshot)).toEqual({ ok: true, state });
  });

  test("reports a recognized but unsupported version", () => {
    const snapshot = walletSnapshot(createInitialWalletState(2_000_000_000_000));
    expect(decodeWalletSnapshot({ ...snapshot, version: 2 })).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  test("reports missing and malformed versions as invalid", () => {
    expect(decodeWalletSnapshot({})).toEqual({ ok: false, reason: "invalid" });
    expect(decodeWalletSnapshot({ version: "1" })).toEqual({ ok: false, reason: "invalid" });
  });

  test("rejects invalid state fields", () => {
    const snapshot = walletSnapshot(createInitialWalletState(2_000_000_000_000));
    const firstProof = SEED_CARDS[0]?.proofs[0];
    if (firstProof === undefined) throw new Error("Expected a seeded connected account");

    const invalid: readonly unknown[] = [
      null,
      { ...snapshot, cards: [] },
      { ...snapshot, activeId: "missing" },
      { ...snapshot, theme: "sepia" },
      { ...snapshot, contacts: [{ ...SEED_CONTACTS[0], mutuals: 1.5 }] },
      { ...snapshot, contacts: [{ ...SEED_CONTACTS[0], handle: "missing-at" }] },
      { ...snapshot, cards: [snapshot.cards[0], snapshot.cards[0]] },
      { ...snapshot, contacts: [snapshot.contacts[0], snapshot.contacts[0]] },
      { ...snapshot, activity: [snapshot.activity[0], snapshot.activity[0]] },
      {
        ...snapshot,
        cards: [
          {
            ...SEED_CARDS[0],
            proofs: [firstProof, firstProof],
          },
        ],
      },
      {
        ...snapshot,
        cards: [
          {
            ...SEED_CARDS[0],
            proofs: [{ provider: "not-a-provider", username: "user" }],
          },
        ],
      },
      {
        ...snapshot,
        activity: [
          {
            id: "bad",
            icon: { kind: "emoji", emoji: "🙂" },
            title: "Bad",
            sub: "",
            occurredAt: Number.NaN,
          },
        ],
      },
      {
        ...snapshot,
        activity: [
          {
            id: "external-background",
            icon: { kind: "emoji", emoji: "🙂", bg: "url(https://example.test/pixel)" },
            title: "Unsafe",
            sub: "",
            occurredAt: 1,
          },
        ],
      },
    ];

    for (const value of invalid) {
      expect(decodeWalletSnapshot(value)).toEqual({ ok: false, reason: "invalid" });
    }
  });
});

describe("wallet local storage", () => {
  test("persists and restores state through the real localStorage implementation", () => {
    const initial = createInitialWalletState(2_000_000_000_000);
    const secondCard = initial.cards[1];
    if (secondCard === undefined) throw new Error("Expected seeded cards");
    const state: WalletState = {
      ...initial,
      activeId: secondCard.id,
      theme: "dark",
      activity: initial.activity.slice(0, 2),
    };

    expect(saveWalletState(state)).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem(WALLET_STORAGE_KEY) ?? "null")).toEqual(
      walletSnapshot(state),
    );
    expect(loadWalletState()).toEqual({ ok: true, state });
  });

  test("uses initial state when no snapshot exists", () => {
    const result = loadWalletState();
    expect(result.ok).toBe(true);
    expect(result.state.cards).toEqual(SEED_CARDS);
    expect(result.state.contacts).toEqual(SEED_CONTACTS);
    expect(result.state.theme).toBe("system");
  });

  test("reports corrupted JSON as invalid and returns a usable fallback", () => {
    localStorage.setItem(WALLET_STORAGE_KEY, "{ definitely-not-json");
    const result = loadWalletState();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected corrupt storage to fail validation");
    expect(result.reason).toBe("invalid");
    expect(result.state.cards).toEqual(SEED_CARDS);
    expect(result.state.contacts).toEqual(SEED_CONTACTS);
    const firstCard = SEED_CARDS[0];
    if (firstCard === undefined) throw new Error("Expected seeded cards");
    expect(result.state.activeId).toBe(firstCard.id);
  });

  test("falls back when stored JSON has an invalid snapshot shape", () => {
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ version: 1, cards: [] }));
    const result = loadWalletState();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected invalid storage to fail validation");
    expect(result.reason).toBe("invalid");
    expect(result.state.cards).toEqual(SEED_CARDS);
  });

  test("refuses to persist state that its own decoder cannot restore", () => {
    const invalid: WalletState = { ...createInitialWalletState(), cards: [] };

    expect(saveWalletState(invalid)).toEqual({ ok: false, reason: "invalid" });
    expect(localStorage.getItem(WALLET_STORAGE_KEY)).toBeNull();
  });

  test("preserves a newer stored schema instead of treating it as corruption", () => {
    const newer = { ...walletSnapshot(createInitialWalletState()), version: 2 };
    const serialized = JSON.stringify(newer);
    localStorage.setItem(WALLET_STORAGE_KEY, serialized);

    const result = loadWalletState();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a newer schema to be unsupported");
    expect(result.reason).toBe("unsupported");
    expect(localStorage.getItem(WALLET_STORAGE_KEY)).toBe(serialized);
  });
});
