# @keychain/core

Pure, dependency-free domain logic for the Keychain identity wallet. Everything here is a pure function over immutable data — no DOM, no React.

## Usage

```ts
import {
  SEED_CARDS,
  SEED_CONTACTS,
  addProof,
  proofsSummary,
  paletteFor,
  cardPlacement,
  searchContacts,
  proofVerificationUrl,
  qrPattern,
  passStrength,
} from "@keychain/core";

// Identity cards and proofs
const cards = addProof(SEED_CARDS, "c3", "twitter");
proofsSummary(cards[0]?.proofs ?? []); // "X · GitHub +2"
searchContacts(SEED_CONTACTS, "github"); // contacts matching local or connected-account fields
proofVerificationUrl({ provider: "github", username: "finnriver" }); // provider profile URL

// Visuals
paletteFor(4).grad;        // card gradient for color slot 4
cardPlacement(1).rotateY;  // -52 — coverflow angle of the right flank card
qrPattern("keychain.me/everyday"); // deterministic 21×21 decorative grid

// Backup password meter: 0 (unusable) … 3 (very strong)
passStrength("CorrectHorse7!"); // 3
```

## Modules

- `cards` — `createCard`, `addProof`, `removeProof`, `updateCard` (immutable transitions)
- `contacts` — `searchContacts`, `updateContact`, `removeContacts` (immutable local contact management)
- `providers` — provider metadata, proof ordering, `proofUserFor`, `proofVerificationUrl`
- `identity` — `proofsSummary`, `friendlyId`, `greetingFor`, `passStrength`
- `palettes` — the six card gradients, `paletteFor`
- `carousel` — coverflow geometry: `cardPlacement`, `signedDistance`, `dragFraction`, `dampDrag`, `wrapIndex`
- `qr` — decorative deterministic QR-look pattern (the app uses a separate standards-compliant encoder)
- `seed` — demo cards and contacts

Run the tests with `bun test packages/core`.
