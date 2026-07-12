import type { Card, IdentityKeyPair, ProviderId } from "../../shared/types.ts";
import { proofUserFor } from "../identity/providers.ts";

export const createCard = (input: {
  readonly id: string;
  readonly name: string;
  readonly username?: string;
  readonly email?: string;
  readonly avatar: string;
  readonly color: number;
  readonly identity: IdentityKeyPair;
}): Card => {
  const name = input.name.trim();
  const username = input.username?.trim() || name.toLowerCase().replace(/\s+/g, "");
  return {
    id: input.id,
    name,
    handle: username,
    username,
    email: input.email?.trim() ?? "",
    avatar: input.avatar,
    color: input.color,
    tag: "New card",
    bio: "",
    proofs: [],
    identity: input.identity,
  };
};

/** Idempotent: a card holds at most one proof per provider. */
export const addProof = (
  cards: readonly Card[],
  cardId: string,
  provider: ProviderId,
): readonly Card[] =>
  cards.map((c) => {
    const proofs = c.proofs ?? [];
    if (c.id !== cardId || proofs.some((p) => p.provider === provider)) return c;
    return { ...c, proofs: [...proofs, { provider, username: proofUserFor(c, provider) }] };
  });

export const removeProof = (
  cards: readonly Card[],
  cardId: string,
  provider: ProviderId,
): readonly Card[] =>
  cards.map((c) =>
    c.id === cardId ? { ...c, proofs: (c.proofs ?? []).filter((p) => p.provider !== provider) } : c,
  );

export const updateCard = (
  cards: readonly Card[],
  cardId: string,
  patch: Partial<Pick<Card, "name" | "username" | "email" | "bio" | "avatar">>,
): readonly Card[] =>
  cards.map((card) =>
    card.id === cardId
      ? { ...card, ...patch, ...(patch.username === undefined ? {} : { handle: patch.username }) }
      : card,
  );

/** Searches public identity metadata only; private keys must never become discoverable UI data. */
export const searchCards = (cards: readonly Card[], query: string): readonly Card[] => {
  const term = query.trim().toLowerCase();
  if (term.length === 0) return cards;
  return cards.filter((card) =>
    [
      card.id,
      card.name,
      card.handle,
      card.username,
      card.email,
      card.avatar,
      card.tag,
      card.bio,
      card.identity?.publicKey,
      ...(card.proofs ?? []).flatMap((proof) => [proof.provider, proof.username]),
    ]
      .filter((value): value is string => value !== undefined)
      .some((value) => value.toLowerCase().includes(term)),
  );
};
