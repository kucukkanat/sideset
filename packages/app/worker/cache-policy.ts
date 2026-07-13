export const SHELL_CACHE_PREFIX = "keychain-shell-";
export const RUNTIME_CACHE_PREFIX = "keychain-runtime-";
export const RUNTIME_STAGING_CACHE_PREFIX = "keychain-runtime-staging-";

const VERSION_SEPARATOR = "::";

export const shellCacheName = (buildVersion: string, contentHash: string): string => {
  if (buildVersion.length === 0 || buildVersion.includes(VERSION_SEPARATOR)) {
    throw new TypeError("Build version is not cache-name safe");
  }
  if (contentHash.length === 0 || contentHash.includes(VERSION_SEPARATOR)) {
    throw new TypeError("Shell hash is not cache-name safe");
  }
  return `${SHELL_CACHE_PREFIX}${buildVersion}${VERSION_SEPARATOR}${contentHash}`;
};

export const runtimeStagingCacheName = (
  buildVersion: string,
  featureId: string,
  transactionId: string,
): string =>
  `${RUNTIME_STAGING_CACHE_PREFIX}${buildVersion}${VERSION_SEPARATOR}${featureId}${VERSION_SEPARATOR}${transactionId}`;

type ApplicationCacheKind = "runtime" | "shell" | "staging";

interface ApplicationCache {
  readonly kind: ApplicationCacheKind;
  readonly name: string;
  readonly buildVersion: string | null;
}

export interface RetainedAssetCache {
  readonly kind: "runtime" | "shell";
  readonly name: string;
  readonly buildVersion: string | null;
}

const beforeSeparator = (value: string): string | null => {
  const index = value.indexOf(VERSION_SEPARATOR);
  return index > 0 ? value.slice(0, index) : null;
};

const applicationCache = (name: string): ApplicationCache | null => {
  if (name.startsWith(RUNTIME_STAGING_CACHE_PREFIX)) {
    return {
      kind: "staging",
      name,
      buildVersion: beforeSeparator(name.slice(RUNTIME_STAGING_CACHE_PREFIX.length)),
    };
  }
  if (name.startsWith(SHELL_CACHE_PREFIX)) {
    return {
      kind: "shell",
      name,
      buildVersion: beforeSeparator(name.slice(SHELL_CACHE_PREFIX.length)),
    };
  }
  if (name.startsWith(RUNTIME_CACHE_PREFIX)) {
    const buildVersion = name.slice(RUNTIME_CACHE_PREFIX.length);
    return { kind: "runtime", name, buildVersion: buildVersion.length > 0 ? buildVersion : null };
  }
  return null;
};

export const cacheBuildVersion = (cacheName: string): string | null =>
  applicationCache(cacheName)?.buildVersion ?? null;

export const retainedAssetCaches = (
  cacheNames: readonly string[],
  currentShellCacheName: string,
  currentBuildVersion: string,
): readonly RetainedAssetCache[] =>
  cacheNames.toReversed().flatMap((name) => {
    const cache = applicationCache(name);
    if (
      cache === null ||
      cache.kind === "staging" ||
      cache.name === currentShellCacheName ||
      (cache.kind === "runtime" && cache.buildVersion === currentBuildVersion)
    ) {
      return [];
    }
    return [{ kind: cache.kind, name: cache.name, buildVersion: cache.buildVersion }];
  });

export interface CacheRetentionContext {
  readonly currentBuildVersion: string;
  readonly currentShellCacheName: string;
  readonly activeClientBuildVersions: readonly string[];
  readonly hasUnidentifiedClients: boolean;
}

export const obsoleteApplicationCaches = (
  cacheNames: readonly string[],
  context: CacheRetentionContext,
): readonly string[] => {
  if (context.hasUnidentifiedClients) return [];

  const caches = cacheNames.flatMap((name) => {
    const parsed = applicationCache(name);
    return parsed === null ? [] : [parsed];
  });
  const protectedVersions = new Set([
    context.currentBuildVersion,
    ...context.activeClientBuildVersions,
  ]);
  // CacheStorage.keys() preserves creation order, so the last eligible shell is the newest
  // rollback candidate without inventing an ordering for content-derived build IDs.
  const rollback = caches.findLast(
    (cache) =>
      cache.kind === "shell" &&
      cache.name !== context.currentShellCacheName &&
      (cache.buildVersion === null || !protectedVersions.has(cache.buildVersion)),
  );
  const runtimeRollback =
    rollback === undefined || rollback.buildVersion === null
      ? caches.findLast(
          (cache) =>
            cache.kind === "runtime" &&
            cache.buildVersion !== null &&
            !protectedVersions.has(cache.buildVersion),
        )
      : undefined;
  const rollbackVersion = rollback?.buildVersion ?? runtimeRollback?.buildVersion ?? null;
  const rollbackLegacyShell = rollback?.buildVersion === null ? rollback.name : null;
  const activeVersions = new Set(context.activeClientBuildVersions);

  return caches.flatMap((cache) => {
    if (cache.kind === "staging") {
      return cache.buildVersion !== null && activeVersions.has(cache.buildVersion)
        ? []
        : [cache.name];
    }
    if (cache.kind === "shell" && cache.name === context.currentShellCacheName) return [];
    if (cache.buildVersion === null) {
      return cache.name === rollbackLegacyShell ? [] : [cache.name];
    }
    return protectedVersions.has(cache.buildVersion) || cache.buildVersion === rollbackVersion
      ? []
      : [cache.name];
  });
};
