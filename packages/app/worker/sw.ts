import {
  type AcquireFeatureResponse,
  type ClientBuildVersionQuery,
  type ClientBuildVersionResponse,
  FEATURE_ACQUISITION_PROTOCOL_VERSION,
  type FeatureAssetGraph,
  parseAcquireFeatureRequest,
  parseClientBuildVersionResponse,
  updatePrewarmFeatureIds,
} from "./acquisition-protocol.ts";
import { obsoleteApplicationCaches, retainedAssetCaches } from "./cache-policy.ts";
import {
  acquireFeatureAssets,
  committedFeatureAsset,
  committedRuntimeAsset,
  isDeclaredFeatureAsset,
  isValidFeatureAssetResponse,
} from "./feature-cache.ts";

declare const APP_CACHE_NAME: string;
declare const APP_SHELL: readonly string[];
declare const FEATURE_ASSET_GRAPH: FeatureAssetGraph;

const worker = globalThis as unknown as ServiceWorkerGlobalScope;
const CLIENT_VERSION_TIMEOUT_MS = 1_500;
const cacheableDestinations: ReadonlySet<string> = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "style",
]);
const currentShellAssetUrls: ReadonlySet<string> = new Set(
  APP_SHELL.map((path) => new URL(path, worker.registration.scope).href),
);

const canCache = (response: Response): boolean =>
  response.ok && (response.type === "basic" || response.type === "default");

const retainedAssetResponse = async (request: Request): Promise<Response | undefined> => {
  const names = await caches.keys();
  for (const retained of retainedAssetCaches(
    names,
    APP_CACHE_NAME,
    FEATURE_ASSET_GRAPH.buildVersion,
  )) {
    try {
      const cache = await caches.open(retained.name);
      const response =
        retained.kind === "shell"
          ? await cache.match(request.url)
          : retained.buildVersion === null
            ? undefined
            : await committedRuntimeAsset(cache, retained.buildVersion, request.url);
      if (response !== undefined && isValidFeatureAssetResponse(request.url, response)) {
        return response;
      }
    } catch (error: unknown) {
      console.error(`Unable to read retained cache: ${retained.name}`, error);
    }
  }
  return undefined;
};

const navigationResponse = async (request: Request): Promise<Response> => {
  const cache = await caches.open(APP_CACHE_NAME);
  try {
    return await fetch(request);
  } catch (error: unknown) {
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ??
      (await cache.match("./index.html")) ??
      (await cache.match("./"));
    if (cached) return cached;
    throw new Error("The offline app shell is unavailable", { cause: error });
  }
};

