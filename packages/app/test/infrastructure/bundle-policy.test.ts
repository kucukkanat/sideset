import { describe, expect, test } from "bun:test";
import {
  BUNDLE_EXCEPTIONS,
  BUNDLE_LIMITS,
  bundleMetric,
  CORE_INSTALL_ASSETS,
  canonicalizeBuildVersion,
  classifyArtifacts,
  classifyFeatureAssets,
  classifyOutputGraph,
  createFeatureAssetGraph,
  discoverFeatureRuntimeEntries,
  featureTargetExceptionFailures,
} from "../../scripts/bundle-policy.ts";
import {
  cacheBuildVersion,
  obsoleteApplicationCaches,
  retainedAssetCaches,
  runtimeStagingCacheName,
  shellCacheName,
} from "../../worker/cache-policy.ts";

describe("bundle delivery policy", () => {
  test("walks only the entry's static metafile closure", () => {
    const classification = classifyOutputGraph(
      {
        "./entry.js": {
          entryPoint: "src/main.ts",
          cssBundle: "./entry.css",
          imports: [
            { path: "./shared.js", kind: "import-statement" },
            { path: "./feature.js", kind: "dynamic-import" },
          ],
        },
        "./entry.css": { imports: [] },
        "./shared.js": { imports: [] },
        "./feature.js": {
          entryPoint: "src/features/example/runtime.ts",
          imports: [
            { path: "./shared.js", kind: "import-statement" },
            { path: "./feature-helper.js", kind: "import-statement" },
          ],
        },
        "./feature-helper.js": { imports: [] },
      },
      "src/main.ts",
    );

    expect(classification).toEqual({
      staticPaths: ["entry.css", "entry.js", "shared.js"],
      dynamicPaths: ["feature-helper.js", "feature.js"],
    });
  });

  test("assigns static references and install metadata without precaching optional artifacts", () => {
    const classification = classifyArtifacts(
      [
        "entry.js",
        "shared.js",
        "feature.js",
        "feature-helper.js",
        "core-image-a1.png",
        "feature-image-b2.png",
      ],
      {
        staticPaths: ["entry.js", "shared.js"],
        dynamicPaths: ["feature-helper.js", "feature.js"],
      },
      ['const logo = "./core-image-a1.png"'],
      ["icons/icon-192.png"],
    );

    expect(classification).toEqual({
      shellPaths: ["core-image-a1.png", "entry.js", "icons/icon-192.png", "shared.js"],
      optionalPaths: ["feature-helper.js", "feature-image-b2.png", "feature.js"],
    });
    expect(CORE_INSTALL_ASSETS).toEqual([
      "icons/icon-192.png",
      "icons/icon-512.png",
      "icons/icon-maskable-512.png",
    ]);
  });

  test("generates a feature-owned closure including nested dynamic chunks and referenced assets", () => {
    const outputs = {
      "./entry.js": {
        entryPoint: "packages/app/index.html",
        imports: [
          { path: "./shared.js", kind: "import-statement" },
          { path: "./tools.js", kind: "dynamic-import" },
        ],
      },
      "./shared.js": { imports: [] },
      "./tools.js": {
        entryPoint: "packages/app/src/features/tools/Tools.tsx",
        cssBundle: "./tools.css",
        imports: [
          { path: "./shared.js", kind: "import-statement" },
          { path: "./cloak.js", kind: "dynamic-import" },
        ],
      },
      "./tools.css": { imports: [] },
      "./cloak.js": {
        entryPoint: "node_modules/stegcloak/index.js",
        imports: [{ path: "./codec.js", kind: "import-statement" }],
      },
      "./codec.js": { imports: [] },
    } as const;
    const outputGraph = classifyOutputGraph(outputs, "packages/app/index.html");
    const entries = discoverFeatureRuntimeEntries(outputs, outputGraph);
    const ownership = classifyFeatureAssets(
      outputs,
      entries,
      outputGraph.staticPaths,
      ["entry.js", "shared.js", "tools.js", "tools.css", "cloak.js", "codec.js", "tool-image.png"],
      { "tools.css": 'background: url("./tool-image.png")' },
    );

    expect(entries).toEqual([
      { id: "tools", entryPoint: "packages/app/src/features/tools/Tools.tsx" },
    ]);
    expect(ownership).toEqual({
      tools: ["cloak.js", "codec.js", "tool-image.png", "tools.css", "tools.js"],
    });
    expect(ownership.tools?.filter((path) => outputGraph.staticPaths.includes(path))).toEqual([]);
    expect(createFeatureAssetGraph("build-a1", ownership)).toEqual({
      schemaVersion: 1,
      buildVersion: "build-a1",
      features: {
        tools: {
          assets: ["cloak.js", "codec.js", "tool-image.png", "tools.css", "tools.js"],
        },
      },
    });
  });

  test("reports current, ratchet, and target independently", () => {
    expect(
      bundleMetric(
        { rawBytes: 200, gzipBytes: 100 },
        { ratchet: { gzipBytes: 110 }, target: { gzipBytes: 90 } },
      ),
    ).toEqual({
      current: { rawBytes: 200, gzipBytes: 100 },
      ratchet: { gzipBytes: 110 },
      target: { gzipBytes: 90 },
      withinRatchet: true,
      atTarget: false,
    });
  });

  test("budgets the service worker outside the precached shell", () => {
    expect(BUNDLE_LIMITS.serviceWorkerJavaScript.target).toEqual({ gzipBytes: 15 * 1024 });
    expect(CORE_INSTALL_ASSETS).not.toContain("sw.js");
  });

  test("keeps feature acquisition exceptions explicit and time-bounded", () => {
    expect(BUNDLE_LIMITS.featureAcquisitionGraph.target).toEqual({ gzipBytes: 75 * 1024 });
    expect(BUNDLE_EXCEPTIONS).toEqual([
      {
        metric: "featureAcquisitionGraph",
        featureId: "tools",
        owner: "Tools",
        expiresOn: "2026-10-01",
        reason: "StegCloak keeps the current Tools acquisition graph above the 75 KiB target.",
      },
    ]);
    expect(
      featureTargetExceptionFailures(
        { tools: { atTarget: false }, compact: { atTarget: true } },
        "2026-07-13",
      ),
    ).toEqual([]);
    expect(
      featureTargetExceptionFailures(
        { tools: { atTarget: false }, unowned: { atTarget: false } },
        "2026-10-02",
      ),
    ).toEqual([
      "exceptions.expired.tools",
      "featureTargets.unapproved.tools",
      "featureTargets.unapproved.unowned",
    ]);
  });

  test("canonicalizes content-derived build IDs before gzip measurement", () => {
    expect(canonicalizeBuildVersion("const v='a1b2';", "a1b2")).toBe("const v='0000';");
    expect(canonicalizeBuildVersion("unchanged", "")).toBe("unchanged");
  });

  test("includes compiler and repository build configuration in cache ownership", async () => {
    const build = await Bun.file("packages/app/scripts/build.ts").text();
    expect(build).toMatch(/versionHasher\.update\(`bun:\$\{Bun\.version\}/u);
    expect(build).toContain('join(repositoryDir, "package.json")');
    expect(build).toContain('join(repositoryDir, "tsconfig.base.json")');
  });
});

describe("service-worker cache retention", () => {
  const OLDEST = "1111111111111111";
  const ACTIVE = "2222222222222222";
  const ROLLBACK = "3333333333333333";
  const CURRENT = "4444444444444444";
  const currentShell = shellCacheName(CURRENT, "eeeeeeeeeeeeeeee");
  const names = [
    "unrelated-cache",
    shellCacheName(OLDEST, "aaaaaaaaaaaaaaaa"),
    `keychain-runtime-${OLDEST}`,
    shellCacheName(ACTIVE, "bbbbbbbbbbbbbbbb"),
    `keychain-runtime-${ACTIVE}`,
    shellCacheName(ROLLBACK, "cccccccccccccccc"),
    `keychain-runtime-${ROLLBACK}`,
    runtimeStagingCacheName(ACTIVE, "tools", "active-request"),
    runtimeStagingCacheName(OLDEST, "tools", "abandoned-request"),
    currentShell,
    `keychain-runtime-${CURRENT}`,
  ] as const;

  test("keeps shell and runtime caches reported by live clients", () => {
    expect(
      obsoleteApplicationCaches(names, {
        currentBuildVersion: CURRENT,
        currentShellCacheName: currentShell,
        activeClientBuildVersions: [ACTIVE],
        hasUnidentifiedClients: false,
      }),
    ).toEqual([
      shellCacheName(OLDEST, "aaaaaaaaaaaaaaaa"),
      `keychain-runtime-${OLDEST}`,
      runtimeStagingCacheName(OLDEST, "tools", "abandoned-request"),
    ]);
  });

  test("retains one matching shell/runtime rollback version when no clients use it", () => {
    expect(
      obsoleteApplicationCaches(names, {
        currentBuildVersion: CURRENT,
        currentShellCacheName: currentShell,
        activeClientBuildVersions: [],
        hasUnidentifiedClients: false,
      }),
    ).toEqual([
      shellCacheName(OLDEST, "aaaaaaaaaaaaaaaa"),
      `keychain-runtime-${OLDEST}`,
      shellCacheName(ACTIVE, "bbbbbbbbbbbbbbbb"),
      `keychain-runtime-${ACTIVE}`,
      runtimeStagingCacheName(ACTIVE, "tools", "active-request"),
      runtimeStagingCacheName(OLDEST, "tools", "abandoned-request"),
    ]);
  });

  test("does not clean any cache while a legacy or unresponsive client is unidentified", () => {
    expect(
      obsoleteApplicationCaches(names, {
        currentBuildVersion: CURRENT,
        currentShellCacheName: currentShell,
        activeClientBuildVersions: [ACTIVE],
        hasUnidentifiedClients: true,
      }),
    ).toEqual([]);
  });

  test("encodes build ownership in versioned cache names", () => {
    expect(cacheBuildVersion(currentShell)).toBe(CURRENT);
    expect(cacheBuildVersion(`keychain-runtime-${ACTIVE}`)).toBe(ACTIVE);
    expect(cacheBuildVersion(runtimeStagingCacheName(OLDEST, "tools", "request"))).toBe(OLDEST);
    expect(cacheBuildVersion("keychain-shell-legacy-hash")).toBeNull();
  });

  test("offers only non-current shell and runtime caches for exact asset fallback", () => {
    const candidates = retainedAssetCaches(names, currentShell, CURRENT);
    expect(candidates.map(({ kind, name }) => `${kind}:${name}`)).toEqual([
      `runtime:keychain-runtime-${ROLLBACK}`,
      `shell:${shellCacheName(ROLLBACK, "cccccccccccccccc")}`,
      `runtime:keychain-runtime-${ACTIVE}`,
      `shell:${shellCacheName(ACTIVE, "bbbbbbbbbbbbbbbb")}`,
      `runtime:keychain-runtime-${OLDEST}`,
      `shell:${shellCacheName(OLDEST, "aaaaaaaaaaaaaaaa")}`,
    ]);
    expect(candidates.some(({ name }) => name.includes("staging"))).toBe(false);
  });

  test("keeps one conservative rollback pair across the legacy shell-name transition", () => {
    expect(
      obsoleteApplicationCaches(
        [
          "keychain-shell-legacy-oldest",
          "keychain-shell-legacy-latest",
          `keychain-runtime-${ROLLBACK}`,
          currentShell,
          `keychain-runtime-${CURRENT}`,
        ],
        {
          currentBuildVersion: CURRENT,
          currentShellCacheName: currentShell,
          activeClientBuildVersions: [],
          hasUnidentifiedClients: false,
        },
      ),
    ).toEqual(["keychain-shell-legacy-oldest"]);
  });

  test("prewarms enabled updates before claim and re-snapshots before cleanup", async () => {
    const source = await Bun.file("packages/app/worker/sw.ts").text();
    const prewarm = source.indexOf("await acquireEnabledFeatureUpdates(initialClientStates)");
    const claim = source.indexOf("await worker.clients.claim()");
    const finalSnapshot = source.indexOf("const clients = await worker.clients.matchAll");
    const cleanup = source.indexOf("const obsolete = obsoleteApplicationCaches");
    expect(prewarm).toBeGreaterThan(0);
    expect(claim).toBeGreaterThan(0);
    expect(claim).toBeGreaterThan(prewarm);
    expect(finalSnapshot).toBeGreaterThan(claim);
    expect(cleanup).toBeGreaterThan(finalSnapshot);
  });
});
