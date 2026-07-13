import type { ActivityItem } from "@features/activity/activity.ts";
import type { Card, Contact } from "@keychain/core";
import {
  createInitialWalletState,
  decodeActivity,
  decodeCards,
  decodeContacts,
  decodeWalletSnapshot,
  isRecord,
  isTheme,
  walletSnapshot,
} from "./codecs.ts";
import type {
  FeatureStorageIssue,
  FeatureStorageNamespace,
  StorageResult,
  Theme,
  WalletState,
} from "./model.ts";

export const WALLET_STORAGE_KEY = "keychain.wallet.v1";
export const PEOPLE_STORAGE_KEY = "keychain.feature.people.v1";
export const ACTIVITY_STORAGE_KEY = "keychain.feature.activity.v1";

export const MAX_LEGACY_STORAGE_BYTES = 16_000_000;
export const MAX_CORE_STORAGE_BYTES = 8_000_000;
export const MAX_PEOPLE_STORAGE_BYTES = 12_000_000;
export const MAX_ACTIVITY_STORAGE_BYTES = 1_000_000;
/** Leaves room for preferences and browser bookkeeping below common origin quotas. */
export const MAX_COMMITTED_STORAGE_BYTES = 4_000_000;

const CORE_FORMAT = "keychain.wallet.core";
const CORE_VERSION = 2;
const FEATURE_VERSION = 1;
const MAX_REVISIONS = 2;
const REVISION = /^state-[0-9a-f]{32}$/u;

interface FeatureReference {
  readonly revision: string | null;
  /** True means an unknown envelope was deliberately preserved and must not be replaced. */
  readonly protected: boolean;
}

interface CoreEnvelopeV2 {
  readonly format: typeof CORE_FORMAT;
  readonly version: typeof CORE_VERSION;
  readonly revision: string;
  readonly cards: readonly Card[];
  readonly activeId: string;
  readonly theme: Theme;
  readonly features: Readonly<{
    people: FeatureReference;
    activity: FeatureReference;
  }>;
}

interface PeopleRevision {
  readonly revision: string;
  readonly contacts: readonly Contact[];
}

interface PeopleEnvelopeV1 {
  readonly version: typeof FEATURE_VERSION;
  readonly feature: "people";
  readonly revisions: readonly PeopleRevision[];
}

interface ActivityRevision {
  readonly revision: string;
  readonly activity: readonly ActivityItem[];
}

interface ActivityEnvelopeV1 {
  readonly version: typeof FEATURE_VERSION;
  readonly feature: "activity";
  readonly revisions: readonly ActivityRevision[];
}

type DecodedEnvelope<Value> =
  | { readonly status: "absent" }
  | { readonly status: "valid"; readonly value: Value }
  | { readonly status: "invalid" }
  | { readonly status: "unsupported" }
  | { readonly status: "unavailable" };

interface EnvelopeRead<Value> {
  readonly envelope: DecodedEnvelope<Value>;
  /** Undefined means the key could not be read; null means it was read and is absent. */
  readonly raw: string | null | undefined;
}

type CoreDocument =
  | { readonly status: "absent" }
  | { readonly status: "invalid" }
  | { readonly status: "unsupported" }
  | { readonly status: "legacy"; readonly state: WalletState }
  | { readonly status: "split"; readonly envelope: CoreEnvelopeV2 };

type StorageReader = Pick<Storage, "getItem">;
type MigrationStorage = StorageReader & Partial<Pick<Storage, "setItem">>;
type StorageWriter = Pick<Storage, "setItem"> & Partial<Pick<Storage, "getItem">>;

export type WalletSaveResult =
  | {
      readonly ok: true;
      readonly issues?: readonly FeatureStorageIssue[];
      readonly unavailableFeatures?: readonly FeatureStorageNamespace[];
    }
  | { readonly ok: false; readonly reason: "invalid" | "unavailable" };

export interface WalletSaveOptions {
  /** Preserve load-time fallbacks even if the backing key becomes readable before this save. */
  readonly preserveFeatures?: readonly FeatureStorageNamespace[];
}

export type WalletStorageCapacity =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly namespace: "core" | "aggregate" | FeatureStorageNamespace;
    };

interface FeaturePlan {
  readonly reference: FeatureReference;
  readonly serialized: string | null;
  /** Safe post-commit compaction; failure leaves the committed revision readable. */
  readonly cleanupSerialized?: string;
  readonly issue?: FeatureStorageIssue;
}

const emptyReference = (): FeatureReference => ({ revision: null, protected: false });

const exactKeys = (value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};

const utf8Bytes = (value: string): number => new TextEncoder().encode(value).byteLength;

const withinUtf8Budget = (value: string, maxBytes: number): boolean =>
  value.length <= maxBytes && utf8Bytes(value) <= maxBytes;

const withinAggregateBudget = (values: readonly (string | null | undefined)[]): boolean => {
  let total = 0;
  for (const value of values) {
    // Undefined means an opaque key could not be read. Preservation wins; the actual write still
    // provides the synchronous quota check without guessing at or replacing those bytes.
    if (value === null || value === undefined) continue;
    total += utf8Bytes(value);
    if (total > MAX_COMMITTED_STORAGE_BYTES) return false;
  }
  return true;
};

const exactAggregateBytes = (values: readonly (string | null | undefined)[]): number | null => {
  let total = 0;
  for (const value of values) {
    if (value === undefined) return null;
    if (value !== null) total += utf8Bytes(value);
  }
  return total;
};

