import {
  type AcquireFeatureRequest,
  clientBuildVersionResponse,
  FEATURE_ACQUISITION_PROTOCOL_VERSION,
  parseAcquireFeatureResponse,
  type WorkerAcquisitionFailureCode,
} from "../../../worker/acquisition-protocol.ts";
import type { RegisteredFeature } from "./registry.ts";

declare const APP_BUILD_VERSION: string;

export type AcquirableFeatureId = Extract<RegisteredFeature, { readonly load: unknown }>["id"];

export type FeatureAcquisitionFailureCode =
  | WorkerAcquisitionFailureCode
  | "channel-failure"
  | "invalid-response"
  | "timeout"
  | "worker-unavailable";

export type FeatureAcquisitionResult =
  | {
      readonly status: "acquired";
      readonly featureId: AcquirableFeatureId;
      readonly buildVersion: string;
      readonly assetCount: number;
      readonly offlineReady: true;
    }
  | {
      readonly status: "unsupported";
      readonly featureId: AcquirableFeatureId;
      readonly reason: "build-metadata-unavailable" | "service-worker-unavailable";
      readonly offlineReady: false;
    }
  | {
      readonly status: "failed";
      readonly featureId: AcquirableFeatureId;
      readonly code: FeatureAcquisitionFailureCode;
      readonly message: string;
      readonly offlineReady: false;
    };

export type FeatureAcquisitionTransportResult =
  | { readonly ok: true; readonly response: unknown }
  | {
      readonly ok: false;
      readonly code: "channel-failure" | "timeout" | "worker-unavailable";
      readonly message: string;
    };

export interface FeatureAcquisitionTransport {
  readonly send: (request: AcquireFeatureRequest) => Promise<FeatureAcquisitionTransportResult>;
}

const failed = (
  featureId: AcquirableFeatureId,
  code: FeatureAcquisitionFailureCode,
  message: string,
): FeatureAcquisitionResult => ({
  status: "failed",
  featureId,
  code,
  message,
  offlineReady: false,
});

const buildVersion = (): string | null =>
  typeof APP_BUILD_VERSION === "string" && APP_BUILD_VERSION.length > 0 ? APP_BUILD_VERSION : null;

const noEnabledFeatures = (): readonly string[] => [];

export const installServiceWorkerBuildVersionResponder = (
  enabledFeatureIds: () => readonly string[] = noEnabledFeatures,
): void => {
  const currentBuildVersion = buildVersion();
  if (currentBuildVersion === null || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", (event) => {
    const response = clientBuildVersionResponse(
      currentBuildVersion,
      enabledFeatureIds(),
      event.data,
    );
    if (response !== null) event.ports[0]?.postMessage(response);
  });
};

export const browserTransport = (timeoutMs: number): FeatureAcquisitionTransport | null => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return {
    send: async (request) => {
      return new Promise<FeatureAcquisitionTransportResult>((resolve) => {
        let channel: MessageChannel | null = null;
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const finish = (result: FeatureAcquisitionTransportResult): void => {
          if (settled) return;
          settled = true;
          if (timeout !== null) clearTimeout(timeout);
          channel?.port1.close();
          resolve(result);
        };
        timeout = setTimeout(
          () =>
            finish({
              ok: false,
              code: "timeout",
              message: "Feature acquisition timed out",
            }),
          timeoutMs,
        );
        void navigator.serviceWorker.ready
          .then((registration) => {
            if (settled) return;
            const active = registration.active;
            if (active === null) {
              finish({
                ok: false,
                code: "worker-unavailable",
                message: "The active service worker is unavailable",
              });
              return;
            }
            channel = new MessageChannel();
            channel.port1.onmessage = (event) => finish({ ok: true, response: event.data });
            channel.port1.onmessageerror = () =>
              finish({
                ok: false,
                code: "channel-failure",
                message: "The service worker returned an unreadable response",
              });
            try {
              active.postMessage(request, [channel.port2]);
            } catch (error: unknown) {
              finish({
                ok: false,
                code: "channel-failure",
                message:
                  error instanceof Error ? error.message : "Unable to contact the service worker",
              });
            }
          })
          .catch((error: unknown) =>
            finish({
              ok: false,
              code: "worker-unavailable",
              message: error instanceof Error ? error.message : "The service worker is not ready",
            }),
          );
      });
    },
  };
};

export const acquireFeatureWithTransport = async (
  featureId: AcquirableFeatureId,
  currentBuildVersion: string | null,
  transport: FeatureAcquisitionTransport | null,
): Promise<FeatureAcquisitionResult> => {
  if (currentBuildVersion === null) {
    return {
      status: "unsupported",
      featureId,
      reason: "build-metadata-unavailable",
      offlineReady: false,
    };
  }
  if (transport === null) {
    return {
      status: "unsupported",
      featureId,
      reason: "service-worker-unavailable",
      offlineReady: false,
    };
  }
  let request: AcquireFeatureRequest;
  try {
    request = {
      type: "ACQUIRE_FEATURE",
      protocolVersion: FEATURE_ACQUISITION_PROTOCOL_VERSION,
      requestId: crypto.randomUUID(),
      buildVersion: currentBuildVersion,
      featureId,
    };
  } catch (error: unknown) {
    return failed(
      featureId,
      "channel-failure",
      error instanceof Error ? error.message : "Unable to create an acquisition request",
    );
  }
  let transportResult: FeatureAcquisitionTransportResult;
  try {
    transportResult = await transport.send(request);
  } catch (error: unknown) {
    return failed(
      featureId,
      "channel-failure",
      error instanceof Error ? error.message : "Unable to contact the service worker",
    );
  }
  if (!transportResult.ok) {
    return failed(featureId, transportResult.code, transportResult.message);
  }
  return featureAcquisitionResultFromResponse(
    featureId,
    request.buildVersion,
    request.requestId,
    transportResult.response,
  );
};

export const featureAcquisitionResultFromResponse = (
  featureId: AcquirableFeatureId,
  currentBuildVersion: string,
  requestId: string,
  value: unknown,
): FeatureAcquisitionResult => {
  const response = parseAcquireFeatureResponse(value);
  if (
    response === null ||
    response.requestId !== requestId ||
    response.featureId !== featureId ||
    (response.buildVersion !== currentBuildVersion &&
      !(response.status === "failed" && response.code === "version-mismatch"))
  ) {
    return failed(
      featureId,
      "invalid-response",
      "The service worker response did not match the request",
    );
  }
  if (response.status === "failed") {
    return failed(featureId, response.code, response.message);
  }
  return {
    status: "acquired",
    featureId,
    buildVersion: response.buildVersion,
    assetCount: response.assetCount,
    offlineReady: true,
  };
};

export const acquireFeature = (featureId: AcquirableFeatureId): Promise<FeatureAcquisitionResult> =>
  acquireFeatureWithTransport(featureId, buildVersion(), browserTransport(30_000));
