# @keychain/app

The Keychain wallet UI: a backendless React 19 PWA using React Router, served, built, and tested with Bun.

```sh
bun run dev    # http://localhost:3000 with HMR
bun run build  # production bundle → dist/
bun run preview # production build served at http://127.0.0.1:4173
```

## Structure

- `src/app/routing/routes/` — one React Router module per URL pattern, with colocated parameter and search validation
- `src/app/` — composition root, hash-history adapter, shared route contracts, and versioned wallet state
- `src/features/` — vertical slices for activity, backup, cards, contacts, identity, profile sharing,
  settings, tools, and the wallet home
- `src/shared/ui/` — presentation primitives used by multiple features
- `src/shared/lib/` — feature-neutral avatar validation and flip-morph state
- `test/` — mirrors the application boundaries (`app`, `features`, and `infrastructure`)
- `worker/sw.ts` — versioned app-shell cache for installable, hash-route-safe offline use

Imports make the dependency direction explicit: `app → features → shared`. Features may depend on
other features only through an acyclic graph; architecture tests enforce both rules. The
`@app/*`, `@features/*`, and `@shared/*` aliases keep imports stable when files move inside a slice.

Contact management includes persistent search, local profile editing, immutable identity keys,
manual provider-proof links, and confirmed single/bulk removal. The card feature owns the 3D
coverflow presentation and shared-element card ⇄ detail flip morph, while geometry remains pure in
`@keychain/core`.

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
