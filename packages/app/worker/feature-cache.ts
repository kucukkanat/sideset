import type { FeatureAssetGraph, WorkerAcquisitionFailureCode } from "./acquisition-protocol.ts";
import { RUNTIME_CACHE_PREFIX, runtimeStagingCacheName } from "./cache-policy.ts";

export interface RuntimeCache {
  readonly delete: (request: string) => Promise<boolean>;
  readonly keys: () => Promise<readonly Request[]>;
  readonly match: (request: string) => Promise<Response | undefined>;
  readonly put: (request: string, response: Response) => Promise<void>;
}

export interface RuntimeCacheStorage {
  readonly delete: (cacheName: string) => Promise<boolean>;
  readonly open: (cacheName: string) => Promise<RuntimeCache>;
}

export interface FeatureCacheDependencies {
  readonly baseUrl: string;
  readonly cacheStorage: RuntimeCacheStorage;
  readonly fetchAsset: (url: string) => Promise<Response>;
  readonly reportCleanupFailure: (error: unknown) => void;
  readonly transactionId: string;
}

export type FeatureCacheAcquisition =
  | { readonly ok: true; readonly assetCount: number }
  | {
      readonly ok: false;
      readonly code: Exclude<WorkerAcquisitionFailureCode, "version-mismatch">;
      readonly message: string;
    };

export interface FeatureCommitMarker {
  readonly schemaVersion: 1;
  readonly buildVersion: string;
  readonly featureId: string;
  readonly assets: readonly string[];
}

const failure = (
  code: Exclude<WorkerAcquisitionFailureCode, "version-mismatch">,
  message: string,
): FeatureCacheAcquisition => ({ ok: false, code, message });

export const runtimeCacheName = (buildVersion: string): string =>
  `${RUNTIME_CACHE_PREFIX}${buildVersion}`;

const markerUrl = (baseUrl: string, featureId: string): string =>
  new URL(`.__feature-cache/${encodeURIComponent(featureId)}`, baseUrl).href;

const absoluteAssets = (baseUrl: string, assets: readonly string[]): readonly string[] =>
  assets.map((asset) => new URL(asset, baseUrl).href);

const sameStrings = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const commitMarker = async (
  response: Response | undefined,
): Promise<FeatureCommitMarker | null> => {
  if (response === undefined || !response.ok) return null;
  try {
    const value: unknown = await response.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const candidate = value as Readonly<Record<string, unknown>>;
    if (
      candidate.schemaVersion !== 1 ||
      typeof candidate.buildVersion !== "string" ||
      typeof candidate.featureId !== "string" ||
      !Array.isArray(candidate.assets) ||
      !candidate.assets.every((asset) => typeof asset === "string")
    ) {
      return null;
    }
    return {
      schemaVersion: 1,
      buildVersion: candidate.buildVersion,
      featureId: candidate.featureId,
      assets: candidate.assets,
    };
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
};

const isCommitted = async (
  cache: RuntimeCache,
  graph: FeatureAssetGraph,
  featureId: string,
  assets: readonly string[],
  baseUrl: string,
): Promise<boolean> => {
  const marker = await commitMarker(await cache.match(markerUrl(baseUrl, featureId)));
  if (
    marker === null ||
    marker.buildVersion !== graph.buildVersion ||
    marker.featureId !== featureId ||
    !sameStrings(marker.assets, assets)
  ) {
    return false;
  }
  const cached = await Promise.all(assets.map((asset) => cache.match(asset)));
  return cached.every((response) => response?.ok === true);
};

const canCache = (response: Response): boolean =>
  response.ok && (response.type === "basic" || response.type === "default");

const JAVASCRIPT_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "application/ecmascript",
  "application/javascript",
  "text/ecmascript",
  "text/javascript",
]);

export const isValidFeatureAssetResponse = (assetUrl: string, response: Response): boolean => {
  if (!canCache(response)) return false;
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim() ?? "";
  const pathname = new URL(assetUrl).pathname;
  if (pathname.endsWith(".js")) return JAVASCRIPT_CONTENT_TYPES.has(contentType);
  if (pathname.endsWith(".css")) return contentType === "text/css";
  if (pathname.endsWith(".json")) return contentType === "application/json";
  if (pathname.endsWith(".png")) return contentType === "image/png";
  if (pathname.endsWith(".svg")) return contentType === "image/svg+xml";
  if (pathname.endsWith(".webp")) return contentType === "image/webp";
  return contentType !== "text/html";
};

export const markerCommitsAsset = (
  marker: FeatureCommitMarker,
  buildVersion: string,
  assetUrl: string,
): boolean => marker.buildVersion === buildVersion && marker.assets.includes(assetUrl);

export const committedRuntimeAsset = async (
  cache: RuntimeCache,
  buildVersion: string,
  assetUrl: string,
): Promise<Response | undefined> => {
  const asset = await cache.match(assetUrl);
  if (asset === undefined || !isValidFeatureAssetResponse(assetUrl, asset)) return undefined;
  const markerRequests = (await cache.keys()).filter(({ url }) =>
    new URL(url).pathname.includes("/.__feature-cache/"),
  );
  for (const request of markerRequests) {
    const marker = await commitMarker(await cache.match(request.url));
    if (marker === null || !markerCommitsAsset(marker, buildVersion, assetUrl)) continue;
    const closure = await Promise.all(marker.assets.map((path) => cache.match(path)));
    if (closure.every((response) => response?.ok === true)) return asset;
  }
  return undefined;
};

