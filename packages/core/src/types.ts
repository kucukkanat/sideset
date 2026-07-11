export type ProviderId =
  | "twitter"
  | "github"
  | "reddit"
  | "facebook"
  | "slack"
  | "confluence"
  | "email";

export interface Proof {
  readonly provider: ProviderId;
  readonly username: string;
}

/** One of the user's own identities ("cards"). */
export interface Card {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly avatar: string;
  readonly color: number;
  readonly tag: string;
  readonly bio: string;
  readonly proofs: readonly Proof[];
}

/** Somebody the user follows. */
export interface Contact {
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly avatar: string;
  readonly color: number;
  readonly mutuals: number;
  readonly bio: string;
  readonly proofs: readonly Proof[];
  readonly npub: string;
}

export interface Palette {
  readonly grad: string;
  readonly shadow: string;
}

export interface ProviderMeta {
  readonly name: string;
  readonly bg: string;
  readonly fg: string;
  readonly shadow: string;
}
