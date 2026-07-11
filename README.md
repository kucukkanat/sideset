# Keychain

A card-based identity wallet: each **card** is a separate identity (Everyday, Work, Anon…) carrying Keybase-style **proofs** that publicly link social accounts to it. Implemented from the `Keychain Wallet.dc.html` Claude Design prototype.

## Packages

| Package | What it is |
| --- | --- |
| [`@keychain/core`](packages/core/README.md) | Pure domain logic — cards, proofs, providers, palettes, QR pattern, carousel geometry |
| [`@keychain/app`](packages/app/README.md) | The React app — screens, sheets, carousel and the shared-element flip morph |

## Commands

```sh
bun install
bun run dev               # dev server (Bun serves index.html with HMR)
bun run build             # production bundle → packages/app/dist
bun run test              # unit + integration
bun run test:unit         # @keychain/core only
bun run test:integration  # @keychain/app only (React in happy-dom)
bun run check             # typecheck + lint + tests
```

## Design decisions

- **Bun-native tooling** — no bundler dependency; `bun index.html` serves the app, `bun build` bundles it.
- **React is the only runtime dependency** — the design prototype's logic layer is authored against React semantics (`setState`, refs, lifecycle-driven flip morph), so a 1:1 port minimizes divergence.
- **Logic/UI split** — everything testable without a DOM lives in `@keychain/core` and has 100% unit coverage; the app package is exercised by integration tests that render the real component tree.
