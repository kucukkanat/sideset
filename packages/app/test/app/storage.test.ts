import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createInitialWalletState,
  decodeWalletBackup,
  decodeWalletSnapshot,
  loadWalletState,
  saveWalletState,
  WALLET_STORAGE_KEY,
  type WalletState,
  walletBackup,
  walletSnapshot,
} from "@app/storage.ts";
import { createInitialActivity } from "@features/activity/activity.ts";
import { SEED_CARDS, SEED_CONTACTS } from "@keychain/core";

beforeEach(() => localStorage.removeItem(WALLET_STORAGE_KEY));
afterEach(() => localStorage.removeItem(WALLET_STORAGE_KEY));

const seededState = (): WalletState => ({
  ...createInitialWalletState(),
  cards: SEED_CARDS,
  contacts: SEED_CONTACTS,
  activeId: SEED_CARDS[0]?.id ?? "",
  activity: createInitialActivity(2_000_000_000_000),
});

describe("wallet snapshot validation", () => {
  test("creates a selective app backup with individually chosen identities", () => {
    const state = seededState();
    const selected = state.cards[1];
    if (selected === undefined) throw new Error("Seed state needs a second identity");

    const backup = walletBackup(state, {
      cardIds: [selected.id],
      settings: false,
      contacts: true,
    });

    expect(decodeWalletBackup(backup)).toEqual({
      ok: true,
      state: {
        cards: [selected],
        contacts: state.contacts,
        activeId: selected.id,
        theme: "system",
        activity: [],
      },
      included: { settings: false, contacts: true },
    });
  });

  test("round-trips a valid versioned snapshot", () => {
    const state = createInitialWalletState(2_000_000_000_000);
    const snapshot = walletSnapshot(state);

    expect(snapshot.version).toBe(1);
    expect(decodeWalletSnapshot(snapshot)).toEqual({ ok: true, state });
  });

  test("normalizes legacy profile fields without requiring proofs", () => {
    const source = SEED_CARDS[0];
    if (source === undefined) throw new Error("Expected a seeded card");
    const { username: _username, email: _email, ...legacy } = source;
    const snapshot = { ...walletSnapshot(seededState()), cards: [legacy], activeId: legacy.id };
    const decoded = decodeWalletSnapshot(snapshot);
    expect(decoded).toMatchObject({
      ok: true,
      state: { cards: [{ username: legacy.handle, email: "finn@hey.com" }] },
    });

    const { proofs: _proofs, ...withoutProofs } = legacy;
    const proofless = decodeWalletSnapshot({
      ...snapshot,
      cards: [withoutProofs],
      activeId: withoutProofs.id,
    });
    expect(proofless).toMatchObject({ ok: true, state: { cards: [{ email: "" }] } });
  });

  test("reports a recognized but unsupported version", () => {
    const snapshot = walletSnapshot(seededState());
    expect(decodeWalletSnapshot({ ...snapshot, version: 2 })).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  test("reports missing and malformed versions as invalid", () => {
    expect(decodeWalletSnapshot({})).toEqual({ ok: false, reason: "invalid" });
    expect(decodeWalletSnapshot({ version: "1" })).toEqual({ ok: false, reason: "invalid" });
  });

  test("rejects legacy non-Nostr identities", () => {
    const card = SEED_CARDS[0];
    if (card === undefined) throw new Error("Expected a seeded card");
    expect(
      decodeWalletSnapshot({
        ...walletSnapshot(seededState()),
        cards: [
          {
            ...card,
            identity: { publicKey: "A".repeat(43), privateKey: "B".repeat(86) },
          },
        ],
        activeId: card.id,
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  test("rejects invalid state fields", () => {
    const snapshot = walletSnapshot(seededState());
    const firstProof = SEED_CARDS[0]?.proofs?.[0];
    if (firstProof === undefined) throw new Error("Expected a seeded connected account");

    const invalid: readonly unknown[] = [
      null,
      { ...snapshot, cards: [], activeId: snapshot.activeId },
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
    const initial = seededState();
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

  test("persists contacts that use a generated default avatar", () => {
    const state = seededState();
    const contact = state.contacts[0];
    if (contact === undefined) throw new Error("Expected a seeded contact");
    const generatedAvatarContact = {
      ...contact,
      avatar: "",
      npub: "a828c6fa1e85bcbf6a41c443965d4646eadce9675d2f12ec2a9fab7ed1e4e241",
    };
    const next = { ...state, contacts: [generatedAvatarContact, ...state.contacts.slice(1)] };

    expect(saveWalletState(next)).toEqual({ ok: true });
    expect(loadWalletState()).toEqual({ ok: true, state: next });
  });

  test("uses initial state when no snapshot exists", () => {
    const result = loadWalletState();
    expect(result.ok).toBe(true);
    expect(result.state.cards).toEqual([]);
    expect(result.state.contacts).toEqual([]);
    expect(result.state.theme).toBe("system");
  });

  test("reports corrupted JSON as invalid and returns a usable fallback", () => {
    localStorage.setItem(WALLET_STORAGE_KEY, "{ definitely-not-json");
    const result = loadWalletState();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected corrupt storage to fail validation");
    expect(result.reason).toBe("invalid");
    expect(result.state.cards).toEqual([]);
    expect(result.state.contacts).toEqual([]);
    expect(result.state.activeId).toBe("");
  });

  test("falls back when stored JSON has an invalid snapshot shape", () => {
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ version: 1, cards: [] }));
    const result = loadWalletState();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected invalid storage to fail validation");
    expect(result.reason).toBe("invalid");
    expect(result.state.cards).toEqual([]);
  });

  test("refuses to persist state that its own decoder cannot restore", () => {
    const invalid: WalletState = { ...createInitialWalletState(), activeId: "missing" };

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
