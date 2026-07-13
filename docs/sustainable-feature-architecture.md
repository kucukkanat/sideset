# Sustainable Feature Architecture and UX Policy

**Status:** Adopted decision baseline; incremental migration in progress

**Date:** 2026-07-13

**Scope:** `@keychain/app`, its PWA delivery model, and optional domain code in `@keychain/core`

This document is intentionally normative. `MUST`, `MUST NOT`, and `SHOULD` are the decisions to
lock. An exception requires a short architecture decision record with a measured reason, an owner,
and an exit condition.

## Implementation checkpoint

The policy is intentionally stricter than the current implementation. As of 2026-07-13, the
repository has completed the foundation needed to prevent further feature sprawl:

- typed lightweight manifests, a validated registry, stable route/dock ownership, and an
  append-only identifier ledger;
- independently versioned feature preferences with distinct available/enabled/pinned/ready states,
  focused new-user defaults, legacy migration, unknown-ID preservation, and protected reset
  behavior;
- a host-owned Feature Library, a four-item dock with at most two optional destinations, disabled
  deep-link enablement, loading/error affordances, focus management, and data-retaining disable
  semantics;
- a serialized runtime host with typed activation/disposal, stale-intent cancellation, failure
  isolation, and cleanup on disable, reset, retry, and unmount;
- a real Tools JavaScript boundary, generated feature acquisition graph, transactional offline
  cache acquisition, core-only service-worker install, enabled-feature update prewarming, old/new
  client cache coexistence, and safe exact-match serving of retained assets;
- physically split core, People, and Activity storage with content-addressed revisions,
  feature-first commits, fault isolation, exact preservation of unavailable bytes, a 4 MB committed
  aggregate ceiling, bounded avatar admission, and crash-safe post-commit compaction;
- Bun metafile reports with no-growth ratchets, locked targets, and an owner/expiry exception for
  the current Tools acquisition graph;
- an exhaustive Activity fact contract and Activity-owned projector, so unrelated workflows no
  longer own Activity wording, icons, colors, or retention policy.

This checkpoint is not the definition of done. The remaining locked work is: split optional CSS;
replace the closed route/render switch with runtime contributions and real capability injection;
make backup/restore round-trip opaque retained feature envelopes and add compatibility tombstones;
extract the remaining feature workflows and tests from `App.tsx`; reduce bundle ratchets toward
their targets; and add real-browser offline/update/removability E2E coverage. Until those items land,
the registry is a governed migration seam—not a claim that arbitrary feature removal is already
mechanical.

## Executive decision

Sideset will be a small, stable product kernel surrounded by independently loadable vertical
features. A feature may contribute to a few explicit host surfaces, but it may not reach into other
features or make the application shell understand its implementation.

The product will separately model whether a feature is:

1. **Available** in this build and on this device.
2. **Enabled** by this user.
3. **Pinned** as a dock shortcut.
4. **Ready** to run with its current prerequisites.

Those states solve different problems and MUST NOT be represented by one feature flag. In
particular, hiding a statically imported feature does not reduce bundle size, and lazy-loading a
feature does not make it understandable to users.

The practical success criterion is mechanical:

> Removing an optional feature's runtime directory and its registry entry leaves the shell, routing,
> persistence, backups, tests, and production build valid. Only owned cleanup is allowed: exclusive
> dependency declarations, generated asset/budget entries, and a small compatibility tombstone or
> reserved identifier may also change. Unrelated feature or shell workflows do not.

## Residual scaling risks

The repository now has governed feature boundaries, but the migration deliberately stopped short of
pretending the remaining coupling is solved:

| Current evidence | Consequence |
| --- | --- |
| `packages/app/src/app/App.tsx` is 1,388 lines and still owns many workflows and render branches | Every substantial feature can still put pressure on the same orchestration module until runtime contributions replace those branches |
| Storage is physically split, but its coordinator still knows the current People and Activity codecs | Fault isolation is real; fully mechanical durable-feature removal and opaque backup round-tripping are not yet complete |
| `packages/app/src/app/routing/model.ts` is a closed union and imports the Tools route model | Routing points inward to feature details; removal is not local |
| The dock and Feature Library are registry-driven, while route rendering still has host switches | Navigation scales now; arbitrary runtime UI contribution does not yet |
| Features import concrete files from other features | Acyclic does not mean removable; low-level slices already have many dependants |
| `packages/app/src/styles.css` is 3,072 lines | Feature presentation is always loaded and cannot be deleted mechanically |
| The startup JavaScript closure is 952,966 bytes raw / 308,033 bytes gzip-equivalent | It remains materially above the 200 KiB target despite moving Tools out of startup |
| Tools activation still receives a fail-loud placeholder capability resolver and route-specific UI props | The lifecycle boundary is real, but capability injection and arbitrary runtime contribution are not complete |