const parseStored = (
  raw: string,
  maxBytes: number,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false } => {
  if (!withinUtf8Budget(raw, maxBytes)) return { ok: false };
  try {
    const value: unknown = JSON.parse(raw);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
};

const serialize = (value: unknown, maxBytes: number): string | null => {
  try {
    const serialized = JSON.stringify(value);
    return withinUtf8Budget(serialized, maxBytes) ? serialized : null;
  } catch {
    return null;
  }
};

const isRevision = (value: unknown): value is string =>
  typeof value === "string" && REVISION.test(value);

const decodeFeatureReference = (value: unknown): FeatureReference | null => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["revision", "protected"]) ||
    (value.revision !== null && !isRevision(value.revision)) ||
    typeof value.protected !== "boolean"
  ) {
    return null;
  }
  return { revision: value.revision, protected: value.protected };
};

const decodeCoreEnvelope = (
  value: unknown,
):
  | { readonly ok: true; readonly envelope: CoreEnvelopeV2 }
  | { readonly ok: false; readonly reason: "invalid" | "unsupported" } => {
  if (!isRecord(value)) return { ok: false, reason: "invalid" };
  if (value.format !== CORE_FORMAT) return { ok: false, reason: "invalid" };
  if (typeof value.version !== "number" || !Number.isInteger(value.version)) {
    return { ok: false, reason: "invalid" };
  }
  if (value.version !== CORE_VERSION) return { ok: false, reason: "unsupported" };
  if (
    !exactKeys(value, [
      "format",
      "version",
      "revision",
      "cards",
      "activeId",
      "theme",
      "features",
    ]) ||
    !isRecord(value.features) ||
    !exactKeys(value.features, ["people", "activity"])
  ) {
    return { ok: false, reason: "invalid" };
  }
  const cards = decodeCards(value.cards);
  const people = decodeFeatureReference(value.features.people);
  const activity = decodeFeatureReference(value.features.activity);
  const expectedRevision =
    cards === null || typeof value.activeId !== "string" || !isTheme(value.theme)
      ? null
      : revisionFor(
          "core",
          { cards, activeId: value.activeId, theme: value.theme },
          MAX_CORE_STORAGE_BYTES,
        );
  if (
    cards === null ||
    people === null ||
    activity === null ||
    !isRevision(value.revision) ||
    value.revision !== expectedRevision ||
    typeof value.activeId !== "string" ||
    (cards.length === 0 ? value.activeId !== "" : !cards.some(({ id }) => id === value.activeId)) ||
    !isTheme(value.theme)
  ) {
    return { ok: false, reason: "invalid" };
  }
  return {
    ok: true,
    envelope: {
      format: CORE_FORMAT,
      version: CORE_VERSION,
      revision: value.revision,
      cards,
      activeId: value.activeId,
      theme: value.theme,
      features: { people, activity },
    },
  };
};

const decodeCoreDocument = (raw: string | null): CoreDocument => {
  if (raw === null) return { status: "absent" };
  const parsed = parseStored(raw, MAX_LEGACY_STORAGE_BYTES);
  if (!parsed.ok) return { status: "invalid" };
  if (isRecord(parsed.value) && parsed.value.format === CORE_FORMAT) {
    if (!withinUtf8Budget(raw, MAX_CORE_STORAGE_BYTES)) return { status: "invalid" };
    const decoded = decodeCoreEnvelope(parsed.value);
    return decoded.ok
      ? { status: "split", envelope: decoded.envelope }
      : { status: decoded.reason };
  }
  const legacy = decodeWalletSnapshot(parsed.value);
  return legacy.ok ? { status: "legacy", state: legacy.state } : { status: legacy.reason };
};

const versionFailure = (value: Readonly<Record<string, unknown>>): "invalid" | "unsupported" =>
  typeof value.version === "number" &&
  Number.isInteger(value.version) &&
  value.version !== FEATURE_VERSION
    ? "unsupported"
    : "invalid";

const decodePeopleEnvelope = (raw: string | null): DecodedEnvelope<PeopleEnvelopeV1> => {
  if (raw === null) return { status: "absent" };
  const parsed = parseStored(raw, MAX_PEOPLE_STORAGE_BYTES);
  if (!parsed.ok || !isRecord(parsed.value)) return { status: "invalid" };
  if (parsed.value.version !== FEATURE_VERSION) {
    return { status: versionFailure(parsed.value) };
  }
  if (
    !exactKeys(parsed.value, ["version", "feature", "revisions"]) ||
    parsed.value.feature !== "people" ||
    !Array.isArray(parsed.value.revisions) ||
    parsed.value.revisions.length < 1 ||
    parsed.value.revisions.length > MAX_REVISIONS
  ) {
    return { status: "invalid" };
  }
  const revisions: PeopleRevision[] = [];
  for (const revision of parsed.value.revisions) {
    if (!isRecord(revision) || !exactKeys(revision, ["revision", "contacts"])) {
      return { status: "invalid" };
    }
    const contacts = decodeContacts(revision.contacts);
    if (
      contacts === null ||
      !isRevision(revision.revision) ||
      revision.revision !== peopleRevision(contacts)
    ) {
      return { status: "invalid" };
    }
    revisions.push({ revision: revision.revision, contacts });
  }
  if (new Set(revisions.map(({ revision }) => revision)).size !== revisions.length) {
    return { status: "invalid" };
  }
  return { status: "valid", value: { version: FEATURE_VERSION, feature: "people", revisions } };
};

