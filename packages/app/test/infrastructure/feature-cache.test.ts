import { describe, expect, test } from "bun:test";
import type { FeatureAssetGraph } from "../../worker/acquisition-protocol.ts";
import {
  acquireFeatureAssets,
  type FeatureCacheDependencies,
  isDeclaredFeatureAsset,
  isValidFeatureAssetResponse,
  markerCommitsAsset,
  type RuntimeCache,
  type RuntimeCacheStorage,
  runtimeCacheName,
} from "../../worker/feature-cache.ts";

const GRAPH: FeatureAssetGraph = {
  schemaVersion: 1,
  buildVersion: "build-a",
  features: { tools: { assets: ["./tools.js", "./tools.css", "./icon.png"] } },
};
const BASE_URL = "https://wallet.test/app/";

class MemoryRuntimeCache implements RuntimeCache {
  readonly #values = new Map<string, Response>();

  async delete(request: string): Promise<boolean> {
    return this.#values.delete(request);
  }

  async keys(): Promise<readonly Request[]> {
    return [...this.#values.keys()].map((url) => new Request(url));
  }

  async match(request: string): Promise<Response | undefined> {
    return this.#values.get(request)?.clone();
  }

  async put(request: string, response: Response): Promise<void> {
    this.#values.set(request, response.clone());
  }
}

class MemoryRuntimeCacheStorage implements RuntimeCacheStorage {
  readonly #caches = new Map<string, MemoryRuntimeCache>();

  async delete(cacheName: string): Promise<boolean> {
    return this.#caches.delete(cacheName);
  }

  async open(cacheName: string): Promise<MemoryRuntimeCache> {
    const existing = this.#caches.get(cacheName);
    if (existing !== undefined) return existing;
    const created = new MemoryRuntimeCache();
    this.#caches.set(cacheName, created);
    return created;
  }
}

const acquisitionDependencies = (
  cacheStorage: RuntimeCacheStorage,
  transactionId: string,
  fetchAsset: FeatureCacheDependencies["fetchAsset"],
): FeatureCacheDependencies => ({
  baseUrl: BASE_URL,
  cacheStorage,
  fetchAsset,
  reportCleanupFailure: () => undefined,
  transactionId,
});

describe("feature cache policy", () => {
  test("uses versioned runtime caches and recognizes only generated assets", () => {
    expect(runtimeCacheName(GRAPH.buildVersion)).toBe("keychain-runtime-build-a");
    expect(isDeclaredFeatureAsset(GRAPH, new URL("./tools.js", BASE_URL).href, BASE_URL)).toBe(
      true,
    );
    expect(isDeclaredFeatureAsset(GRAPH, new URL("./unknown.js", BASE_URL).href, BASE_URL)).toBe(
      false,
    );
  });

  test("rejects successful HTML fallbacks and mismatched asset media types", () => {
    const html = new Response("<html>fallback</html>", {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    expect(isValidFeatureAssetResponse(new URL("./tools.js", BASE_URL).href, html)).toBe(false);
    expect(
      isValidFeatureAssetResponse(
        new URL("./tools.js", BASE_URL).href,
        new Response("export {}", { headers: { "content-type": "text/javascript" } }),
      ),
    ).toBe(true);
    expect(
      isValidFeatureAssetResponse(
        new URL("./tools.css", BASE_URL).href,
        new Response(".tools {}", { headers: { "content-type": "text/css" } }),
      ),
    ).toBe(true);
    expect(
      isValidFeatureAssetResponse(
        new URL("./icon.png", BASE_URL).href,
        new Response("not found", {
          status: 404,
          headers: { "content-type": "image/png" },
        }),
      ),
    ).toBe(false);
  });

  test("serves a retained runtime asset only from its committed versioned closure", () => {
    const toolsUrl = new URL("./tools.js", BASE_URL).href;
    const marker = {
      schemaVersion: 1,
      buildVersion: "build-a",
      featureId: "tools",
      assets: [toolsUrl, new URL("./tools.css", BASE_URL).href],
    } as const;
    expect(markerCommitsAsset(marker, "build-a", toolsUrl)).toBe(true);
    expect(markerCommitsAsset(marker, "build-b", toolsUrl)).toBe(false);
    expect(markerCommitsAsset(marker, "build-a", new URL("./unknown.js", BASE_URL).href)).toBe(
      false,
    );
  });

  test("coalesces concurrent failure and releases the feature lock for retry", async () => {
    const storage = new MemoryRuntimeCacheStorage();
    const response = Promise.withResolvers<Response>();
    let failedFetches = 0;
    const fetchFailure = (): Promise<Response> => {
      failedFetches += 1;
      return response.promise;
    };
    const first = acquireFeatureAssets(
      GRAPH,
      "tools",
      acquisitionDependencies(storage, "first", fetchFailure),
    );
    const concurrent = acquireFeatureAssets(
      GRAPH,
      "tools",
      acquisitionDependencies(storage, "concurrent", fetchFailure),
    );
    expect(concurrent).toBe(first);
    response.resolve(
      new Response("offline", {
        status: 503,
        headers: { "content-type": "text/javascript" },
      }),
    );
    const results = await Promise.all([first, concurrent]);
    expect(failedFetches).toBe(1);
    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toMatchObject({ ok: false, code: "network-failure" });

    let retryFetches = 0;
    const retry = await acquireFeatureAssets(
      GRAPH,
      "tools",
      acquisitionDependencies(storage, "retry", async (url) => {
        retryFetches += 1;
        const contentType = url.endsWith(".js")
          ? "text/javascript"
          : url.endsWith(".css")
            ? "text/css"
            : "image/png";
        return new Response("asset", { headers: { "content-type": contentType } });
      }),
    );
    expect(retry).toEqual({ ok: true, assetCount: 3 });
    expect(retryFetches).toBe(3);
  });
});