The verified production build installs 14 core assets: 2,128,746 bytes raw / 1,433,193 bytes
gzip-equivalent, with no optional output in the shell. Main CSS is 53,559 bytes raw / 10,159 bytes
gzip-equivalent. Tools owns four optional outputs totaling 452,576 bytes raw / 141,198 bytes
gzip-equivalent; its largest nested chunk is 111,538 bytes gzip-equivalent. Every optional output has
an owner, and the 13,023-byte service worker is measured outside the install graph.

The largest startup contributors are not just screens. DiceBear is still pulled through the widely
reused `CardAvatar`, identity and Nostr code cross several feature boundaries, and every non-Tools
screen remains statically reachable from `App.tsx`. The Tools result proves the required sequence:
dependency ownership first, then a literal runtime boundary, then generated delivery ownership.

## Goals and non-goals

### Goals

- Adding a feature has one explicit composition change, not edits across shell switches.
- Optional code, CSS, assets, storage, routes, tests, and dependencies have a clear owner.
- Disabled feature runtimes, CSS, assets, and dependencies do not execute, appear in the primary
  experience, or download on a clean session. Their audited lightweight manifests are startup
  metadata.
- Enabled features remain discoverable without every feature competing for permanent navigation.
- User data survives disablement, downgrade, deprecation, and restore without silent loss.
- Architecture, bundle, accessibility, and removability constraints fail in CI.

### Non-goals

- This is not a third-party plugin system. Features are trusted, statically known source modules.
- This does not require a package per feature. A vertical slice inside `@keychain/app` is the default;
  extract a package only when it has a real independent consumer or release boundary.
- User enablement is not an authorization or security boundary. Sensitive operations still enforce
  capability and permission checks at the point of use.
- Small UI preferences are not features. A feature represents a cohesive user job with its own
  lifecycle, not every button or setting.

## Locked architecture decisions

### 1. Keep the mandatory kernel deliberately small

The kernel MUST contain only:

- bootstrap and update recovery;
- the route host and stable URL handling;
- feature registry and lifecycle host;
- feature preferences and dock policy;
- versioned storage envelope and backup coordinator;
- theme/design tokens and genuinely shared UI primitives;
- loading/error boundaries, toast/announcement services, and platform capability adapters.

The kernel MUST NOT import an optional feature runtime. Optional feature code may only be reached by
a literal dynamic import declared in its lightweight manifest.

Initial product classification:

| Functionality | Class | Default for a new install | Dock policy |
| --- | --- | --- | --- |
| Wallet and card management | Core | Always enabled | Fixed first |
| Settings, appearance, Features, recovery, backup/restore | Core | Always enabled | Fixed last |
| People | Standard optional destination | Enabled | Pinned |
| Tools | Advanced optional destination | Disabled | Unpinned |
| Activity | Optional supporting capability | Enabled | Never docked |
| Card sharing and record detail flows | Core contextual capabilities | Available in their owner | Never docked |

Existing users MUST retain today's visible `[Wallet, People, Tools, Settings]` layout during
migration. Genuinely new users start with `[Wallet, People, Settings]`. This avoids changing an
existing user's mental model while keeping advanced Tools out of a new user's first experience.

Future functionality MUST be classified as one of:

- **Core invariant:** required for a safe, coherent wallet and not user-disableable.
- **Optional destination:** a substantial repeatable job that may be enabled and is dock-eligible.
- **Optional capability:** a cohesive but contextual job exposed through an approved extension slot;
  it is not dock-eligible.
- **Experiment:** available only in an explicit Labs build/section and never silently shipped as a
  disabled placeholder.

### 2. Use one typed feature registry, not scattered flags

Each feature owns a lightweight manifest. The application has exactly one registry that lists the
manifests compiled into that edition. `FeatureId` is derived from that registry; IDs are stable,
lowercase protocol identifiers and MUST never be reused.

A representative contract is:

```ts
interface FeatureManifest<Id extends string> {
  readonly id: Id;
  readonly kind: "core" | "destination" | "capability" | "experiment";
  readonly defaultEnabled: boolean;
  readonly routes: readonly FeatureRouteDefinition[];
  readonly dock?: Readonly<{ label: string; icon: IconToken }>;
  readonly permissions: readonly PlatformCapabilityId[];
  readonly consumes: readonly CapabilityConsumption[];
  readonly provides: readonly CapabilityId[];
  readonly dataVersion?: number;
  readonly maxStoredBytes?: number;
  readonly load: () => Promise<FeatureRuntime>;
}
```

`manifest.ts` MUST NOT import React, feature UI, feature CSS, or a third-party runtime. Its `load`
function uses a literal `import("./runtime.tsx")` so Bun can create a deterministic chunk. The loaded
runtime owns screens, commands, state codecs, migrations, contextual contributions, and lifecycle
cleanup. The build emits a separate generated asset graph for each manifest; that generated output
is not hand-maintained feature metadata.