const decodeActivityEnvelope = (raw: string | null): DecodedEnvelope<ActivityEnvelopeV1> => {
  if (raw === null) return { status: "absent" };
  const parsed = parseStored(raw, MAX_ACTIVITY_STORAGE_BYTES);
  if (!parsed.ok || !isRecord(parsed.value)) return { status: "invalid" };
  if (parsed.value.version !== FEATURE_VERSION) {
    return { status: versionFailure(parsed.value) };
  }
  if (
    !exactKeys(parsed.value, ["version", "feature", "revisions"]) ||
    parsed.value.feature !== "activity" ||
    !Array.isArray(parsed.value.revisions) ||
    parsed.value.revisions.length < 1 ||
    parsed.value.revisions.length > MAX_REVISIONS
  ) {
    return { status: "invalid" };
  }
  const revisions: ActivityRevision[] = [];
  for (const revision of parsed.value.revisions) {
    if (!isRecord(revision) || !exactKeys(revision, ["revision", "activity"])) {
      return { status: "invalid" };
    }
    const activity = decodeActivity(revision.activity);
    if (
      activity === null ||
      !isRevision(revision.revision) ||
      revision.revision !== activityRevision(activity)
    ) {
      return { status: "invalid" };
    }
    revisions.push({ revision: revision.revision, activity });
  }
  if (new Set(revisions.map(({ revision }) => revision)).size !== revisions.length) {
    return { status: "invalid" };
  }
  return {
    status: "valid",
    value: { version: FEATURE_VERSION, feature: "activity", revisions },
  };
};

const readEnvelopeWithRaw = <Value>(
  storage: StorageReader,
  key: string,
  decode: (raw: string | null) => DecodedEnvelope<Value>,
): EnvelopeRead<Value> => {
  try {
    const raw = storage.getItem(key);
    return { envelope: decode(raw), raw };
  } catch {
    return { envelope: { status: "unavailable" }, raw: undefined };
  }
};

const readPeopleWithRaw = (storage: StorageReader): EnvelopeRead<PeopleEnvelopeV1> =>
  readEnvelopeWithRaw(storage, PEOPLE_STORAGE_KEY, decodePeopleEnvelope);

const readActivityWithRaw = (storage: StorageReader): EnvelopeRead<ActivityEnvelopeV1> =>
  readEnvelopeWithRaw(storage, ACTIVITY_STORAGE_KEY, decodeActivityEnvelope);

const hash64 = (value: string, offset: bigint): string => {
  let hash = offset;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 1_099_511_628_211n);
  }
  return hash.toString(16).padStart(16, "0");
};

const revisionFor = (namespace: string, value: unknown, maxBytes: number): string | null => {
  const canonical = serialize(value, maxBytes);
  if (canonical === null) return null;
  const scoped = `${namespace}:${canonical}`;
  return `state-${hash64(scoped, 14_695_981_039_346_656_037n)}${hash64(
    scoped,
    7_809_847_782_469_553_703n,
  )}`;
};

const coreValue = (
  state: WalletState,
): Omit<CoreEnvelopeV2, "format" | "version" | "features"> => ({
  revision:
    revisionFor(
      "core",
      { cards: state.cards, activeId: state.activeId, theme: state.theme },
      MAX_CORE_STORAGE_BYTES,
    ) ?? "",
  cards: state.cards,
  activeId: state.activeId,
  theme: state.theme,
});

const coreEnvelope = (
  state: WalletState,
  features: CoreEnvelopeV2["features"],
): CoreEnvelopeV2 | null => {
  const core = coreValue(state);
  if (!isRevision(core.revision)) return null;
  return { format: CORE_FORMAT, version: CORE_VERSION, ...core, features };
};

const peopleRevision = (contacts: readonly Contact[]): string | null =>
  revisionFor("people", contacts, MAX_PEOPLE_STORAGE_BYTES);

const activityRevision = (activity: readonly ActivityItem[]): string | null =>
  revisionFor("activity", activity, MAX_ACTIVITY_STORAGE_BYTES);

const stagedPeople = (
  existing: DecodedEnvelope<PeopleEnvelopeV1>,
  prior: FeatureReference,
  revision: string,
  contacts: readonly Contact[],
): PeopleEnvelopeV1 => {
  const previous =
    existing.status === "valid" && prior.revision !== null
      ? existing.value.revisions.find((candidate) => candidate.revision === prior.revision)
      : undefined;
  const next = { revision, contacts };
  return {
    version: FEATURE_VERSION,
    feature: "people",
    revisions: previous === undefined || previous.revision === revision ? [next] : [previous, next],
  };
};

const stagedActivity = (
  existing: DecodedEnvelope<ActivityEnvelopeV1>,
  prior: FeatureReference,
  revision: string,
  activity: readonly ActivityItem[],
): ActivityEnvelopeV1 => {
  const previous =
    existing.status === "valid" && prior.revision !== null
      ? existing.value.revisions.find((candidate) => candidate.revision === prior.revision)
      : undefined;
  const next = { revision, activity };
  return {
    version: FEATURE_VERSION,
    feature: "activity",
    revisions: previous === undefined || previous.revision === revision ? [next] : [previous, next],
  };
};

const compactedPeople = (revision: string, contacts: readonly Contact[]): PeopleEnvelopeV1 => ({
  version: FEATURE_VERSION,
  feature: "people",
  revisions: [{ revision, contacts }],
});

const compactedActivity = (
  revision: string,
  activity: readonly ActivityItem[],
): ActivityEnvelopeV1 => ({
  version: FEATURE_VERSION,
  feature: "activity",
  revisions: [{ revision, activity }],
});

