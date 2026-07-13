import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { shellCacheName } from "../worker/cache-policy.ts";
import {
  BUNDLE_EXCEPTIONS,
  BUNDLE_LIMITS,
  type BundleMetric,
  type ByteSize,
  bundleMetric,
  CORE_INSTALL_ASSETS,
  canonicalizeBuildVersion,
  classifyArtifacts,
  classifyFeatureAssets,
  classifyOutputGraph,
  createFeatureAssetGraph,
  discoverFeatureRuntimeEntries,
  featureTargetExceptionFailures,
} from "./bundle-policy.ts";

interface MeasuredAsset extends ByteSize {
  readonly path: string;
}

interface BundleReport {
  readonly version: 4;
  readonly buildVersion: string;
  readonly gzipEquivalent: "Bun.gzipSync level 9 after build-ID canonicalization; not a transfer-size assertion";
  readonly exceptions: typeof BUNDLE_EXCEPTIONS;
  readonly assetGroups: {
    readonly coreInstall: readonly MeasuredAsset[];
    readonly features: Readonly<Record<string, readonly MeasuredAsset[]>>;
    readonly unassignedOptional: readonly MeasuredAsset[];
    readonly serviceWorker: MeasuredAsset;
  };
  readonly metrics: {
    readonly startupJavaScript: BundleMetric;
    readonly startupCss: BundleMetric;
    readonly coreInstallGraph: BundleMetric;
    readonly largestAsyncChunk: BundleMetric;
    readonly serviceWorkerJavaScript: BundleMetric;
    readonly featureAcquisitionGraphs: Readonly<Record<string, BundleMetric>>;
    readonly totalShippedJavaScript: BundleMetric;
  };
}

const appDir = fileURLToPath(new URL("../", import.meta.url));
const coreDir = join(appDir, "../core");
const repositoryDir = join(appDir, "../..");
const distDir = join(appDir, "dist");
const appEntry = join(appDir, "index.html");
const metafileEntry = relative(process.cwd(), appEntry).split(sep).join("/");
const relativeOutputPath = (path: string): string => relative(distDir, path).split(sep).join("/");