There will be no generic `isFeatureEnabled("x")` conditions throughout components. The host filters
registry contributions before rendering them, and feature code receives a typed context only after
activation.

### 3. Ban implementation imports between optional features

Production code in `features/<id>` MUST NOT import code from `features/<other-id>`. It may import:

- its own files;
- stable host/feature contracts from the lower-level `contracts` layer;
- feature-neutral code from `shared`;
- the deliberately small public domain kernel from `@keychain/core`.

Cross-feature cooperation uses injected, narrow capabilities. Capability interfaces live in a
lower-level `contracts` layer shared by the host and feature runtimes; they do not live in app
composition or in a providing feature. The host resolves providers. Each `consumes` entry declares
whether its provider is `required-core` or `optional`, plus the typed fallback behavior. An optional
capability must have an explicit unavailable result; no optional feature may require another
optional feature in order to boot. CI compares the declared `consumes`/`provides` graph with runtime
resolution and rejects cycles or undeclared access.

Examples in the current application:

- Tools asks an `IdentityReader` for the active identity instead of importing identity internals.
- A contact source may enhance Tools recipient suggestions, but Tools still works with a manually
  entered public key when People is disabled or removed.
- Clipboard, files, network, and notifications are platform capabilities, not imports from
  profile-sharing.
- Activity consumes passive domain facts through a typed journal port. Card/contact commands do not
  import `createActivity` and do not wait for Activity to handle an event.

Use events only for passive facts. Request/response workflows use explicit typed commands; a generic
event bus would hide coupling and make execution order impossible to reason about.

`@keychain/core` MUST remain a shared kernel, not a dumping ground for optional feature code. A type
or function moves there only after multiple independent consumers need a stable domain contract.

### 4. Allow integration only through named extension slots

A feature cannot insert arbitrary JSX into arbitrary core screens. The host owns a small set of
slots with explicit ordering and cognitive limits:

- dock destination;
- Feature Library entry;
- card/profile overflow action;
- one secondary home section;
- share/export target.

Contributions are data-first descriptors whose action lazy-loads the owning runtime. A new extension
slot requires an architecture decision because every slot becomes long-lived public surface area.
The host may refuse or move contributions to overflow when a surface reaches its UX cap.

Initial caps and ordering are host-owned:

- core actions precede feature actions; feature actions sort by localized label, not self-declared
  priority;
- card/profile screens expose at most three direct actions, with at most five feature actions in the
  overflow before a dedicated categorized Actions route is required;
- share/export shows at most four direct targets before a labelled `More` chooser;
- Home renders at most one optional secondary section, selected explicitly in Features rather than
  rotated or ranked invisibly;
- the Feature Library sorts pinned order first within Enabled, then labels alphabetically; Available
  and Labs sort alphabetically. Search becomes mandatory above 12 available entries, and any group
  above eight entries must be split into stable user-job categories.

### 5. Make routes feature-owned and stable

Each manifest owns lightweight parsing/formatting for its URL prefix; the loaded runtime owns the
screen. Each route also declares a `dockOwner` of `wallet`, `settings`, a dock-eligible feature ID,
or `null`. The shell composes route definitions from the registry and MUST NOT contain a switch over
every feature page or sheet or guess an active dock item for an unknown route.

Initial ownership is explicit: card detail and Activity belong to Wallet; person detail belongs to
People; the Feature Library belongs to Settings; an optional feature's nested routes belong to that
feature; overlays inherit their parent; a genuinely ownerless route highlights no dock item. This
prevents the current behavior where every unrecognized route appears to be Wallet.

The existing rules remain: durable navigation belongs in the URL; form drafts, passwords, and
ephemeral animation state do not. Route prefixes are compatibility identifiers and MUST not be
reused after removal.

Route behavior is fixed:

- **Available and enabled:** load the feature within its Suspense and error boundary.
- **Available but disabled:** show a small host-owned explanation with `Enable and open`; never
  silently enable or redirect.
- **Unavailable or removed:** show `Not available in this version` with a safe return action.
- **Enabled but not ready:** render the feature's actionable setup/empty state.
- **Chunk unavailable offline:** explain that it must be downloaded; leave the feature disabled if
  this happened during enablement.

Every route updates `document.title` and moves focus to/announces its main heading. Lazy loading has
an announced status. An optional feature error boundary offers Retry and Disable without taking down
the wallet shell; a core boundary offers Retry, Reload, Restore, and when appropriate Reset, but can
never offer to disable Wallet or Settings.

### 6. Give every feature an owned, versioned storage key

Do not replace the current monolith with another parsed monolith. Persistence is physically split
so one corrupt or removed feature cannot invalidate Wallet:

```text
keychain.wallet.v1              # versioned core wallet envelope; compatibility key retained
keychain.preferences.v1         # enablement, dock, discovery, and migration marker
keychain.feature.<feature-id>.v1 # one versioned, serialized envelope per durable feature
```