const CAPACITY_REVISION_A = `state-${"0".repeat(32)}`;
const CAPACITY_REVISION_B = `state-${"1".repeat(32)}`;

/** Pure preflight for user-driven state changes; normal persistence remains the final authority. */
export const walletStorageCapacityForChange = (
  current: WalletState,
  next: WalletState,
): WalletStorageCapacity => {
  const validated = decodeWalletSnapshot(walletSnapshot(next));
  if (!validated.ok) return { ok: false, namespace: "core" };
  const currentValidated = decodeWalletSnapshot(walletSnapshot(current));

  const core = {
    format: CORE_FORMAT,
    version: CORE_VERSION,
    revision: CAPACITY_REVISION_A,
    cards: validated.state.cards,
    activeId: validated.state.activeId,
    theme: validated.state.theme,
    features: { people: emptyReference(), activity: emptyReference() },
  } satisfies CoreEnvelopeV2;
  const serializedCore = serialize(core, MAX_CORE_STORAGE_BYTES);
  if (serializedCore === null) {
    return { ok: false, namespace: "core" };
  }

  const people = {
    version: FEATURE_VERSION,
    feature: "people",
    revisions:
      current.contacts === next.contacts
        ? [{ revision: CAPACITY_REVISION_A, contacts: validated.state.contacts }]
        : [
            { revision: CAPACITY_REVISION_A, contacts: current.contacts },
            { revision: CAPACITY_REVISION_B, contacts: validated.state.contacts },
          ],
  } satisfies PeopleEnvelopeV1;
  const serializedPeople = serialize(people, MAX_PEOPLE_STORAGE_BYTES);
  if (serializedPeople === null) {
    return { ok: false, namespace: "people" };
  }

  const activity = {
    version: FEATURE_VERSION,
    feature: "activity",
    revisions:
      current.activity === next.activity
        ? [{ revision: CAPACITY_REVISION_A, activity: validated.state.activity }]
        : [
            { revision: CAPACITY_REVISION_A, activity: current.activity },
            { revision: CAPACITY_REVISION_B, activity: validated.state.activity },
          ],
  } satisfies ActivityEnvelopeV1;
  const serializedActivity = serialize(activity, MAX_ACTIVITY_STORAGE_BYTES);
  if (serializedActivity === null) return { ok: false, namespace: "activity" };
  const committedPeople = serialize(
    compactedPeople(CAPACITY_REVISION_B, validated.state.contacts),
    MAX_PEOPLE_STORAGE_BYTES,
  );
  const committedActivity = serialize(
    compactedActivity(CAPACITY_REVISION_B, validated.state.activity),
    MAX_ACTIVITY_STORAGE_BYTES,
  );
  if (committedPeople === null) return { ok: false, namespace: "people" };
  if (committedActivity === null) return { ok: false, namespace: "activity" };
  const committed = [serializedCore, committedPeople, committedActivity] as const;
  if (!withinAggregateBudget(committed)) {
    return { ok: false, namespace: "aggregate" };
  }
  if (withinAggregateBudget([serializedCore, serializedPeople, serializedActivity])) {
    return { ok: true };
  }
  if (!currentValidated.ok) return { ok: false, namespace: "aggregate" };
  const currentCore = serialize(
    {
      format: CORE_FORMAT,
      version: CORE_VERSION,
      revision: CAPACITY_REVISION_A,
      cards: currentValidated.state.cards,
      activeId: currentValidated.state.activeId,
      theme: currentValidated.state.theme,
      features: { people: emptyReference(), activity: emptyReference() },
    } satisfies CoreEnvelopeV2,
    MAX_CORE_STORAGE_BYTES,
  );
  const currentPeople = serialize(
    compactedPeople(CAPACITY_REVISION_A, currentValidated.state.contacts),
    MAX_PEOPLE_STORAGE_BYTES,
  );
  const currentActivity = serialize(
    compactedActivity(CAPACITY_REVISION_A, currentValidated.state.activity),
    MAX_ACTIVITY_STORAGE_BYTES,
  );
  const currentBytes = exactAggregateBytes([currentCore, currentPeople, currentActivity]);
  const committedBytes = exactAggregateBytes(committed);
  return currentBytes !== null && committedBytes !== null && committedBytes < currentBytes
    ? { ok: true }
    : { ok: false, namespace: "aggregate" };
};

const issue = (
  feature: FeatureStorageNamespace,
  reason: FeatureStorageIssue["reason"],
): FeatureStorageIssue => ({ feature, reason });

const issueForEnvelope = (
  feature: FeatureStorageNamespace,
  status: DecodedEnvelope<unknown>["status"],
): FeatureStorageIssue | undefined => {
  if (status === "invalid" || status === "unsupported" || status === "unavailable") {
    return issue(feature, status);
  }
  return undefined;
};

