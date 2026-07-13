import { describe, expect, test } from "bun:test";
import {
  acquireFeatureWithTransport,
  browserTransport,
  featureAcquisitionResultFromResponse,
} from "../../src/app/features/acquisition.ts";
import {
  clientBuildVersionResponse,
  FEATURE_ACQUISITION_PROTOCOL_VERSION,
  matchingEnabledFeatureIds,
  parseClientBuildVersionQuery,
  parseClientBuildVersionResponse,
  updatePrewarmFeatureIds,
} from "../../worker/acquisition-protocol.ts";

const response = (
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> => ({
  type: "ACQUIRE_FEATURE_RESULT",
  protocolVersion: FEATURE_ACQUISITION_PROTOCOL_VERSION,
  requestId: "request-a",
  buildVersion: "build-a",
  featureId: "tools",
  status: "acquired",
  assetCount: 4,
  ...overrides,
});

describe("feature acquisition client policy", () => {
  test("answers a correlated worker query with build and enabled-feature state", () => {
    const query = {
      type: "QUERY_CLIENT_BUILD_VERSION",
      protocolVersion: FEATURE_ACQUISITION_PROTOCOL_VERSION,
      requestId: "version-request-a",
      workerBuildVersion: "build-b",
    } as const;
    expect(parseClientBuildVersionQuery(query)).toEqual(query);
    const reply = clientBuildVersionResponse("build-a", ["people", "tools", "tools"], query);
    expect(reply).toEqual({
      type: "CLIENT_BUILD_VERSION",
      protocolVersion: FEATURE_ACQUISITION_PROTOCOL_VERSION,
      requestId: "version-request-a",
      buildVersion: "build-a",
      enabledFeatureIds: ["people", "tools"],
    });
    expect(parseClientBuildVersionResponse(reply)).toEqual(reply);
    expect(clientBuildVersionResponse("build-a", [], { ...query, requestId: "" })).toBeNull();
    expect(
      parseClientBuildVersionResponse({ ...reply, enabledFeatureIds: ["x".repeat(101)] }),
    ).toBeNull();
  });

  test("selects each enabled feature present in the new worker graph", () => {
    const graph = {
      schemaVersion: 1,
      buildVersion: "build-b",
      features: { tools: { assets: ["./tools.js"] }, compact: { assets: ["./compact.js"] } },
    } as const;
    expect(
      matchingEnabledFeatureIds(graph, [
        { enabledFeatureIds: ["people", "tools"] },
        { enabledFeatureIds: ["tools", "compact", "removed"] },
      ]),
    ).toEqual(["tools", "compact"]);
    expect(updatePrewarmFeatureIds(graph, [{ enabledFeatureIds: ["tools"] }, null])).toEqual([
      "tools",
      "compact",
    ]);
    expect(updatePrewarmFeatureIds(graph, [])).toEqual([]);
  });

  test("reports unsupported environments without starting a transport", async () => {
    expect(await acquireFeatureWithTransport("tools", "build-a", null)).toEqual({
      status: "unsupported",
      featureId: "tools",
      reason: "service-worker-unavailable",
      offlineReady: false,
    });
    expect(await acquireFeatureWithTransport("tools", null, null)).toEqual({
      status: "unsupported",
      featureId: "tools",
      reason: "build-metadata-unavailable",
      offlineReady: false,
    });
  });

  test("does not contact a worker when readiness resolves after the request timed out", async () => {
    const ready = Promise.withResolvers<ServiceWorkerRegistration>();
    let posts = 0;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: ready.promise },
    });
    try {
      const transport = browserTransport(0);
      if (transport === null) throw new Error("Expected a service-worker transport");
      const pending = transport.send({
        type: "ACQUIRE_FEATURE",
        protocolVersion: FEATURE_ACQUISITION_PROTOCOL_VERSION,
        requestId: "late-worker",
        buildVersion: "build-a",
        featureId: "tools",
      });
      expect(await pending).toMatchObject({ ok: false, code: "timeout" });

      ready.resolve({
        active: {
          postMessage: () => {
            posts += 1;
          },
        },
      } as unknown as ServiceWorkerRegistration);
      await Promise.resolve();
      expect(posts).toBe(0);
    } finally {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
  });

  test("accepts only a correlated worker success", () => {
    expect(
      featureAcquisitionResultFromResponse("tools", "build-a", "request-a", response()),
    ).toEqual({
      status: "acquired",
      featureId: "tools",
      buildVersion: "build-a",
      assetCount: 4,
      offlineReady: true,
    });
    expect(
      featureAcquisitionResultFromResponse(
        "tools",
        "build-a",
        "request-a",
        response({ requestId: "stale" }),
      ),
    ).toMatchObject({ status: "failed", code: "invalid-response", offlineReady: false });
  });

  test("preserves typed worker failures, including an update mismatch", () => {
    expect(
      featureAcquisitionResultFromResponse(
        "tools",
        "build-a",
        "request-a",
        response({ status: "failed", code: "network-failure", message: "offline" }),
      ),
    ).toMatchObject({
      status: "failed",
      code: "network-failure",
      message: "offline",
      offlineReady: false,
    });
    expect(
      featureAcquisitionResultFromResponse(
        "tools",
        "build-a",
        "request-a",
        response({
          buildVersion: "build-b",
          status: "failed",
          code: "version-mismatch",
          message: "update required",
        }),
      ),
    ).toMatchObject({ status: "failed", code: "version-mismatch" });
  });
});