The suffix is a stable storage-protocol identifier; the JSON envelope inside it has an independent
numeric schema version. Feature keys remain opaque strings to the shell. The owning lazily loaded
codec parses, validates, and migrates its key before activation. Because the shell never
parse/stringifies an unavailable feature key, it can preserve its exact serialized value across
core writes, downgrade, backup, and runtime removal.

Each storage adapter declares a numeric maximum serialized size, and the storage host enforces a
numeric aggregate ceiling before writes or restore. Those numbers are committed configuration,
measured against migration fixtures; they cannot be inferred from browser quota at the moment of a
destructive write. An oversized, corrupt, or newer feature key is isolated: Wallet still opens, the
raw value remains exportable/deletable, and only that feature becomes not ready. Core corruption
uses the existing safe fallback/recovery flow.

The current committed wallet ceiling is 4,000,000 UTF-8 bytes, with separate headroom reserved for
preferences and browser bookkeeping. New image uploads are capped at 500,000 source bytes; the
decoder retains the previous 4,000,000-byte compatibility bound so older data can still be opened,
exported, or removed. A normal transaction must fit both its staged and compacted forms. The sole
exception is a monotonic repair of an already-over-budget document: its compacted state must fit the
ceiling and be smaller than the current state, the actual synchronous storage write must succeed
before session state changes, and the feature history is compacted only after the core commit. A
cleanup interruption leaves both referenced revisions readable and is retried on the next save.

The behavior is non-negotiable:

- Disable retains the exact feature key and stops feature background work.
- Unpin changes navigation only.
- Delete feature data is a separate destructive action with feature-specific consequences.
- Restoring feature data does not silently enable the feature.
- Backups record feature ID, storage protocol, inner data version, and the bounded serialized
  envelope, so unavailable feature data can round-trip without the shell interpreting it.
- Removed features leave a small tombstone/migration adapter for at least the documented
  compatibility window, so users can export or delete retained data.
- Migrations are pure, idempotent, fixture-tested functions. They never depend on mounted UI.
- The existing safeguard against older code overwriting a newer core snapshot MUST remain.

Preferences are an independently validated key. The decoder exposes both a normalized effective
view for the current registry and untouched unknown IDs/order for round-tripping; an older edition
must not erase newer enablement or dock choices when it saves a known preference.

The V1 split is a staged commit: derive and write all feature keys, then preferences with
`initializedFrom: "legacy-v1"`, and write the new core envelope last as the commit marker. Any
failure before the last write leaves the legacy snapshot authoritative and makes retry idempotent.
If both core data and preferences are absent, initialize with `initializedFrom: "new-install"`.
If a valid legacy snapshot exists but preferences do not, use the migrated-user defaults. A pinned
legacy Tools entry may temporarily be enabled-but-not-ready until its asset acquisition succeeds;
the shortcut remains visible and presents Retry rather than losing the user's layout.

### 7. Separate available, enabled, pinned, and ready

The state model is:

| State | Owned by | Meaning |
| --- | --- | --- |
| Available | Build registry + device capability | Code can be loaded in this edition |
| Enabled | Versioned user preference | User wants the feature present |
| Pinned | Ordered dock preference | Enabled destination has a shortcut |
| Ready | Runtime prerequisite check | Identity, permission, network, or cached assets are usable |

Availability is stable for the lifetime of a build: registry inclusion plus hard platform/API
compatibility. Readiness is current and recoverable: permission state, identity/setup, connectivity,
service health, and whether the declared asset closure is cached. A missing browser API can make a
feature unavailable; a denied permission or offline network makes an available feature not ready.

Invariants MUST be normalized on load and restore:

- `pinned` is a unique ordered subset of `enabled` and dock-eligible IDs;
- unknown and duplicate IDs are ignored but do not invalidate wallet data;
- Wallet and Settings are implicit fixed endpoints, not mutable IDs in the user list;
- an explicit disabled-to-enabled transition is committed only after its declared acquisition graph
  and runtime load succeed; seeded defaults may be enabled-but-not-ready until their
  post-interactive acquisition succeeds;
- permissions are requested at the moment of use, not treated as granted by enablement.

Feature IDs, route prefixes, capability IDs, and storage prefixes also live in an append-only
`packages/app/feature-identifiers.json` ledger. CI checks the live registry against it. Removing a
runtime marks its IDs retired; neither an older nor a future feature can reuse them.

Preferences are a separate selectable backup category. Restoring feature data alone never changes
enablement or the dock. Restoring Preferences previews every enable/disable and dock change and
requires explicit confirmation; unsupported IDs are retained but inactive, and pins beyond current
capacity are reported as restored-but-unpinned rather than silently discarded. Newly enabled
restored features run the same acquisition transaction before their effective state changes; any
failure is reported per feature and does not roll back restored wallet/data keys.