const planPeople = (
  existing: DecodedEnvelope<PeopleEnvelopeV1>,
  prior: FeatureReference,
  contacts: readonly Contact[],
  mayReplaceUnknown: boolean,
): FeaturePlan | null => {
  const envelopeIssue = issueForEnvelope("people", existing.status);
  if (envelopeIssue !== undefined && !mayReplaceUnknown) {
    const transientKnownRevision =
      existing.status === "unavailable" && prior.revision !== null && !prior.protected;
    return {
      reference: transientKnownRevision ? prior : { ...prior, protected: true },
      serialized: null,
      issue: envelopeIssue,
    };
  }
  if (!mayReplaceUnknown && prior.protected) {
    return {
      reference: prior,
      serialized: null,
      issue: issue("people", "protected"),
    };
  }
  const referenced =
    existing.status === "valid" && prior.revision !== null
      ? existing.value.revisions.some((candidate) => candidate.revision === prior.revision)
      : false;
  if (!mayReplaceUnknown && prior.revision !== null && !referenced) {
    return {
      reference: { ...prior, protected: true },
      serialized: null,
      issue: issue("people", "missing-revision"),
    };
  }
  if (!mayReplaceUnknown && prior.revision === null && existing.status === "valid") {
    return {
      reference: { revision: null, protected: true },
      serialized: null,
      issue: issue("people", "protected"),
    };
  }
  const usable = existing.status === "valid" ? existing : ({ status: "absent" } as const);
  const revision = peopleRevision(contacts);
  if (revision === null) return null;
  const alreadyStored =
    usable.status === "valid" &&
    usable.value.revisions.some((candidate) => candidate.revision === revision);
  const serialized = alreadyStored
    ? null
    : serialize(stagedPeople(usable, prior, revision, contacts), MAX_PEOPLE_STORAGE_BYTES);
  if (!alreadyStored && serialized === null) return null;
  const compacted = serialize(compactedPeople(revision, contacts), MAX_PEOPLE_STORAGE_BYTES);
  if (compacted === null) return null;
  const needsCleanup =
    (serialized !== null && serialized !== compacted) ||
    (alreadyStored && usable.status === "valid" && usable.value.revisions.length > 1);
  return {
    reference: { revision, protected: false },
    serialized,
    ...(needsCleanup ? { cleanupSerialized: compacted } : {}),
  };
};

const planActivity = (
  existing: DecodedEnvelope<ActivityEnvelopeV1>,
  prior: FeatureReference,
  activity: readonly ActivityItem[],
  mayReplaceUnknown: boolean,
): FeaturePlan | null => {
  const envelopeIssue = issueForEnvelope("activity", existing.status);
  if (envelopeIssue !== undefined && !mayReplaceUnknown) {
    const transientKnownRevision =
      existing.status === "unavailable" && prior.revision !== null && !prior.protected;
    return {
      reference: transientKnownRevision ? prior : { ...prior, protected: true },
      serialized: null,
      issue: envelopeIssue,
    };
  }
  if (!mayReplaceUnknown && prior.protected) {
    return {
      reference: prior,
      serialized: null,
      issue: issue("activity", "protected"),
    };
  }
  const referenced =
    existing.status === "valid" && prior.revision !== null
      ? existing.value.revisions.some((candidate) => candidate.revision === prior.revision)
      : false;
  if (!mayReplaceUnknown && prior.revision !== null && !referenced) {
    return {
      reference: { ...prior, protected: true },
      serialized: null,
      issue: issue("activity", "missing-revision"),
    };
  }
  if (!mayReplaceUnknown && prior.revision === null && existing.status === "valid") {
    return {
      reference: { revision: null, protected: true },
      serialized: null,
      issue: issue("activity", "protected"),
    };
  }
  const usable = existing.status === "valid" ? existing : ({ status: "absent" } as const);
  const revision = activityRevision(activity);
  if (revision === null) return null;
  const alreadyStored =
    usable.status === "valid" &&
    usable.value.revisions.some((candidate) => candidate.revision === revision);
  const serialized = alreadyStored
    ? null
    : serialize(stagedActivity(usable, prior, revision, activity), MAX_ACTIVITY_STORAGE_BYTES);
  if (!alreadyStored && serialized === null) return null;
  const compacted = serialize(compactedActivity(revision, activity), MAX_ACTIVITY_STORAGE_BYTES);
  if (compacted === null) return null;
  const needsCleanup =
    (serialized !== null && serialized !== compacted) ||
    (alreadyStored && usable.status === "valid" && usable.value.revisions.length > 1);
  return {
    reference: { revision, protected: false },
    serialized,
    ...(needsCleanup ? { cleanupSerialized: compacted } : {}),
  };
};

const successful = (
  state: WalletState,
  issues: readonly FeatureStorageIssue[],
  unavailableFeatures: readonly FeatureStorageNamespace[] = [],
): StorageResult => {
  if (issues.length === 0 && unavailableFeatures.length === 0) return { ok: true, state };
  return {
    ok: true,
    state,
    ...(issues.length === 0 ? {} : { issues }),
    ...(unavailableFeatures.length === 0 ? {} : { unavailableFeatures }),
  };
};

const featureValue = <Value>(
  feature: FeatureStorageNamespace,
  reference: FeatureReference,
  envelope: DecodedEnvelope<{ readonly revisions: readonly Value[] }>,
  selectRevision: (value: Value) => string,
):
  | { readonly value: Value | null; readonly issue?: undefined }
  | { readonly value: null; readonly issue: FeatureStorageIssue } => {
  if (reference.protected) return { value: null, issue: issue(feature, "protected") };
  if (reference.revision === null) return { value: null };
  const envelopeIssue = issueForEnvelope(feature, envelope.status);
  if (envelopeIssue !== undefined) return { value: null, issue: envelopeIssue };
  if (envelope.status !== "valid") {
    return reference.protected
      ? { value: null, issue: issue(feature, "protected") }
      : { value: null, issue: issue(feature, "missing-revision") };
  }
  const value = envelope.value.revisions.find(
    (candidate) => selectRevision(candidate) === reference.revision,
  );
  return value === undefined
    ? { value: null, issue: issue(feature, "missing-revision") }
    : { value };
};

