import { proofUserFor } from "./providers.ts";
import type { Card, ProviderId } from "./types.ts";

export const createCard = (input: {
  readonly id: string;
  readonly name: string;
  readonly avatar: string;
  readonly color: number;
}): Card => {
  const name = input.name.trim();
  return {
    id: input.id,
    name,
    handle: name.toLowerCase().replace(/\s+/g, ""),
    avatar: input.avatar,
    color: input.color,
    tag: "New card",
    bio: "",
    proofs: [],
  };
};

/** Idempotent: a card holds at most one proof per provider. */
export const addProof = (
  cards: readonly Card[],
  cardId: string,
  provider: ProviderId,
): readonly Card[] =>
  cards.map((c) => {
    if (c.id !== cardId || c.proofs.some((p) => p.provider === provider)) return c;
    return { ...c, proofs: [...c.proofs, { provider, username: proofUserFor(c, provider) }] };
  });

export const removeProof = (
  cards: readonly Card[],
  cardId: string,
  provider: ProviderId,
): readonly Card[] =>
  cards.map((c) =>
    c.id === cardId ? { ...c, proofs: c.proofs.filter((p) => p.provider !== provider) } : c,
  );

export const updateCard = (
  cards: readonly Card[],
  cardId: string,
  patch: Partial<Pick<Card, "name" | "bio" | "avatar">>,
): readonly Card[] => cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c));