Do not add a remote feature-flag service pre-emptively. If staged rollout is later needed, rollout
availability is a fifth host-owned input and still does not mutate user enablement or dock choices.

### 8. Make the dock a shortcut, not the feature inventory

The dock has at most four visible, labeled destinations:

1. Wallet, fixed first.
2. Up to two user-selected enabled destinations.
3. Settings, fixed last.

The dock MUST never scroll, hide labels, add a `More` dumping ground, or silently replace an item. A
request for a third optional pin opens an explicit choose-an-item-to-replace flow.

- Enabling does not automatically pin.
- Pinning a disabled feature may offer one confirmed `Enable and add` action.
- Unpinning does not disable or delete data and leaves the currently open screen open.
- Disabling removes its pin, retains its data, disposes its runtime, and if currently open returns to
  the Feature Library after confirmation.
- One dock entry represents a feature family. Individual Tools operations do not become dock items.

Settings gains one `Features` full-screen route, not a sheet. It contains a dock preview/editor,
enabled features, available features, and a separate opt-in Labs group. An enabled unpinned feature
can be opened from this library.

Enablement and pinning use visibly separate controls and language: `Turn on/off` and `Show/remove
in dock`. The dock control is disabled until the feature is enabled. `Enable and open` moves focus to
the loaded screen heading. Pin, replacement, unpin, and reorder keep focus on the affected control
and announce the result. Disable returns focus to that feature's Library row after navigation.

Dock editing MUST work without drag: provide Move earlier/Move later controls, retain focus, and
announce the new position. Drag can be an enhancement. The rendered dock is
`<nav aria-label="Primary">`, uses route links, keeps labels and at least 44px targets, and marks the
active destination with `aria-current="page"`.

All feature dialogs use the shared modal contract: an accessible name/description, initial focus,
focus trap and restoration, inert background, and predictable Escape behavior. Escape and backdrop
click do nothing when a destructive or incomplete flow is declared non-dismissible; close controls
must be explicit. This contract is tested once at the primitive and again for destructive feature
flows.

### 9. Use progressive disclosure, not roadmap clutter

- New features are never auto-enabled or auto-pinned for existing users.
- Only complete, usable features appear in production. Remove permanent `Coming soon` rows.
- At most one dismissible `New` indicator appears on Settings/Features per release.
- No launch modal, feature carousel, or unsolicited coachmark competes with first-card creation.
- A contextual suggestion is allowed only after the user's action demonstrates the relevant need,
  and dismissal is remembered locally.
- Discovery heuristics stay local; the architecture does not require behavioral telemetry.
- A feature details page discloses prerequisites, network/offline behavior, permissions, retained
  data, and approximate download size without putting all of that on the main Settings screen.

Within Tools, the current five-operation segmented control is the maximum. A sixth operation
requires a Tools hub/category redesign; it cannot add a sixth compressed tab.

### 10. Lazy-load the whole vertical slice

An optional feature runtime and third-party dependencies MUST be reachable only below its dynamic
boundary; feature CSS/assets are reachable only through its generated acquisition edge. Shared
imports must not cause a heavy library to be hoisted back into startup.

Target source shape:

```text
packages/app/src/
  contracts/           # stable host/feature protocol; no runtime implementations
    capabilities/
    feature.ts
  app/
    features/
      registry.ts
      preferences.ts
    shell/
    storage/
  features/
    tools/
      manifest.ts       # metadata + literal dynamic loader only
      runtime.tsx       # public runtime entry
      routes.ts
      model.ts
      storage.ts        # when durable state exists
      tools.css         # owned source for a separately emitted feature stylesheet
      test/
  shared/
    lib/
    ui/
```

Feature files import other files in their slice through relative paths. Other layers never deep
import a feature. Each public export is explicit; `export *` barrels that accidentally retain code
are forbidden at feature boundaries.

`styles.css` is reduced to reset, tokens, shell layout, and truly shared primitives. Feature styles
are colocated, prefixed/scoped under a feature root, and deleted with the feature.

Bun 1.3.14 currently folds CSS imported from a dynamically imported TS/TSX module into the entry's
single CSS bundle, so colocation alone is not a delivery boundary. Optional CSS MUST either be
emitted as a separate build entry/asset and attached through a host-owned `<link>` loader, or be
counted explicitly as startup CSS. The generated feature asset graph maps that stylesheet to its
owner; enablement waits for it and runtime disposal may remove its link. A network/metafile test—not
source layout—proves that disabled feature CSS is not fetched.

Heavy current candidates require special attention:

- Avoid making every avatar render pull the full DiceBear Notionists collection into startup;
  generate/cache avatars behind an owned boundary or replace the common path with a lightweight
  representation.
- Keep Tools crypto and StegCloak below the Tools runtime/operation evaluation boundaries; their
  assets are still part of the declared Tools offline acquisition closure.