const ignoredVersionDirectories: ReadonlySet<string> = new Set([
  "coverage",
  "dist",
  "node_modules",
]);
const sourceFiles = async (directory: string): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return ignoredVersionDirectories.has(entry.name) ? [] : sourceFiles(path);
      }
      return entry.isFile() ? [path] : [];
    }),
  );
  return paths.flat();
};
const versionHasher = new Bun.CryptoHasher("sha256");
const versionInputs = [
  ...(await sourceFiles(appDir)),
  ...(await sourceFiles(coreDir)),
  join(repositoryDir, "bun.lock"),
  join(repositoryDir, "package.json"),
  join(repositoryDir, "tsconfig.base.json"),
].sort();
// Cache ownership includes the compiler and host that emitted the graph, not source bytes alone.
versionHasher.update(`bun:${Bun.version}\0platform:${process.platform}\0arch:${process.arch}\0`);
for (const path of versionInputs) {
  versionHasher.update(relative(repositoryDir, path).split(sep).join("/"));
  versionHasher.update(new Uint8Array(await Bun.file(path).arrayBuffer()));
}
const buildVersion = versionHasher.digest("hex").slice(0, 16);

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const appBuild = await Bun.build({
  entrypoints: [appEntry],
  outdir: distDir,
  target: "browser",
  minify: true,
  splitting: true,
  metafile: true,
  define: {
    APP_BUILD_VERSION: JSON.stringify(buildVersion),
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
if (!appBuild.success) {
  for (const log of appBuild.logs) console.error(log);
  throw new Error("Application bundle failed");
}
if (appBuild.metafile === undefined) throw new Error("Application build did not emit a metafile");

for (const asset of CORE_INSTALL_ASSETS) {
  const destination = join(distDir, asset);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(appDir, asset), destination);
}

const emittedPaths = appBuild.outputs.map(({ path }) => relativeOutputPath(path));
const outputGraph = classifyOutputGraph(appBuild.metafile.outputs, metafileEntry);
const outputsByPath = new Map(
  appBuild.outputs.map((output) => [relativeOutputPath(output.path), output] as const),
);
const outputContents = Object.fromEntries(
  await Promise.all(
    [...outputsByPath].map(async ([path, output]) => [path, await output.text()] as const),
  ),
);
const staticOutputContents = outputGraph.staticPaths.map((path) => outputContents[path] ?? "");
const assetGroups = classifyArtifacts(
  emittedPaths,
  outputGraph,
  staticOutputContents,
  CORE_INSTALL_ASSETS,
);
const dynamicPrecacheLeaks = outputGraph.dynamicPaths.filter((path) =>
  assetGroups.shellPaths.includes(path),
);
if (dynamicPrecacheLeaks.length > 0) {
  throw new Error(`Dynamic outputs entered the app shell: ${dynamicPrecacheLeaks.join(", ")}`);
}
const featureOwnership = classifyFeatureAssets(
  appBuild.metafile.outputs,
  discoverFeatureRuntimeEntries(appBuild.metafile.outputs, outputGraph),
  assetGroups.shellPaths,
  emittedPaths,
  outputContents,
);
const ownedOptionalPaths = new Set(Object.values(featureOwnership).flat());
const unassignedOptionalPaths = assetGroups.optionalPaths.filter(
  (path) => !ownedOptionalPaths.has(path),
);
if (unassignedOptionalPaths.length > 0) {
  throw new Error(`Optional outputs have no feature owner: ${unassignedOptionalPaths.join(", ")}`);
}
const featureAssetGraph = createFeatureAssetGraph(
  buildVersion,
  Object.fromEntries(
    Object.entries(featureOwnership).map(([id, paths]) => [id, paths.map((path) => `./${path}`)]),
  ),
);

const hasher = new Bun.CryptoHasher("sha256");
for (const asset of assetGroups.shellPaths) {
  hasher.update(asset);
  hasher.update(new Uint8Array(await Bun.file(join(distDir, asset)).arrayBuffer()));
}
const cacheName = shellCacheName(buildVersion, hasher.digest("hex").slice(0, 16));
const appShell = ["./", ...assetGroups.shellPaths.map((asset) => `./${asset}`)];

const workerBuild = await Bun.build({
  entrypoints: [join(appDir, "worker/sw.ts")],
  outdir: distDir,
  target: "browser",
  format: "esm",
  minify: true,
  naming: { entry: "[name].[ext]" },
  define: {
    APP_CACHE_NAME: JSON.stringify(cacheName),
    APP_SHELL: JSON.stringify(appShell),
    FEATURE_ASSET_GRAPH: JSON.stringify(featureAssetGraph),
  },
});
if (!workerBuild.success) {
  for (const log of workerBuild.logs) console.error(log);
  throw new Error("Service worker bundle failed");
}
if (!(await Bun.file(join(distDir, "sw.js")).exists())) {
  throw new Error("Service worker was not emitted at dist/sw.js");
}

const measure = async (path: string): Promise<MeasuredAsset> => {
  const bytes = new Uint8Array(await Bun.file(join(distDir, path)).arrayBuffer());
  const gzipInput = path.endsWith(".js")
    ? new TextEncoder().encode(
        canonicalizeBuildVersion(new TextDecoder().decode(bytes), buildVersion),
      )
    : bytes;
  return {
    path,
    rawBytes: bytes.byteLength,
    gzipBytes: Bun.gzipSync(gzipInput, { level: 9 }).byteLength,
  };
};
const [coreInstall, measuredFeatureEntries, unassignedOptional, serviceWorker] = await Promise.all([
  Promise.all(assetGroups.shellPaths.map(measure)),
  Promise.all(
    Object.entries(featureOwnership).map(
      async ([id, paths]) => [id, await Promise.all(paths.map(measure))] as const,
    ),
  ),
  Promise.all(unassignedOptionalPaths.map(measure)),
  measure("sw.js"),
]);
const features: Readonly<Record<string, readonly MeasuredAsset[]>> =
  Object.fromEntries(measuredFeatureEntries);
const featureAssets = Object.values(features).flat();
const allOptional = [...featureAssets, ...unassignedOptional];
const sum = (assets: readonly MeasuredAsset[]): ByteSize =>
  assets.reduce<ByteSize>(
    (total, asset) => ({
      rawBytes: total.rawBytes + asset.rawBytes,
      gzipBytes: total.gzipBytes + asset.gzipBytes,
    }),
    { rawBytes: 0, gzipBytes: 0 },
  );
const matching = (assets: readonly MeasuredAsset[], extension: string): readonly MeasuredAsset[] =>
  assets.filter(({ path }) => path.endsWith(extension));
const largest = (assets: readonly MeasuredAsset[]): ByteSize =>
  assets.reduce<ByteSize>(
    (maximum, asset) => {
      if (asset.gzipBytes <= maximum.gzipBytes) return maximum;
      return { rawBytes: asset.rawBytes, gzipBytes: asset.gzipBytes };
    },
    { rawBytes: 0, gzipBytes: 0 },
  );

const metrics = {
  startupJavaScript: bundleMetric(
    sum(matching(coreInstall, ".js")),
    BUNDLE_LIMITS.startupJavaScript,
  ),
  startupCss: bundleMetric(sum(matching(coreInstall, ".css")), BUNDLE_LIMITS.startupCss),
  coreInstallGraph: bundleMetric(sum(coreInstall), BUNDLE_LIMITS.coreInstallGraph),
  largestAsyncChunk: bundleMetric(
    largest(matching(allOptional, ".js")),
    BUNDLE_LIMITS.largestAsyncChunk,
  ),
  serviceWorkerJavaScript: bundleMetric(serviceWorker, BUNDLE_LIMITS.serviceWorkerJavaScript),
  featureAcquisitionGraphs: Object.fromEntries(
    Object.entries(features).map(([id, assets]) => [
      id,
      bundleMetric(sum(assets), BUNDLE_LIMITS.featureAcquisitionGraph),
    ]),
  ),
  totalShippedJavaScript: bundleMetric(
    sum([...matching([...coreInstall, ...allOptional], ".js"), serviceWorker]),
    BUNDLE_LIMITS.totalShippedJavaScript,
  ),
} satisfies BundleReport["metrics"];
const report: BundleReport = {
  version: 4,
  buildVersion,
  gzipEquivalent:
    "Bun.gzipSync level 9 after build-ID canonicalization; not a transfer-size assertion",
  exceptions: BUNDLE_EXCEPTIONS,
  assetGroups: { coreInstall, features, unassignedOptional, serviceWorker },
  metrics,
};
await Bun.write(join(distDir, "bundle-report.json"), `${JSON.stringify(report, null, 2)}\n`);

const failedRatchets = [
  ...Object.entries(metrics)
    .filter(([name]) => name !== "featureAcquisitionGraphs")
    .flatMap(([name, metric]) => ("withinRatchet" in metric && metric.withinRatchet ? [] : [name])),
  ...Object.entries(metrics.featureAcquisitionGraphs).flatMap(([id, metric]) =>
    metric.withinRatchet ? [] : [`featureAcquisitionGraphs.${id}`],
  ),
  ...featureTargetExceptionFailures(
    metrics.featureAcquisitionGraphs,
    new Date().toISOString().slice(0, 10),
  ),
];
if (failedRatchets.length > 0) {
  throw new Error(`Bundle ratchet exceeded: ${failedRatchets.join(", ")}`);
}

console.log(
  `Built ${assetGroups.shellPaths.length} core assets and ${featureAssets.length} owned optional assets for ${buildVersion} with cache ${cacheName}`,
);
