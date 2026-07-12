# @keychain/app

The Keychain wallet UI: a backendless React 19 PWA served, built, and tested with Bun.

```sh
bun run dev    # http://localhost:3000 with HMR
bun run build  # production bundle → dist/
bun run preview # production build served at http://127.0.0.1:4173
```

## Structure

- `App.tsx` — persistent state/actions plus the shared-element **flip morph** (card ⇄ detail hero)
- `routing.ts`, `useHashRouter.ts` — typed hash routes, canonicalization, and browser history
- `storage.ts` — runtime-validated, versioned local state
- `backup.ts` — password-based encrypted export/restore using Web Crypto
- `sharing.ts`, `sharedProfile.ts` — portable public profile links and browser share/clipboard actions
- `accountVerification.ts` — browser-generated Ed25519 keys, signed provider codes, and shared-profile verification
- `screens/` — Home (3D coverflow carousel), Contacts (searchable directory), Activity, Settings, CardDetail, ContactDetail
- Contact management includes persistent search, local profile editing, immutable identity keys, manual provider-proof links, and confirmed single/bulk removal.
- `sheets/` — Share, Create, Edit, contact import, local backup/restore, appearance, and help
- `flip.ts` — morph state model; geometry math lives in `@keychain/core`
- `worker/sw.ts` — versioned app-shell cache for installable, hash-route-safe offline use

The production build cleans `dist/`, bundles React in production mode, copies the web manifest and
install icons, and emits a root-scoped `sw.js`. The development server intentionally skips service
worker registration so cached assets cannot interfere with HMR.

Profile links carry display fields, the identity public key, and only signed account connections.
Import verifies each signed connection locally with Web Crypto before saving it; no server-side
token exchange is involved.

## Tests

Integration tests render the real component tree into happy-dom and drive it through clicks and input events — no mocks:

```sh
bun run test:integration   # from the repo root
```