- Prefer narrow exported `nostr-tools` subpaths when tests confirm equivalent behavior; avoid
  duplicate Noble dependency graphs.
- Optimize display-size brand assets and stop copying both original and hashed variants.

### 11. Make PWA offline behavior honest

The service worker MUST precache only the runnable core shell: HTML, the audited static-import
closure of entry JS/CSS, essential manifest/icons, and first-route assets. It MUST NOT put every
build output or any dynamic feature runtime chunk in `APP_SHELL`.

The build emits a versioned acquisition graph for each feature: runtime entry, its full static and
nested dynamic JS closure, separate CSS, and render/file assets promised for offline use. The graph
is generated from build output, not copied by hand. When service workers are supported, enabling
follows a protocol rather than assuming that `import()` populated Cache Storage:

1. Wait for `navigator.serviceWorker.ready` and send the active worker `ACQUIRE_FEATURE` with build
   version and feature ID through a message channel. This works even before the page is controlled.
2. The worker fetches the declared acquisition graph into the matching versioned runtime cache,
   verifies every response, and replies with a typed result. Concurrent callers for the same
   build/feature share one in-flight transaction so one tab cannot invalidate another tab's commit
   marker; settlement releases the lock for a clean retry.
3. The client imports the runtime and attaches its stylesheet only after cache success, then commits
   `enabled`.
4. Failure leaves an explicit user enable action unchanged. A default/migrated enabled feature may
   remain enabled-but-not-ready with Retry so initialization never blocks Wallet.

New-install defaults and migrated enabled features schedule this acquisition after core
interactivity. They never delay first Wallet render, and their dock entries may remain visible with
an honest download/retry state while offline.

This policy acquires a whole feature after the user opts in, including nested operation chunks such
as StegCloak; the chunks remain lazy for parse/evaluation cost, not post-enable network cost. If a
future feature truly needs separately acquired sub-capabilities, those become separately disclosed
acquisition units with their own Ready state and budgets rather than an implicit cache miss.

Without service-worker support, an available feature may run online but its readiness explicitly
reports `offline unsupported`; the UI must not claim that it was saved for offline use. With service
worker support, successfully acquired features reopen offline.

Updates use a client/worker version handshake because the worker cannot read localStorage. Each
identified client reports its build version and enabled feature IDs; before claim, the activating
worker acquires the new-build union of those enabled feature graphs. If any live client is legacy,
unresponsive, or otherwise unidentified, the worker conservatively acquires every declared optional
graph and suppresses cleanup; an empty client set acquires none. This explicit first-rollout cost is
preferable to advancing the shell while silently breaking an enabled offline feature. Old and new
version caches coexist. After claim, the worker snapshots clients again and removes a cache only
when no client uses it, while retaining one last-known-good version for rollback. The current
unconditional deletion of all older `keychain-shell-*` caches is forbidden.

A page/worker build mismatch is not a retryable feature-download error. It becomes a typed
`update-required` readiness state with one controlled `Reload to update` action on the direct route
and in the Feature Library; a timed-out acquisition must not later post through a leaked message
channel when service-worker readiness eventually resolves.

A stale/missing chunk gets one controlled refresh/retry after the handshake. Network tests cover
first install before controller acquisition, first optional enable, nested chunks/assets, offline
reopening, interrupted acquisition, an update with enabled-but-unpinned features, and concurrent old
clients.

### 12. Enforce byte and surface budgets

Add a build report using Bun's metafile/output data and `Bun.gzipSync`; no new dependency is needed.
Traverse the entry's static-import graph separately from dynamic imports and fail `bun run build`
when budgets regress. Since `bun run check` already ends in the production build, this becomes a CI
gate.

The report records both raw bytes and deterministic gzip-equivalent bytes. `Transfer` is not inferred
from gzip-equivalent size: production hosting separately proves Brotli/gzip content encoding for
compressible assets, while Cache Storage budgets use decoded/raw body size.

Locked end-state targets:

| Metric | Locked target |
| --- | ---: |
| Startup JavaScript static closure | <= 200 KiB gzip-equivalent |
| Startup CSS | <= 15 KiB gzip-equivalent |
| First-route critical images | <= 100 KiB encoded |
| Total first-route assets | <= 350 KiB gzip-equivalent/encoded |
| Service-worker core install graph | <= 750 KiB gzip-equivalent and <= 1.5 MiB raw; zero optional runtime chunks |
| Optional feature acquisition graph | <= 75 KiB gzip-equivalent, including nested chunks/CSS/assets |
| Single async chunk | <= 125 KiB gzip-equivalent |
| Optional manifest impact on startup | <= 2 KiB per feature and <= 20 KiB aggregate gzip-equivalent |
| Total shipped JavaScript governance tripwire | <= 750 KiB gzip-equivalent |
| Non-install UI image | <= 50 KiB encoded |

