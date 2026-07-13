export interface IdentitySnapshot {
  readonly id: string;
  readonly displayName: string;
  readonly handle: string;
  readonly publicKey: string;
  readonly privateKey: string;
}

export interface IdentityReader {
  readonly active: () => IdentitySnapshot | null;
}

export interface RecipientSuggestion {
  readonly id: string;
  readonly displayName: string;
  readonly handle: string;
  readonly avatar: string;
  readonly publicKey: string;
  readonly source: "identity" | "person";
}

export interface RecipientSource {
  readonly search: (query: string) => readonly RecipientSuggestion[];
}

interface ActivityFactBase {
  readonly occurredAt: number;
}

export type ActivityFact =
  | (ActivityFactBase & {
      readonly kind: "identity.activated";
      readonly name: string;
      readonly previousName: string;
    })
  | (ActivityFactBase & {
      readonly kind: "identity.created";
      readonly name: string;
      readonly avatar: string;
    })
  | (ActivityFactBase & {
      readonly kind: "identity.updated";
      readonly name: string;
      readonly avatar: string;
    })
  | (ActivityFactBase & {
      readonly kind: "identity.deleted";
      readonly name: string;
      readonly avatar: string;
    })
  | (ActivityFactBase & {
      readonly kind: "account.connected";
      readonly provider: ProviderId;
      readonly username: string;
      readonly identityName: string;
    })
  | (ActivityFactBase & {
      readonly kind: "account.disconnected";
      readonly provider: ProviderId;
      readonly identityName: string;
    })
  | (ActivityFactBase & {
      readonly kind: "person.added";
      readonly name: string;
      readonly avatar: string;
    })
  | (ActivityFactBase & {
      readonly kind: "person.updated";
      readonly name: string;
      readonly avatar: string;
    })
  | (ActivityFactBase & {
      readonly kind: "people.removed";
      readonly count: number;
      readonly firstName: string;
      readonly firstAvatar: string;
    })
  | (ActivityFactBase & { readonly kind: "backup.prepared" })
  | (ActivityFactBase & { readonly kind: "backup.restored" });

export interface ActivityJournal {
  readonly record: (fact: ActivityFact) => void;
}

export interface CapabilityContracts {
  readonly "activity.journal": ActivityJournal;
  readonly "identity.reader": IdentityReader;
  readonly "people.recipient-source": RecipientSource;
}

export interface CapabilityFallbacks {
  readonly "activity.journal": "drop-fact";
  readonly "identity.reader": "feature-unavailable";
  readonly "people.recipient-source": "manual-input";
}

export type CapabilityId = keyof CapabilityContracts;

export type CapabilityConsumption<Id extends CapabilityId = CapabilityId> =
  | {
      readonly id: Id;
      readonly requirement: "required-core";
    }
  | {
      [Key in Id]: {
        readonly id: Key;
        readonly requirement: "optional";
        readonly fallback: CapabilityFallbacks[Key];
      };
    }[Id];

export interface CapabilityResolver {
  readonly required: <Id extends CapabilityId>(id: Id) => CapabilityContracts[Id];
  readonly optional: <Id extends CapabilityId>(id: Id) => CapabilityContracts[Id] | null;
}

import type { ProviderId } from "@keychain/core";
