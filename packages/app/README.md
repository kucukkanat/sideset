# @keychain/app

The Keychain wallet UI — a faithful implementation of the `Keychain Wallet.dc.html` design prototype in React 19, served and bundled by Bun (no separate bundler).

```sh
bun run dev    # http://localhost:3000 with HMR
bun run build  # production bundle → dist/
```

## Structure

- `App.tsx` — state orchestrator: screens, sheets, toast, and the shared-element **flip morph** (card ⇄ detail hero) driven by measured rects + double-rAF
- `screens/` — Home (3D coverflow carousel), Contacts (scroll-scaled card wall), Activity, Settings, CardDetail, ContactDetail
- `sheets/` — Share (QR), Create, Proof (Keybase-style verify), Edit, Backup — hosted by `components/Sheet.tsx` with drag-to-close
- `flip.ts` — morph state model; geometry math lives in `@keychain/core`

## Tests

Integration tests render the real component tree into happy-dom and drive it through clicks and input events — no mocks:

```sh
bun run test:integration   # from the repo root
```
