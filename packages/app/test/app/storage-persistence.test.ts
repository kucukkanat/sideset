import { describe, expect, test } from "bun:test";
import { MAX_ACTIVITY_STORAGE_BYTES } from "@app/storage/persistence.ts";
import {
  ACTIVITY_STORAGE_KEY,
  createInitialWalletState,
  decodeWalletSnapshot,
  loadWalletState,
  MAX_COMMITTED_STORAGE_BYTES,
  PEOPLE_STORAGE_KEY,
  resetWalletState,
  saveWalletState,
  WALLET_STORAGE_KEY,
  type WalletState,
  walletPreferenceInitialization,
  walletSnapshot,
  walletStorageCapacityForChange,
} from "@app/storage.ts";
import { createInitialActivity } from "@features/activity/activity.ts";
import { SEED_CARDS, SEED_CONTACTS } from "@keychain/core";

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();
  #successfulWritesBeforeFailure: number | null = null;
  #nextFailingReadKey: string | null = null;
  readonly writes: string[] = [];

  constructor(entries: readonly (readonly [string, string])[] = []) {
    for (const [key, value] of entries) this.#values.set(key, value);
  }

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    if (this.#nextFailingReadKey === key) {
      this.#nextFailingReadKey = null;
      throw new Error("in-memory storage read interrupted");
    }
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.#successfulWritesBeforeFailure === 0) {
      this.#successfulWritesBeforeFailure = null;
      throw new Error("in-memory storage write interrupted");
    }
    if (this.#successfulWritesBeforeFailure !== null) {
      this.#successfulWritesBeforeFailure -= 1;
    }
    this.#values.set(key, value);
    this.writes.push(key);
  }

  seed(key: string, value: string): void {
    this.#values.set(key, value);
  }

  failAfter(successfulWrites: number): void {
    this.#successfulWritesBeforeFailure = successfulWrites;
  }

  failNextRead(key: string): void {
    this.#nextFailingReadKey = key;
  }

  clearWrites(): void {
    this.writes.length = 0;
  }
}

const state = (): WalletState => ({
  ...createInitialWalletState(),
  cards: SEED_CARDS,
  contacts: SEED_CONTACTS,
  activeId: SEED_CARDS[0]?.id ?? "",
  theme: "dark",
  activity: createInitialActivity(2_000_000_000_000).slice(0, 2),
});