const migrationPeoplePlan = (
  existing: DecodedEnvelope<PeopleEnvelopeV1>,
  revision: string,
  contacts: readonly Contact[],
): FeaturePlan | null => {
  const envelopeIssue = issueForEnvelope("people", existing.status);
  if (envelopeIssue !== undefined) {
    return { reference: emptyReference(), serialized: null, issue: envelopeIssue };
  }
  if (existing.status === "valid") {
    if (existing.value.revisions.some((candidate) => candidate.revision === revision)) {
      return { reference: { revision, protected: false }, serialized: null };
    }
    if (existing.value.revisions.length >= MAX_REVISIONS) {
      return {
        reference: emptyReference(),
        serialized: null,
        issue: issue("people", "protected"),
      };
    }
    const serialized = serialize(
      { ...existing.value, revisions: [...existing.value.revisions, { revision, contacts }] },
      MAX_PEOPLE_STORAGE_BYTES,
    );
    return serialized === null ? null : { reference: { revision, protected: false }, serialized };
  }
  const serialized = serialize(
    {
      version: FEATURE_VERSION,
      feature: "people",
      revisions: [{ revision, contacts }],
    } satisfies PeopleEnvelopeV1,
    MAX_PEOPLE_STORAGE_BYTES,
  );
  return serialized === null ? null : { reference: { revision, protected: false }, serialized };
};

const migrationActivityPlan = (
  existing: DecodedEnvelope<ActivityEnvelopeV1>,
  revision: string,
  activity: readonly ActivityItem[],
): FeaturePlan | null => {
  const envelopeIssue = issueForEnvelope("activity", existing.status);
  if (envelopeIssue !== undefined) {
    return { reference: emptyReference(), serialized: null, issue: envelopeIssue };
  }
  if (existing.status === "valid") {
    if (existing.value.revisions.some((candidate) => candidate.revision === revision)) {
      return { reference: { revision, protected: false }, serialized: null };
    }
    if (existing.value.revisions.length >= MAX_REVISIONS) {
      return {
        reference: emptyReference(),
        serialized: null,
        issue: issue("activity", "protected"),
      };
    }
    const serialized = serialize(
      { ...existing.value, revisions: [...existing.value.revisions, { revision, activity }] },
      MAX_ACTIVITY_STORAGE_BYTES,
    );
    return serialized === null ? null : { reference: { revision, protected: false }, serialized };
  }
  const serialized = serialize(
    {
      version: FEATURE_VERSION,
      feature: "activity",
      revisions: [{ revision, activity }],
    } satisfies ActivityEnvelopeV1,
    MAX_ACTIVITY_STORAGE_BYTES,
  );
  return serialized === null ? null : { reference: { revision, protected: false }, serialized };
};

const migrateLegacy = (
  state: WalletState,
  legacyRaw: string,
  storage: MigrationStorage,
  peopleRead: EnvelopeRead<PeopleEnvelopeV1>,
  activityRead: EnvelopeRead<ActivityEnvelopeV1>,
): readonly FeatureStorageIssue[] => {
  const peopleRef = peopleRevision(state.contacts);
  const activityRef = activityRevision(state.activity);
  if (peopleRef === null || activityRef === null) return [];
  const peoplePlan = migrationPeoplePlan(peopleRead.envelope, peopleRef, state.contacts);
  const activityPlan = migrationActivityPlan(activityRead.envelope, activityRef, state.activity);
  if (peoplePlan === null || activityPlan === null) return [];
  const issues = [peoplePlan.issue, activityPlan.issue].filter(
    (value): value is FeatureStorageIssue => value !== undefined,
  );
  if (storage.setItem === undefined || issues.length > 0) return issues;
  const core = coreEnvelope(state, {
    people: peoplePlan.reference,
    activity: activityPlan.reference,
  });
  if (core === null) return [];
  const serializedCore = serialize(core, MAX_CORE_STORAGE_BYTES);
  if (serializedCore === null) return [];
  const plannedPeople = peoplePlan.serialized ?? peopleRead.raw;
  const plannedActivity = activityPlan.serialized ?? activityRead.raw;
  if (
    !withinAggregateBudget([serializedCore, plannedPeople, plannedActivity]) ||
    !withinAggregateBudget([legacyRaw, plannedPeople, plannedActivity])
  ) {
    return issues;
  }
  try {
    if (peoplePlan.serialized !== null) storage.setItem(PEOPLE_STORAGE_KEY, peoplePlan.serialized);
    if (activityPlan.serialized !== null) {
      storage.setItem(ACTIVITY_STORAGE_KEY, activityPlan.serialized);
    }
    storage.setItem(WALLET_STORAGE_KEY, serializedCore);
  } catch {
    // Staged feature revisions are inert while the aggregate legacy document remains at core.
  }
  return issues;
};

