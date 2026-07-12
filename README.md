# Sideset

**Every side is yours.** Sideset is a backendless, card-based profile wallet. Each **card**
represents a different part of someone’s life (Everyday, Work, Low-profile…) and can show connected
accounts. It is implemented from the original `Keychain Wallet.dc.html` design prototype as an
installable offline-first PWA.

The established `@keychain/*` package scope and `keychain-*` persistence/protocol identifiers stay
in place for compatibility. The public brand foundation and marketing site use the new Sideset
name without silently breaking existing wallets, backups, or shared links.

## Packages

| Package | What it is |
| --- | --- |
| [`@keychain/core`](packages/core/README.md) | Pure domain logic — cards, account metadata, palettes, and carousel geometry |
| [`@keychain/app`](packages/app/README.md) | React PWA — hash routing, local persistence, encrypted backups, and UI |
| [`@sideset/branding`](packages/branding/README.md) | Brand strategy, production assets, motion, typography, and typed design tokens |
| [`@sideset/site`](packages/site/README.md) | Responsive marketing, privacy, security, and public brand-portal pages |

## Commands

```sh
bun install
bun run dev               # dev server (Bun serves index.html with HMR)
bun run dev:site          # Sideset marketing site
bun run build             # production bundle → packages/app/dist
bun run build:site        # production marketing-site worker → packages/site/dist
bun run preview           # build and serve the production PWA on :4173
bun run preview:site      # serve an already-built marketing site
bun run test              # unit + integration
bun run test:unit         # core + branding + site unit suites
bun run test:integration  # app + branding + site integration suites
bun run check             # typecheck + lint + tests + marketing production build
```

## Design decisions

- **Backendless by design** — public prototype data stays in versioned local storage. Encrypted backup
  files are produced with Web Crypto and can be restored locally.
- **URL-owned navigation** — views, selected records, and open sheets use typed hash routes. Form
  drafts and backup passwords never enter URLs or persistent storage.
- **Honest capability boundaries** — providers beyond GitHub verification, chat, payments,
  biometrics, cloud sync, and remote notifications remain unavailable until their integrations
  exist.
- **Minimal dependencies** — React powers the UI and the zero-dependency `qr` package produces
  standards-compliant profile codes. Bun handles serving, builds, and tests.

## Signed account verification

New account connections use a secp256k1 identity key pair generated in the browser. The private key
is stored as a 64-character hexadecimal value only inside the local card state; it is never included
in a shared profile link. The public key is encoded in the shared profile so another client can
verify the account connection.

The GitHub verification code has the compact form `kc1.<base64url-event>`. Its signed event contains
the canonical message `keychain-proof-v1|<provider>|<username>|<publicKey>|<nonce>`. The code is
published in the user's public GitHub bio, and the app checks both the GitHub profile and the event
signature before saving the connection. When a profile link is imported, each signed account
connection is checked against the shared public key before it is added to contacts.

Legacy mock connections without a signed code are not exported as verified connections. They can be
upgraded by reconnecting the provider. This prototype keeps the private key in local storage for
offline operation, so the device and browser storage must be treated as trusted; use the encrypted
backup flow when moving a card between devices.

## Product language boundary

The eventual identity layer is Nostr-based, but that is an implementation detail. Product UI must
use familiar card, profile, contact, and connected-account language—never protocol names, keys,
relays, or signing jargon. The cryptographic details belong in this developer documentation, not
the product UI.