const assetResponse = async (request: Request): Promise<Response> => {
  const cache = await caches.open(APP_CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const baseUrl = worker.registration.scope;
  if (isDeclaredFeatureAsset(FEATURE_ASSET_GRAPH, request.url, baseUrl)) {
    try {
      const runtime = await committedFeatureAsset(
        FEATURE_ASSET_GRAPH,
        request.url,
        baseUrl,
        caches,
      );
      if (runtime !== undefined) return runtime;
    } catch (error: unknown) {
      console.error("Unable to read the acquired feature cache", error);
    }
  }

  const retained = await retainedAssetResponse(request);
  if (retained !== undefined) return retained;

  const response = await fetch(request);
  // Import evaluation and offline acquisition are deliberately separate. Only generated shell
  // assets can repopulate the shell cache; old or optional chunks never leak into it.
  if (canCache(response) && currentShellAssetUrls.has(request.url)) {
    await cache.put(request, response.clone());
  }
  return response;
};

const queryClientBuildVersion = (client: Client): Promise<ClientBuildVersionResponse | null> =>
  new Promise((resolve) => {
    const channel = new MessageChannel();
    const request: ClientBuildVersionQuery = {
      type: "QUERY_CLIENT_BUILD_VERSION",
      protocolVersion: FEATURE_ACQUISITION_PROTOCOL_VERSION,
      requestId: `${FEATURE_ASSET_GRAPH.buildVersion}:${client.id}`,
      workerBuildVersion: FEATURE_ASSET_GRAPH.buildVersion,
    };
    let settled = false;
    const finish = (response: ClientBuildVersionResponse | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      channel.port1.close();
      resolve(response);
    };
    const timeout = setTimeout(() => finish(null), CLIENT_VERSION_TIMEOUT_MS);
    channel.port1.onmessage = (event) => {
      const response = parseClientBuildVersionResponse(event.data);
      finish(response?.requestId === request.requestId ? response : null);
    };
    channel.port1.onmessageerror = () => finish(null);
    try {
      client.postMessage(request, [channel.port2]);
    } catch (error: unknown) {
      console.error(`Unable to query client build version: ${client.id}`, error);
      finish(null);
    }
  });

const acquireDeclaredFeature = (featureId: string, transactionId: string) =>
  acquireFeatureAssets(FEATURE_ASSET_GRAPH, featureId, {
    baseUrl: worker.registration.scope,
    cacheStorage: caches,
    fetchAsset: (url) =>
      fetch(
        new Request(url, {
          cache: "reload",
          credentials: "same-origin",
        }),
      ),
    reportCleanupFailure: (error) =>
      console.error("Unable to remove the feature staging cache", error),
    transactionId,
  });

const acquireEnabledFeatureUpdates = async (
  clientStates: readonly (ClientBuildVersionResponse | null)[],
): Promise<void> => {
  const enabledFeatureIds = updatePrewarmFeatureIds(FEATURE_ASSET_GRAPH, clientStates);
  for (const featureId of enabledFeatureIds) {
    if (!Object.hasOwn(FEATURE_ASSET_GRAPH.features, featureId)) continue;
    const result = await acquireDeclaredFeature(featureId, `update-${featureId}`);
    if (!result.ok) throw new Error(`Unable to update ${featureId}: ${result.message}`);
  }
};

worker.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE_NAME);
      await cache.addAll([...APP_SHELL]);
      await worker.skipWaiting();
    })(),
  );
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const initialClients = await worker.clients.matchAll({
        includeUncontrolled: true,
        type: "window",
      });
      const initialClientStates = await Promise.all(initialClients.map(queryClientBuildVersion));
      // Preserve enabled offline features before this worker takes control of existing pages.
      await acquireEnabledFeatureUpdates(initialClientStates);
      await worker.clients.claim();
      // A second snapshot closes the navigation race and catches a client created during prewarm.
      const clients = await worker.clients.matchAll({ includeUncontrolled: true, type: "window" });
      const clientStates = await Promise.all(clients.map(queryClientBuildVersion));
      await acquireEnabledFeatureUpdates(clientStates);
      const names = await caches.keys();
      const obsolete = obsoleteApplicationCaches(names, {
        currentBuildVersion: FEATURE_ASSET_GRAPH.buildVersion,
        currentShellCacheName: APP_CACHE_NAME,
        activeClientBuildVersions: clientStates.flatMap((state) =>
          state === null ? [] : [state.buildVersion],
        ),
        hasUnidentifiedClients: clientStates.some((state) => state === null),
      });
      await Promise.all(obsolete.map((name) => caches.delete(name)));
    })(),
  );
});

worker.addEventListener("message", (event) => {
  const request = parseAcquireFeatureRequest(event.data);
  const port = event.ports[0];
  if (request === null || port === undefined) return;

  event.waitUntil(
    (async () => {
      const base = {
        type: "ACQUIRE_FEATURE_RESULT",
        protocolVersion: FEATURE_ACQUISITION_PROTOCOL_VERSION,
        requestId: request.requestId,
        buildVersion: FEATURE_ASSET_GRAPH.buildVersion,
        featureId: request.featureId,
      } as const;
      let response: AcquireFeatureResponse;
      if (request.buildVersion !== FEATURE_ASSET_GRAPH.buildVersion) {
        response = {
          ...base,
          status: "failed",
          code: "version-mismatch",
          message: "The page and service worker use different builds",
        };
      } else {
        const result = await acquireDeclaredFeature(request.featureId, request.requestId);
        response = result.ok
          ? { ...base, status: "acquired", assetCount: result.assetCount }
          : { ...base, status: "failed", code: result.code, message: result.message };
      }
      port.postMessage(response);
    })(),
  );
});

worker.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== worker.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (!url.pathname.endsWith("/sw.js") && cacheableDestinations.has(request.destination)) {
    event.respondWith(assetResponse(request));
  }
});
