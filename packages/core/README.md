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

- `src/features/cards/` — immutable card transitions, palettes, and coverflow geometry
- `src/features/contacts/` — immutable local contact search, update, and removal
- `src/features/identity/` — provider metadata, proof helpers, identity labels, and password strength
- `src/features/sharing/` — deterministic decorative QR-look pattern (the app uses a standards-compliant encoder)
- `src/shared/` — dependency-free domain types shared by multiple features
- `src/testing/` — demo fixtures, exported for the prototype and tests

`src/index.ts` remains the only package entry point, so the feature-driven internal layout does not
expose deep imports or change the consumer API.

Run the tests with `bun test packages/core`.