export const loadPersistedWalletState = (
  storage: MigrationStorage = localStorage,
): StorageResult => {
  const fallback = createInitialWalletState();
  let raw: string | null;
  try {
    raw = storage.getItem(WALLET_STORAGE_KEY);
  } catch {
    return { ok: false, state: fallback, reason: "unavailable" };
  }
  const core = decodeCoreDocument(raw);
  if (core.status === "absent") return { ok: true, state: fallback };
  if (core.status === "invalid" || core.status === "unsupported") {
    return { ok: false, state: fallback, reason: core.status };
  }

  const peopleRead = readPeopleWithRaw(storage);
  const activityRead = readActivityWithRaw(storage);
  if (core.status === "legacy") {
    if (raw === null) return { ok: false, state: fallback, reason: "invalid" };
    const issues = migrateLegacy(core.state, raw, storage, peopleRead, activityRead);
    return successful(core.state, issues);
  }

  const peopleEnvelope = peopleRead.envelope;
  const activityEnvelope = activityRead.envelope;

  const people = featureValue(
    "people",
    core.envelope.features.people,
    peopleEnvelope,
    ({ revision }) => revision,
  );
  const activity = featureValue(
    "activity",
    core.envelope.features.activity,
    activityEnvelope,
    ({ revision }) => revision,
  );
  const issues = [people.issue, activity.issue].filter(
    (value): value is FeatureStorageIssue => value !== undefined,
  );
  return successful(
    {
      cards: core.envelope.cards,
      contacts: people.value?.contacts ?? [],
      activeId: core.envelope.activeId,
      theme: core.envelope.theme,
      activity: activity.value?.activity ?? [],
    },
    issues,
    [...new Set(issues.map(({ feature }) => feature))],
  );
};

export const walletPreferenceInitialization = (
  storage: StorageReader = localStorage,
): "new-install" | "legacy-v1" => {
  try {
    return decodeCoreDocument(storage.getItem(WALLET_STORAGE_KEY)).status === "legacy"
      ? "legacy-v1"
      : "new-install";
  } catch {
    return "new-install";
  }
};