const parsed = (storage: Storage, key: string): Readonly<Record<string, unknown>> => {
  const raw = storage.getItem(key);
  if (raw === null) throw new Error(`Missing in-memory storage value: ${key}`);
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid in-memory storage value: ${key}`);
  }
  return value as Readonly<Record<string, unknown>>;
};

describe("split wallet persistence", () => {
  test("uses migrated defaults only for an actual aggregate v1 document", () => {
    const storage = new MemoryStorage();
    expect(walletPreferenceInitialization(storage)).toBe("new-install");

    expect(saveWalletState(state(), storage)).toEqual({ ok: true });
    expect(walletPreferenceInitialization(storage)).toBe("new-install");

    storage.seed(WALLET_STORAGE_KEY, JSON.stringify(walletSnapshot(state())));
    expect(walletPreferenceInitialization(storage)).toBe("legacy-v1");
  });

  test("rejects user changes that cannot fit the next transactional storage revision", () => {
    const initial = state();
    const firstCard = initial.cards[0];
    const secondCard = initial.cards[1];
    const firstContact = initial.contacts[0];
    const secondContact = initial.contacts[1];
    if (
      firstCard === undefined ||
      secondCard === undefined ||
      firstContact === undefined ||
      secondContact === undefined
    ) {
      throw new Error("Seed state needs two cards and contacts");
    }
    const largeAvatar = `data:image/png;base64,${"A".repeat(4_100_000)}`;
    const currentCore = {
      ...initial,
      cards: [{ ...firstCard, avatar: largeAvatar }, ...initial.cards.slice(1)],
    };
    expect(
      walletStorageCapacityForChange(currentCore, {
        ...currentCore,
        cards: [
          currentCore.cards[0] ?? firstCard,
          { ...secondCard, avatar: largeAvatar },
          ...currentCore.cards.slice(2),
        ],
      }),
    ).toEqual({ ok: false, namespace: "core" });

    const currentPeople = {
      ...initial,
      contacts: [{ ...firstContact, avatar: largeAvatar }, ...initial.contacts.slice(1)],
    };
    expect(
      walletStorageCapacityForChange(currentPeople, {
        ...currentPeople,
        contacts: [
          currentPeople.contacts[0] ?? firstContact,
          { ...secondContact, avatar: largeAvatar },
          ...currentPeople.contacts.slice(2),
        ],
      }),
    ).toEqual({ ok: false, namespace: "people" });
  });

  test("enforces one aggregate budget across otherwise valid namespaces", () => {
    const initial = state();
    const firstCard = initial.cards[0];
    if (firstCard === undefined) throw new Error("Seed state needs a card");
    const legacySizedAvatar = `data:image/png;base64,${"A".repeat(MAX_COMMITTED_STORAGE_BYTES)}`;
    const next = {
      ...initial,
      cards: [{ ...firstCard, avatar: legacySizedAvatar }, ...initial.cards.slice(1)],
    };

    expect(walletStorageCapacityForChange(initial, next)).toEqual({
      ok: false,
      namespace: "aggregate",
    });

    const storage = new MemoryStorage();
    expect(saveWalletState(next, storage)).toEqual({ ok: false, reason: "invalid" });
    expect(storage.writes).toEqual([]);
  });

  test("allows an over-budget legacy avatar to be removed and compacts committed history", () => {
    const initial = state();
    const firstContact = initial.contacts[0];
    if (firstContact === undefined) throw new Error("Seed state needs a contact");
    const oversized = {
      ...initial,
      contacts: [
        {
          ...firstContact,
          avatar: `data:image/png;base64,${"A".repeat(MAX_COMMITTED_STORAGE_BYTES + 100_000)}`,
        },
        ...initial.contacts.slice(1),
      ],
    };
    const removed = { ...oversized, contacts: [] };

    expect(walletStorageCapacityForChange(oversized, removed)).toEqual({ ok: true });

    const legacy = new MemoryStorage([
      [WALLET_STORAGE_KEY, JSON.stringify(walletSnapshot(oversized))],
    ]);
    expect(loadWalletState(legacy).state.contacts).toHaveLength(initial.contacts.length);
    expect(saveWalletState(removed, legacy)).toEqual({ ok: true });
    expect(loadWalletState(legacy).state.contacts).toEqual([]);

    const split = new MemoryStorage();
    expect(saveWalletState(initial, split)).toEqual({ ok: true });
    expect(
      saveWalletState(
        {
          ...initial,
          contacts: [{ ...firstContact, name: "Compacted" }, ...initial.contacts.slice(1)],
        },
        split,
      ),
    ).toEqual({ ok: true });
    expect(parsed(split, PEOPLE_STORAGE_KEY).revisions).toHaveLength(1);
  });

  test("migrates a valid aggregate v1 snapshot feature-first and remains read-only afterwards", () => {
    const initial = state();
    const legacy = JSON.stringify(walletSnapshot(initial));
    const storage = new MemoryStorage([[WALLET_STORAGE_KEY, legacy]]);

    expect(loadWalletState(storage)).toEqual({ ok: true, state: initial });
    expect(storage.writes).toEqual([PEOPLE_STORAGE_KEY, ACTIVITY_STORAGE_KEY, WALLET_STORAGE_KEY]);
    expect(parsed(storage, WALLET_STORAGE_KEY)).toMatchObject({
      format: "keychain.wallet.core",
      version: 2,
      features: {
        people: { protected: false },
        activity: { protected: false },
      },
    });
    expect(decodeWalletSnapshot(parsed(storage, WALLET_STORAGE_KEY))).toEqual({
      ok: false,
      reason: "unsupported",
    });

    storage.clearWrites();
    expect(loadWalletState(storage)).toEqual({ ok: true, state: initial });
    expect(storage.writes).toEqual([]);
  });

  test("retries an interrupted legacy migration without duplicating revisions", () => {
    const initial = state();
    const legacy = JSON.stringify(walletSnapshot(initial));
    const storage = new MemoryStorage([[WALLET_STORAGE_KEY, legacy]]);
    storage.failAfter(2);

    expect(loadWalletState(storage)).toEqual({ ok: true, state: initial });
    expect(storage.getItem(WALLET_STORAGE_KEY)).toBe(legacy);
    expect(storage.getItem(PEOPLE_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem(ACTIVITY_STORAGE_KEY)).not.toBeNull();

    storage.clearWrites();
    expect(loadWalletState(storage)).toEqual({ ok: true, state: initial });
    expect(storage.writes).toEqual([WALLET_STORAGE_KEY]);
    expect(parsed(storage, PEOPLE_STORAGE_KEY)).toMatchObject({
      revisions: [{ contacts: initial.contacts }],
    });
    expect((parsed(storage, PEOPLE_STORAGE_KEY).revisions as readonly unknown[]).length).toBe(1);
  });

  test("selects prior feature revisions when a normal multi-key save is interrupted", () => {
    const initial = state();
    const firstCard = initial.cards[0];
    const firstContact = initial.contacts[0];
    const firstActivity = initial.activity[0];
    if (firstCard === undefined || firstContact === undefined || firstActivity === undefined) {
      throw new Error("Seed state is incomplete");
    }
    const storage = new MemoryStorage();
    expect(saveWalletState(initial, storage)).toEqual({ ok: true });
    const next: WalletState = {
      ...initial,
      cards: [{ ...firstCard, name: "Changed core" }, ...initial.cards.slice(1)],
      contacts: [{ ...firstContact, name: "Changed person" }, ...initial.contacts.slice(1)],
      activity: [{ ...firstActivity, id: "changed-activity" }, ...initial.activity.slice(1)],
    };

    storage.failAfter(1);
    expect(saveWalletState(next, storage)).toEqual({ ok: false, reason: "unavailable" });
    expect(loadWalletState(storage)).toEqual({ ok: true, state: initial });

    expect(saveWalletState(next, storage)).toEqual({ ok: true });
    expect(loadWalletState(storage)).toEqual({ ok: true, state: next });
  });

  test("does not replace a valid envelope when its committed revision is missing", () => {
    const initial = state();
    const firstCard = initial.cards[0];
    const firstContact = initial.contacts[0];
    if (firstCard === undefined || firstContact === undefined) {
      throw new Error("Seed state needs a card and contact");
    }
    const storage = new MemoryStorage();
    expect(saveWalletState(initial, storage)).toEqual({ ok: true });

    const alternateStorage = new MemoryStorage();
    const alternate = {
      ...initial,
      contacts: [{ ...firstContact, name: "Different revision" }, ...initial.contacts.slice(1)],
    };
    expect(saveWalletState(alternate, alternateStorage)).toEqual({ ok: true });
    const unrelatedPeople = alternateStorage.getItem(PEOPLE_STORAGE_KEY);
    if (unrelatedPeople === null) throw new Error("Expected an alternate People envelope");
    storage.seed(PEOPLE_STORAGE_KEY, unrelatedPeople);

    expect(loadWalletState(storage)).toMatchObject({
      ok: true,
      state: { cards: initial.cards, contacts: [] },
      issues: [{ feature: "people", reason: "missing-revision" }],
      unavailableFeatures: ["people"],
    });
    const changedCore = {
      ...initial,
      contacts: [],
      cards: [{ ...firstCard, name: "Core survives missing People" }, ...initial.cards.slice(1)],
    };
    expect(saveWalletState(changedCore, storage)).toEqual({
      ok: true,
      issues: [{ feature: "people", reason: "missing-revision" }],
      unavailableFeatures: ["people"],
    });
    expect(storage.getItem(PEOPLE_STORAGE_KEY)).toBe(unrelatedPeople);
    expect(loadWalletState(storage).state.cards[0]?.name).toBe("Core survives missing People");
  });

  test("carries unavailable-feature provenance across a transient storage recovery", () => {
    const initial = state();
    const firstCard = initial.cards[0];
    if (firstCard === undefined) throw new Error("Seed state needs a card");
    const storage = new MemoryStorage();
    expect(saveWalletState(initial, storage)).toEqual({ ok: true });
    const originalPeople = storage.getItem(PEOPLE_STORAGE_KEY);
    if (originalPeople === null) throw new Error("Expected a People envelope");

    storage.seed(PEOPLE_STORAGE_KEY, '{"version":2,"feature":"people"}');
    const unavailable = loadWalletState(storage);
    expect(unavailable).toMatchObject({
      ok: true,
      state: { contacts: [] },
      unavailableFeatures: ["people"],
    });
    if (!unavailable.ok) throw new Error("Core state should remain available");
    const preserveFeatures = unavailable.unavailableFeatures;
    if (preserveFeatures === undefined) throw new Error("People provenance should be preserved");

    // The key recovers before React's persistence effect runs. The fallback must not become data.
    storage.seed(PEOPLE_STORAGE_KEY, originalPeople);
    const changedCore = {
      ...unavailable.state,
      cards: [{ ...firstCard, name: "Core survives recovery" }, ...initial.cards.slice(1)],
    };
    expect(
      saveWalletState(changedCore, storage, {
        preserveFeatures,
      }),
    ).toEqual({
      ok: true,
      issues: [{ feature: "people", reason: "protected" }],
      unavailableFeatures: ["people"],
    });
    expect(storage.getItem(PEOPLE_STORAGE_KEY)).toBe(originalPeople);
    expect(loadWalletState(storage)).toMatchObject({
      ok: true,
      state: {
        cards: [{ ...firstCard, name: "Core survives recovery" }, ...initial.cards.slice(1)],
        contacts: initial.contacts,
      },
    });
  });

  test("retries a known feature revision after a transient save-time read failure", () => {
    const initial = state();
    const storage = new MemoryStorage();
    expect(saveWalletState(initial, storage)).toEqual({ ok: true });
    const originalPeople = storage.getItem(PEOPLE_STORAGE_KEY);
    if (originalPeople === null) throw new Error("Expected a People envelope");

    storage.failNextRead(PEOPLE_STORAGE_KEY);
    expect(saveWalletState({ ...initial, theme: "light" }, storage)).toEqual({
      ok: true,
      issues: [{ feature: "people", reason: "unavailable" }],
      unavailableFeatures: ["people"],
    });

    expect(storage.getItem(PEOPLE_STORAGE_KEY)).toBe(originalPeople);
    expect(loadWalletState(storage)).toMatchObject({
      ok: true,
      state: { contacts: initial.contacts, theme: "light" },
    });
  });

  test("protects a valid reserved envelope when no core reference authorizes it", () => {
    const initial = state();
    const firstCard = initial.cards[0];
    if (firstCard === undefined) throw new Error("Seed state needs a card");
    const source = new MemoryStorage();
    expect(saveWalletState(initial, source)).toEqual({ ok: true });
    const reservedPeople = source.getItem(PEOPLE_STORAGE_KEY);
    if (reservedPeople === null) throw new Error("Expected a reserved People envelope");

    const storage = new MemoryStorage([[PEOPLE_STORAGE_KEY, reservedPeople]]);
    const withoutPeople = { ...initial, contacts: [] };
    expect(saveWalletState(withoutPeople, storage)).toEqual({
      ok: true,
      issues: [{ feature: "people", reason: "protected" }],
      unavailableFeatures: ["people"],
    });
    expect(storage.getItem(PEOPLE_STORAGE_KEY)).toBe(reservedPeople);
    expect(loadWalletState(storage)).toMatchObject({
      ok: true,
      state: { cards: initial.cards, contacts: [] },
      issues: [{ feature: "people", reason: "protected" }],
      unavailableFeatures: ["people"],
    });

    const changedCore = {
      ...withoutPeople,
      cards: [
        { ...firstCard, name: "Core advances beside reserved People" },
        ...initial.cards.slice(1),
      ],
    };
    expect(saveWalletState(changedCore, storage)).toEqual({
      ok: true,
      issues: [{ feature: "people", reason: "protected" }],
      unavailableFeatures: ["people"],
    });
    expect(storage.getItem(PEOPLE_STORAGE_KEY)).toBe(reservedPeople);
  });

  test("appends legacy data to a valid optional history without discarding its revision", () => {
    const initial = state();
    const firstContact = initial.contacts[0];
    if (firstContact === undefined) throw new Error("Seed state needs a contact");
    const source = new MemoryStorage();
    const alternate = {
      ...initial,
      contacts: [{ ...firstContact, name: "Pre-existing revision" }, ...initial.contacts.slice(1)],
    };
    expect(saveWalletState(alternate, source)).toEqual({ ok: true });
    const preExisting = parsed(source, PEOPLE_STORAGE_KEY).revisions as readonly unknown[];
    const preExistingRaw = source.getItem(PEOPLE_STORAGE_KEY);
    if (preExistingRaw === null) throw new Error("Expected a People history");

    const storage = new MemoryStorage([
      [WALLET_STORAGE_KEY, JSON.stringify(walletSnapshot(initial))],
      [PEOPLE_STORAGE_KEY, preExistingRaw],
    ]);
    expect(loadWalletState(storage)).toEqual({ ok: true, state: initial });
    const migrated = parsed(storage, PEOPLE_STORAGE_KEY).revisions as readonly unknown[];
    expect(migrated).toHaveLength(2);
    expect(migrated[0]).toEqual(preExisting[0]);
  });

  test("keeps legacy authority when both optional history slots are occupied", () => {
    const initial = state();
    const firstContact = initial.contacts[0];
    if (firstContact === undefined) throw new Error("Seed state needs a contact");
    const source = new MemoryStorage();
    const first = {
      ...initial,
      contacts: [{ ...firstContact, name: "Revision one" }, ...initial.contacts.slice(1)],
    };
    const second = {
      ...first,
      contacts: [{ ...firstContact, name: "Revision two" }, ...initial.contacts.slice(1)],
    };
    expect(saveWalletState(first, source)).toEqual({ ok: true });
    // Simulate a post-commit compaction failure; both revisions remain valid and readable.
    source.failAfter(2);
    expect(saveWalletState(second, source)).toEqual({ ok: true });
    const fullHistory = source.getItem(PEOPLE_STORAGE_KEY);
    if (fullHistory === null) throw new Error("Expected a full People history");
    const legacy = JSON.stringify(walletSnapshot(initial));
    const storage = new MemoryStorage([
      [WALLET_STORAGE_KEY, legacy],
      [PEOPLE_STORAGE_KEY, fullHistory],
    ]);

    expect(loadWalletState(storage)).toEqual({
      ok: true,
      state: initial,
      issues: [{ feature: "people", reason: "protected" }],
    });
    expect(storage.getItem(WALLET_STORAGE_KEY)).toBe(legacy);
    expect(storage.getItem(PEOPLE_STORAGE_KEY)).toBe(fullHistory);
    expect(storage.getItem(ACTIVITY_STORAGE_KEY)).toBeNull();
  });

  test("preserves protected optional bytes while core and healthy features keep advancing", () => {
    const initial = state();
    const firstCard = initial.cards[0];
    const firstActivity = initial.activity[0];
    if (firstCard === undefined || firstActivity === undefined) {
      throw new Error("Seed state needs a card and activity");
    }
    const storage = new MemoryStorage();
    expect(saveWalletState(initial, storage)).toEqual({ ok: true });
    const newerPeople = JSON.stringify({ version: 2, feature: "people", opaque: "keep" });
    const previousActivity = storage.getItem(ACTIVITY_STORAGE_KEY);
    storage.seed(PEOPLE_STORAGE_KEY, newerPeople);

    const isolated = loadWalletState(storage);
    expect(isolated).toMatchObject({
      ok: true,
      state: { cards: initial.cards, contacts: [], activity: initial.activity },
      issues: [{ feature: "people", reason: "unsupported" }],
      unavailableFeatures: ["people"],
    });
    expect(storage.getItem(PEOPLE_STORAGE_KEY)).toBe(newerPeople);

    const changedCore = {
      ...isolated.state,
      cards: [{ ...firstCard, name: "Core still saves" }, ...initial.cards.slice(1)],
      activity: [
        { ...firstActivity, id: "healthy-activity-advanced" },
        ...initial.activity.slice(1),
      ],
    };
    expect(saveWalletState(changedCore, storage)).toEqual({
      ok: true,
      issues: [{ feature: "people", reason: "unsupported" }],
      unavailableFeatures: ["people"],
    });
    expect(storage.getItem(PEOPLE_STORAGE_KEY)).toBe(newerPeople);
    expect(storage.getItem(ACTIVITY_STORAGE_KEY)).not.toBe(previousActivity);
    expect(loadWalletState(storage).state.cards[0]?.name).toBe("Core still saves");
    expect(loadWalletState(storage).state.activity[0]?.id).toBe("healthy-activity-advanced");
  });

  test("keeps legacy aggregate authority when reserved feature bytes are protected", () => {
    const initial = state();
    const firstCard = initial.cards[0];
    if (firstCard === undefined) throw new Error("Seed state needs a card");
    const legacy = JSON.stringify(walletSnapshot(initial));
    const newerPeople = JSON.stringify({ version: 9, future: true });
    const storage = new MemoryStorage([
      [WALLET_STORAGE_KEY, legacy],
      [PEOPLE_STORAGE_KEY, newerPeople],
    ]);

    expect(loadWalletState(storage)).toEqual({
      ok: true,
      state: initial,
      issues: [{ feature: "people", reason: "unsupported" }],
    });
    expect(storage.getItem(WALLET_STORAGE_KEY)).toBe(legacy);
    expect(storage.getItem(PEOPLE_STORAGE_KEY)).toBe(newerPeople);

    const changed = {
      ...initial,
      cards: [{ ...firstCard, name: "Legacy core changed" }, ...initial.cards.slice(1)],
    };
    expect(saveWalletState(changed, storage)).toEqual({
      ok: true,
      issues: [{ feature: "people", reason: "unsupported" }],
    });
    const savedLegacy = parsed(storage, WALLET_STORAGE_KEY);
    expect(savedLegacy.version).toBe(1);
    expect((savedLegacy.cards as readonly { readonly name: string }[])[0]?.name).toBe(
      "Legacy core changed",
    );
    expect(savedLegacy.contacts).toEqual(initial.contacts);
    expect(storage.getItem(PEOPLE_STORAGE_KEY)).toBe(newerPeople);
  });

  test("uses an explicit reset marker before replacing protected optional envelopes", () => {
    const storage = new MemoryStorage();
    expect(saveWalletState(state(), storage)).toEqual({ ok: true });
    const newerPeople = JSON.stringify({ version: 2, feature: "people", opaque: "keep" });
    const corruptActivity = "{corrupt";
    storage.seed(PEOPLE_STORAGE_KEY, newerPeople);
    storage.seed(ACTIVITY_STORAGE_KEY, corruptActivity);
    storage.failAfter(1);

    expect(resetWalletState(storage)).toEqual({ ok: true });
    expect(loadWalletState(storage)).toEqual({ ok: true, state: createInitialWalletState() });
    expect(storage.getItem(PEOPLE_STORAGE_KEY)).toBe(newerPeople);
    expect(storage.getItem(ACTIVITY_STORAGE_KEY)).toBe(corruptActivity);

    expect(saveWalletState(createInitialWalletState(), storage)).toEqual({ ok: true });
    expect(parsed(storage, PEOPLE_STORAGE_KEY)).toMatchObject({ version: 1, feature: "people" });
    expect(parsed(storage, ACTIVITY_STORAGE_KEY)).toMatchObject({
      version: 1,
      feature: "activity",
    });
  });

  test("enforces count and byte budgets before trusting feature data", () => {
    const initial = state();
    const firstActivity = initial.activity[0];
    if (firstActivity === undefined) throw new Error("Seed state needs activity");
    const tooManyActivity = Array.from({ length: 101 }, (_, index) => ({
      ...firstActivity,
      id: `activity-${index}`,
    }));
    const storage = new MemoryStorage();
    expect(saveWalletState({ ...initial, activity: tooManyActivity }, storage)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(storage.length).toBe(0);

    expect(saveWalletState(initial, storage)).toEqual({ ok: true });
    const oversized = "x".repeat(MAX_ACTIVITY_STORAGE_BYTES + 1);
    storage.seed(ACTIVITY_STORAGE_KEY, oversized);
    expect(loadWalletState(storage)).toMatchObject({
      ok: true,
      state: { cards: initial.cards, contacts: initial.contacts, activity: [] },
      issues: [{ feature: "activity", reason: "invalid" }],
      unavailableFeatures: ["activity"],
    });
    expect(storage.getItem(ACTIVITY_STORAGE_KEY)).toBe(oversized);
  });

  test("refuses normal writes over a newer core but lets explicit reset replace it", () => {
    const raw = JSON.stringify({
      format: "keychain.wallet.core",
      version: 3,
      future: "preserve",
    });
    const storage = new MemoryStorage([[WALLET_STORAGE_KEY, raw]]);

    expect(loadWalletState(storage)).toMatchObject({ ok: false, reason: "unsupported" });
    expect(saveWalletState(state(), storage)).toEqual({ ok: false, reason: "invalid" });
    expect(storage.getItem(WALLET_STORAGE_KEY)).toBe(raw);

    expect(resetWalletState(storage)).toEqual({ ok: true });
    expect(loadWalletState(storage)).toEqual({ ok: true, state: createInitialWalletState() });
    expect(parsed(storage, WALLET_STORAGE_KEY)).toMatchObject({ version: 2 });
  });
});