The repository cannot meet all targets immediately. For each metric, the active CI limit is the
committed current baseline when that is above target, otherwise the locked target. A PR may lower
the baseline but may not raise it; once a metric crosses the target, the target remains its ceiling.
This makes `current ratchet` and `end-state target` unambiguous.

The roughly 112 KiB StegCloak chunk fits the single-chunk cap but causes the whole Tools acquisition
graph to exceed the 75 KiB feature target. Its temporary exception therefore belongs to the
acquisition-graph metric, names an owner/expiry, and remains absent from startup even though Tools
enablement acquires it for offline use. Every new dependency PR reports its startup, feature
acquisition, raw-cache, and total-shipped byte delta.

Bundle size is necessary but not sufficient. Each host surface also has a cognitive budget: four
dock destinations, no incomplete Settings entries, one feature-family shortcut, and explicit
overflow limits on extension slots.

### 13. Require lifecycle and cleanup contracts

Feature runtime code has no import-time side effects. Background behavior starts through an explicit
`activate(context)` hook and returns a disposer. Disable, logout/reset, hot update, and runtime error
all call that disposer. `Dispose` means unmount UI, detach an injected stylesheet, cancel work,
remove listeners, and release owned resources. JavaScript modules and browser cache entries are not
unloaded from the current process; full memory/code reclamation happens on a later navigation/reload.

The manifest declares platform capabilities such as network, camera, clipboard, notifications, or
files. Enablement does not grant them. Point-of-use requests explain why they are needed, and a
denied capability is a typed, actionable state.

Lifecycle stages are:

```text
proposal -> experiment -> available optional -> maintained -> deprecated -> runtime removed -> data tombstone removed
```

Deprecation first removes discovery and new enablement, then offers export/delete and an alternative.
Runtime removal does not silently purge data or reuse routes/IDs. The data tombstone's compatibility
window is recorded when deprecation starts.

## Architecture fitness functions

Extend the existing infrastructure tests using the TypeScript compiler API already in the toolchain
rather than regex alone. CI MUST verify:

- lightweight manifests/route codecs may be statically reachable from the entry, but an optional
  runtime, CSS, asset, or dependency is reachable only through its manifest's dynamic/acquisition
  edge and never through any static runtime path;
- a feature imports no other feature implementation, including relative boundary escapes;
- every cross-cutting capability is declared and cycle-free;
- feature, route, dock, extension-slot, capability, and storage IDs are unique and agree with the
  append-only active/retired identifier ledger;
- the entry's static graph contains only core runtime plus the budgeted manifest/route-metadata
  closure;
- no dynamic feature chunk appears in the service-worker install list;
- registry preferences normalize unknown, duplicate, ineligible, and over-capacity IDs;
- each durable feature has codec, migration, backup/restore, reset, disable, delete, and corrupt-data
  tests;
- bundle and image budgets pass;
- no production dependency is unused, and removing a feature removes its exclusive dependency;
- a core-only build succeeds.

Tests remain split by purpose and use the real implementations:

- unit tests for pure commands, codecs, migrations, route codecs, and preference normalization;
- per-feature integration tests for its runtime plus real host capabilities;
- shell integration tests for enable/disable, pin/reorder, disabled deep links, lazy-load failures,
  and data retention;
- real-browser E2E tests for keyboard dock editing, route focus, offline enable/reopen, and PWA
  updates.

The current 1,494-line `App.test.tsx` should be split along those ownership lines without weakening
the no-mock coverage.

## Admission checklist for a new feature

Implementation does not start until a one-page feature note answers:

1. What single user job does this solve, and for whom?
2. Why is this a feature rather than an action inside an existing owner?
3. Is it core, destination, capability, or experiment? Why?
4. What is the default, discovery path, dock eligibility, and contextual entry point?
5. What happens when it is unavailable, disabled, unpinned, not ready, or offline?
6. What data, permissions, network access, background work, and backup behavior does it own?
7. What capabilities does it consume/provide, and can it work without every optional provider?
8. What are its measured startup, async, CSS, image, and dependency costs?
9. How is it deprecated and deleted without touching unrelated features?
10. What unit, integration, E2E, accessibility, and migration tests prove those claims?

A feature that cannot answer the removal question is not ready to enter the registry.

## Incremental migration plan

This should not be a rewrite. Each phase leaves the application releasable.

### Phase 0: Measure and prevent further drift

- Add Bun metafile/gzip reporting and commit no-growth baselines.
- Generate versioned core/feature asset graphs and change `APP_SHELL` to the core static graph only.
- Replace unconditional old-cache deletion with the client-version retention/update handshake.
- Remove duplicated brand outputs and resize/optimize oversized display assets.
- Strengthen import-graph and registry uniqueness architecture tests. Commit the existing
  cross-feature edges as a shrinking, owner/expiry allowlist: no new edge is allowed, and each
  extraction deletes its entries until the target is zero.