const legacySave = (
  state: WalletState,
  storage: StorageWriter,
  issues: readonly FeatureStorageIssue[],
): WalletSaveResult => {
  const serialized = serialize(walletSnapshot(state), MAX_LEGACY_STORAGE_BYTES);
  if (serialized === null || !withinAggregateBudget([serialized])) {
    return { ok: false, reason: "invalid" };
  }
  try {
    storage.setItem(WALLET_STORAGE_KEY, serialized);
    return issues.length === 0 ? { ok: true } : { ok: true, issues };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
};

export const savePersistedWalletState = (
  state: WalletState,
  storage: StorageWriter = localStorage,
  options: WalletSaveOptions = {},
): WalletSaveResult => {
  const validated = decodeWalletSnapshot(walletSnapshot(state));
  if (!validated.ok) return { ok: false, reason: "invalid" };
  if (storage.getItem === undefined) return { ok: false, reason: "unavailable" };

  let core: CoreDocument;
  let rawCore: string | null;
  try {
    rawCore = storage.getItem(WALLET_STORAGE_KEY);
    core = decodeCoreDocument(rawCore);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (core.status === "invalid" || core.status === "unsupported") {
    return { ok: false, reason: "invalid" };
  }

  const reader = { getItem: storage.getItem.bind(storage) };
  const peopleRead = readPeopleWithRaw(reader);
  const activityRead = readActivityWithRaw(reader);
  const peopleEnvelope = peopleRead.envelope;
  const activityEnvelope = activityRead.envelope;

  if (core.status === "legacy") {
    const peopleRef = peopleRevision(validated.state.contacts);
    const activityRef = activityRevision(validated.state.activity);
    if (peopleRef === null || activityRef === null) return { ok: false, reason: "invalid" };
    const peoplePlan = migrationPeoplePlan(peopleEnvelope, peopleRef, validated.state.contacts);
    const activityPlan = migrationActivityPlan(
      activityEnvelope,
      activityRef,
      validated.state.activity,
    );
    if (peoplePlan === null || activityPlan === null) return { ok: false, reason: "invalid" };
    const issues = [peoplePlan.issue, activityPlan.issue].filter(
      (value): value is FeatureStorageIssue => value !== undefined,
    );
    if (issues.length > 0) {
      // Reserved optional bytes may belong to another app version. Keep aggregate v1 as the sole
      // authority until those keys are understood or explicit reset authorizes replacement.
      return legacySave(validated.state, storage, issues);
    }
    const nextCore = coreEnvelope(validated.state, {
      people: peoplePlan.reference,
      activity: activityPlan.reference,
    });
    const serializedCore = nextCore && serialize(nextCore, MAX_CORE_STORAGE_BYTES);
    if (serializedCore === null) return { ok: false, reason: "invalid" };
    const plannedPeople = peoplePlan.serialized ?? peopleRead.raw;
    const plannedActivity = activityPlan.serialized ?? activityRead.raw;
    if (
      !withinAggregateBudget([serializedCore, plannedPeople, plannedActivity]) ||
      !withinAggregateBudget([rawCore, plannedPeople, plannedActivity])
    ) {
      // Migration temporarily retains the aggregate V1 commit marker. If staging would cross the
      // budget, keep the still-valid legacy document authoritative instead of risking data loss.
      return legacySave(validated.state, storage, issues);
    }
    try {
      if (peoplePlan.serialized !== null) {
        storage.setItem(PEOPLE_STORAGE_KEY, peoplePlan.serialized);
      }
      if (activityPlan.serialized !== null) {
        storage.setItem(ACTIVITY_STORAGE_KEY, activityPlan.serialized);
      }
      storage.setItem(WALLET_STORAGE_KEY, serializedCore);
      return { ok: true };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }

  const priorFeatures =
    core.status === "split"
      ? core.envelope.features
      : { people: emptyReference(), activity: emptyReference() };
  const peopleMayReplaceUnknown =
    core.status === "split" &&
    priorFeatures.people.revision === null &&
    !priorFeatures.people.protected;
  const activityMayReplaceUnknown =
    core.status === "split" &&
    priorFeatures.activity.revision === null &&
    !priorFeatures.activity.protected;
  const people: FeaturePlan | null = options.preserveFeatures?.includes("people")
    ? {
        reference: priorFeatures.people,
        serialized: null,
        issue: issue("people", "protected"),
      }
    : planPeople(
        peopleEnvelope,
        priorFeatures.people,
        validated.state.contacts,
        peopleMayReplaceUnknown,
      );
  const activity: FeaturePlan | null = options.preserveFeatures?.includes("activity")
    ? {
        reference: priorFeatures.activity,
        serialized: null,
        issue: issue("activity", "protected"),
      }
    : planActivity(
        activityEnvelope,
        priorFeatures.activity,
        validated.state.activity,
        activityMayReplaceUnknown,
      );
  if (people === null || activity === null) return { ok: false, reason: "invalid" };

  const coreEnvelopeValue = coreEnvelope(validated.state, {
    people: people.reference,
    activity: activity.reference,
  });
  if (coreEnvelopeValue === null) return { ok: false, reason: "invalid" };
  const serializedCore = serialize(coreEnvelopeValue, MAX_CORE_STORAGE_BYTES);
  if (serializedCore === null) return { ok: false, reason: "invalid" };
  const stagedPeople = people.serialized ?? peopleRead.raw;
  const stagedActivity = activity.serialized ?? activityRead.raw;
  const committedValues = [
    serializedCore,
    people.cleanupSerialized ?? stagedPeople,
    activity.cleanupSerialized ?? stagedActivity,
  ] as const;
  if (!withinAggregateBudget(committedValues)) {
    return { ok: false, reason: "invalid" };
  }
  if (!withinAggregateBudget([serializedCore, stagedPeople, stagedActivity])) {
    const currentBytes = exactAggregateBytes([rawCore, peopleRead.raw, activityRead.raw]);
    const committedBytes = exactAggregateBytes(committedValues);
    if (currentBytes === null || committedBytes === null || committedBytes >= currentBytes) {
      return { ok: false, reason: "invalid" };
    }
  }

  try {
    if (people.serialized !== null) storage.setItem(PEOPLE_STORAGE_KEY, people.serialized);
    if (activity.serialized !== null) storage.setItem(ACTIVITY_STORAGE_KEY, activity.serialized);
    storage.setItem(WALLET_STORAGE_KEY, serializedCore);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  try {
    // Core already references the staged revision. Cleanup can be retried after a transient error
    // without weakening the commit or making the previous revision authoritative again.
    if (people.cleanupSerialized !== undefined) {
      storage.setItem(PEOPLE_STORAGE_KEY, people.cleanupSerialized);
    }
    if (activity.cleanupSerialized !== undefined) {
      storage.setItem(ACTIVITY_STORAGE_KEY, activity.cleanupSerialized);
    }
  } catch {
    // The staged envelopes remain valid and readable; the next save retries compaction.
  }
  const issues = [people.issue, activity.issue].filter(
    (value): value is FeatureStorageIssue => value !== undefined,
  );
  return issues.length === 0
    ? { ok: true }
    : {
        ok: true,
        issues,
        unavailableFeatures: [...new Set(issues.map(({ feature }) => feature))],
      };
};

/** Explicit destructive path; automatic saves never replace unknown feature envelopes. */
export const resetPersistedWalletState = (
  storage: StorageWriter = localStorage,
): WalletSaveResult => {
  const state = createInitialWalletState();
  const peopleRef = peopleRevision([]);
  const activityRef = activityRevision([]);
  if (peopleRef === null || activityRef === null) return { ok: false, reason: "invalid" };
  const interimCore = coreEnvelope(state, {
    people: emptyReference(),
    activity: emptyReference(),
  });
  const finalCore = coreEnvelope(state, {
    people: { revision: peopleRef, protected: false },
    activity: { revision: activityRef, protected: false },
  });
  const people: PeopleEnvelopeV1 = {
    version: FEATURE_VERSION,
    feature: "people",
    revisions: [{ revision: peopleRef, contacts: [] }],
  };
  const activity: ActivityEnvelopeV1 = {
    version: FEATURE_VERSION,
    feature: "activity",
    revisions: [{ revision: activityRef, activity: [] }],
  };
  const serializedInterim = interimCore && serialize(interimCore, MAX_CORE_STORAGE_BYTES);
  const serializedFinal = finalCore && serialize(finalCore, MAX_CORE_STORAGE_BYTES);
  const serializedPeople = serialize(people, MAX_PEOPLE_STORAGE_BYTES);
  const serializedActivity = serialize(activity, MAX_ACTIVITY_STORAGE_BYTES);
  if (
    serializedInterim === null ||
    serializedFinal === null ||
    serializedPeople === null ||
    serializedActivity === null
  ) {
    return { ok: false, reason: "invalid" };
  }

  try {
    // Null references are the destructive commit: old optional bytes become unreachable first.
    storage.setItem(WALLET_STORAGE_KEY, serializedInterim);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  try {
    storage.setItem(PEOPLE_STORAGE_KEY, serializedPeople);
    storage.setItem(ACTIVITY_STORAGE_KEY, serializedActivity);
    storage.setItem(WALLET_STORAGE_KEY, serializedFinal);
  } catch {
    // The interim core already commits a complete reset. A later save can finish feature cleanup.
  }
  return { ok: true };
};