const acquireFeatureAssetsTransaction = async (
  graph: FeatureAssetGraph,
  featureId: string,
  dependencies: FeatureCacheDependencies,
): Promise<FeatureCacheAcquisition> => {
  if (!Object.hasOwn(graph.features, featureId)) {
    return failure("unknown-feature", `Unknown feature: ${featureId}`);
  }
  const feature = graph.features[featureId];
  if (feature === undefined) return failure("unknown-feature", `Unknown feature: ${featureId}`);

  const assets = absoluteAssets(dependencies.baseUrl, feature.assets);
  let runtimeCache: RuntimeCache;
  try {
    runtimeCache = await dependencies.cacheStorage.open(runtimeCacheName(graph.buildVersion));
    if (await isCommitted(runtimeCache, graph, featureId, assets, dependencies.baseUrl)) {
      return { ok: true, assetCount: assets.length };
    }
  } catch (error: unknown) {
    return failure(
      "cache-failure",
      error instanceof Error ? error.message : "Unable to inspect the feature cache",
    );
  }

  const stagingName = runtimeStagingCacheName(
    graph.buildVersion,
    featureId,
    dependencies.transactionId,
  );
  try {
    await dependencies.cacheStorage.delete(stagingName);
    const staging = await dependencies.cacheStorage.open(stagingName);
    for (const asset of assets) {
      let response: Response;
      try {
        response = await dependencies.fetchAsset(asset);
      } catch (error: unknown) {
        return failure(
          "network-failure",
          error instanceof Error ? error.message : `Unable to download ${asset}`,
        );
      }
      if (!isValidFeatureAssetResponse(asset, response)) {
        return failure(
          "network-failure",
          `Feature asset returned an invalid response (${response.status}): ${asset}`,
        );
      }
      try {
        await staging.put(asset, response);
      } catch (error: unknown) {
        return failure(
          "cache-failure",
          error instanceof Error ? error.message : `Unable to stage ${asset}`,
        );
      }
    }

    try {
      const commitUrl = markerUrl(dependencies.baseUrl, featureId);
      await runtimeCache.delete(commitUrl);
      for (const asset of assets) {
        const staged = await staging.match(asset);
        if (staged === undefined)
          return failure("cache-failure", `Staged asset is missing: ${asset}`);
        await runtimeCache.put(asset, staged);
      }
      const marker: FeatureCommitMarker = {
        schemaVersion: 1,
        buildVersion: graph.buildVersion,
        featureId,
        assets,
      };
      await runtimeCache.put(
        commitUrl,
        new Response(JSON.stringify(marker), {
          headers: { "content-type": "application/json" },
        }),
      );
      return { ok: true, assetCount: assets.length };
    } catch (error: unknown) {
      return failure(
        "cache-failure",
        error instanceof Error ? error.message : "Unable to commit the feature cache",
      );
    }
  } catch (error: unknown) {
    return failure(
      "cache-failure",
      error instanceof Error ? error.message : "Unable to prepare the feature staging cache",
    );
  } finally {
    try {
      await dependencies.cacheStorage.delete(stagingName);
    } catch (error: unknown) {
      dependencies.reportCleanupFailure(error);
    }
  }
};

const inFlightAcquisitions = new WeakMap<
  RuntimeCacheStorage,
  Map<string, Promise<FeatureCacheAcquisition>>
>();

export const acquireFeatureAssets = (
  graph: FeatureAssetGraph,
  featureId: string,
  dependencies: FeatureCacheDependencies,
): Promise<FeatureCacheAcquisition> => {
  let byFeature = inFlightAcquisitions.get(dependencies.cacheStorage);
  if (byFeature === undefined) {
    byFeature = new Map();
    inFlightAcquisitions.set(dependencies.cacheStorage, byFeature);
  }
  const key = JSON.stringify([graph.buildVersion, featureId]);
  const active = byFeature.get(key);
  if (active !== undefined) return active;

  const pending = acquireFeatureAssetsTransaction(graph, featureId, dependencies);
  byFeature.set(key, pending);
  const release = (): void => {
    if (byFeature.get(key) !== pending) return;
    byFeature.delete(key);
    if (byFeature.size === 0) inFlightAcquisitions.delete(dependencies.cacheStorage);
  };
  void pending.then(release, release);
  return pending;
};

export const isDeclaredFeatureAsset = (
  graph: FeatureAssetGraph,
  requestUrl: string,
  baseUrl: string,
): boolean =>
  Object.values(graph.features).some(({ assets }) =>
    assets.some((asset) => new URL(asset, baseUrl).href === requestUrl),
  );

export const committedFeatureAsset = async (
  graph: FeatureAssetGraph,
  requestUrl: string,
  baseUrl: string,
  cacheStorage: RuntimeCacheStorage,
): Promise<Response | undefined> => {
  const owners = Object.entries(graph.features).filter(([, { assets }]) =>
    assets.some((asset) => new URL(asset, baseUrl).href === requestUrl),
  );
  if (owners.length === 0) return undefined;
  const cache = await cacheStorage.open(runtimeCacheName(graph.buildVersion));
  for (const [featureId, { assets }] of owners) {
    const absolute = absoluteAssets(baseUrl, assets);
    if (await isCommitted(cache, graph, featureId, absolute, baseUrl)) {
      return cache.match(requestUrl);
    }
  }
  return undefined;
};