**Exit:** CI reports startup vs optional bytes and fails if a dynamic chunk is precached.

### Phase 1: Create the shell contracts

- Extract toast/announcement, platform capabilities, route host, feature error/loading boundary, and
  preference normalization from `App.tsx`.
- Add the typed registry and render dock/settings from descriptors while preserving current UX.
- Make `BottomNav` data-driven and accessible; do not add user configuration yet.

**Exit:** adding a descriptor renders a route/library/dock candidate without another shell switch.

### Phase 2: Prove the boundary with Tools

Tools is the best pilot because it is optional, comparatively self-contained, and dependency-heavy.

- Give Tools a manifest and dynamic runtime entry.
- Replace identity, People recipient, and clipboard imports with typed capabilities.
- Emit its CSS separately, keep crypto/StegCloak below lazy evaluation boundaries, and acquire the
  generated complete asset graph through the service worker before enablement commits.
- Verify a clean Wallet session fetches no Tools code and an enabled Tools session works offline.

**Exit:** Tools can be removed by deleting its registry row/runtime directory, with startup size
falling measurably and no core compilation failure.

### Phase 3: Ship Features and configurable dock UX

- Add versioned feature preferences and the full-screen Feature Library.
- Migrate existing users to their current four-item dock; apply the smaller new-user default.
- Implement enable/load/cache, disable/dispose, pin/replace, reorder, and accessibility behavior.
- Remove unshipped `Coming soon` Settings rows.

**Exit:** the four-state matrix and all dock invariants pass integration/E2E tests.

### Phase 4: Split persistence and orchestration

- Split core, preferences, and per-feature storage keys through the staged legacy migration.
- Measure migration fixtures and commit each namespace's numeric size limit plus the aggregate
  ceiling; unlimited storage adapters are not allowed.
- Move contacts and activity data/validation/migrations to their owning adapters.
- Replace `withActivity` with a passive typed domain-fact projection.
- Make backup/restore aggregate namespaces without knowing their shapes or auto-enabling them.

**Exit:** corrupt/removed optional data cannot prevent Wallet startup, and disabling/removing a
feature preserves unrelated data and backups.

### Phase 5: Extract the remaining slices

- Move People, Activity, sharing, backup UI, and card flows behind appropriate runtime or contextual
  boundaries.
- Split feature CSS and integration tests as each owner moves.
- Revisit `@keychain/core` exports only when a stable multi-feature contract justifies it.

**Exit:** `App.tsx` is a small shell/composition module rather than a workflow owner, and global CSS
contains only shell/shared rules.

### Phase 6: Add a repeatable feature template

Create a small generator/template only after Tools and one stateful feature prove the contract. It
should scaffold a manifest, runtime, routes, tests, optional storage adapter, README/checklist, and
budget entry. Automating an unproven abstraction would freeze the wrong seams.

## Definition of done

This policy is implemented when all of the following are true:

- A new optional destination adds one feature directory, one registry entry, and owned tests; it
  does not edit `App`, `BottomNav`, `Settings`, the core storage decoder, or a route switch.
- Removing its runtime, registry entry, exclusive dependencies, and generated build/budget entries
  passes typecheck, lint, unit, integration, core-only build, full build, and bundle budgets; its
  retired-ID/tombstone record remains intentionally.
- A clean install fetches only lightweight disabled-feature manifests, not their runtime, CSS,
  assets, or dependencies. With service-worker support, successful acquisition reopens the entire
  enabled feature offline.
- Disabled and removed feature URLs fail safely, not by redirecting to an unrelated highlighted tab.
- Disable, unpin, and delete data demonstrably have different effects.
- An optional feature failure cannot crash Wallet or prevent recovery through Settings.
- Existing user routes, data, backups, and dock order survive migration.
- The startup and precache ratchets move down toward the locked targets rather than being reset when
  they become inconvenient.

## Decisions explicitly rejected

- **A boolean toggle around statically imported JSX:** hides UI but keeps coupling and bytes.
- **A runtime third-party plugin system:** adds trust, compatibility, sandboxing, and API-versioning
  complexity that the product does not need.
- **One package per feature immediately:** creates release/configuration ceremony without enforcing
  runtime isolation.
- **Arbitrary feature-to-feature imports as long as they are acyclic:** still makes lower slices hard
  to remove and encourages dependency gravity.
- **Precache the entire application for offline completeness:** forces every user to download every
  feature. Enabling is the explicit point at which optional offline availability is acquired.
- **A dock item or toggle for every capability:** converts organization into user-facing clutter.
- **Permanent disabled roadmap rows:** advertises absence, consumes attention, and creates promises
  outside the release process.
- **Silent data deletion on disable/removal:** violates wallet trust and makes experimentation risky.

The overall rule is simple: a feature earns three things independently—its place in the build, its
place in the user's product, and its place in navigation. None is automatic merely because the code
exists.
