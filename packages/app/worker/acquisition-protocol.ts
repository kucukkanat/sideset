export const FEATURE_ACQUISITION_PROTOCOL_VERSION = 1 as const;

export interface FeatureAssetGraph {
  readonly schemaVersion: 1;
  readonly buildVersion: string;
  readonly features: Readonly<Record<string, { readonly assets: readonly string[] }>>;
}

export interface AcquireFeatureRequest {
  readonly type: "ACQUIRE_FEATURE";
  readonly protocolVersion: typeof FEATURE_ACQUISITION_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly buildVersion: string;
  readonly featureId: string;
}

export interface ClientBuildVersionQuery {
  readonly type: "QUERY_CLIENT_BUILD_VERSION";
  readonly protocolVersion: typeof FEATURE_ACQUISITION_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly workerBuildVersion: string;
}

export interface ClientBuildVersionResponse {
  readonly type: "CLIENT_BUILD_VERSION";
  readonly protocolVersion: typeof FEATURE_ACQUISITION_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly buildVersion: string;
  readonly enabledFeatureIds: readonly string[];
}

export const matchingEnabledFeatureIds = (
  graph: FeatureAssetGraph,
  clientStates: readonly Pick<ClientBuildVersionResponse, "enabledFeatureIds">[],
): readonly string[] => [
  ...new Set(
    clientStates
      .flatMap(({ enabledFeatureIds }) => enabledFeatureIds)
      .filter((featureId) => Object.hasOwn(graph.features, featureId)),
  ),
];

/** An unidentified live page may be a pre-protocol client, so preserve every optional graph. */
export const updatePrewarmFeatureIds = (
  graph: FeatureAssetGraph,
  clientStates: readonly (Pick<ClientBuildVersionResponse, "enabledFeatureIds"> | null)[],
): readonly string[] =>
  clientStates.some((state) => state === null)
    ? Object.keys(graph.features)
    : matchingEnabledFeatureIds(
        graph,
        clientStates.filter(
          (state): state is Pick<ClientBuildVersionResponse, "enabledFeatureIds"> => state !== null,
        ),
      );

export type WorkerAcquisitionFailureCode =
  | "cache-failure"
  | "network-failure"
  | "unknown-feature"
  | "version-mismatch";

interface AcquireFeatureResponseBase {
  readonly type: "ACQUIRE_FEATURE_RESULT";
  readonly protocolVersion: typeof FEATURE_ACQUISITION_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly buildVersion: string;
  readonly featureId: string;
}

export type AcquireFeatureResponse =
  | (AcquireFeatureResponseBase & {
      readonly status: "acquired";
      readonly assetCount: number;
    })
  | (AcquireFeatureResponseBase & {
      readonly status: "failed";
      readonly code: WorkerAcquisitionFailureCode;
      readonly message: string;
    });

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const featureIds = (value: unknown): readonly string[] | null => {
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    !value.every((id) => typeof id === "string" && id.length > 0 && id.length <= 100)
  ) {
    return null;
  }
  return [...new Set(value)];
};

export const parseAcquireFeatureRequest = (value: unknown): AcquireFeatureRequest | null => {
  const candidate = record(value);
  if (
    candidate === null ||
    candidate.type !== "ACQUIRE_FEATURE" ||
    candidate.protocolVersion !== FEATURE_ACQUISITION_PROTOCOL_VERSION ||
    !nonEmptyString(candidate.requestId) ||
    !nonEmptyString(candidate.buildVersion) ||
    !nonEmptyString(candidate.featureId)
  ) {
    return null;
  }
  return {
    type: "ACQUIRE_FEATURE",
    protocolVersion: FEATURE_ACQUISITION_PROTOCOL_VERSION,
    requestId: candidate.requestId,
    buildVersion: candidate.buildVersion,
    featureId: candidate.featureId,
  };
};

export const parseClientBuildVersionQuery = (value: unknown): ClientBuildVersionQuery | null => {
  const candidate = record(value);
  if (
    candidate === null ||
    candidate.type !== "QUERY_CLIENT_BUILD_VERSION" ||
    candidate.protocolVersion !== FEATURE_ACQUISITION_PROTOCOL_VERSION ||
    !nonEmptyString(candidate.requestId) ||
    !nonEmptyString(candidate.workerBuildVersion)
  ) {
    return null;
  }
  return {
    type: "QUERY_CLIENT_BUILD_VERSION",
    protocolVersion: FEATURE_ACQUISITION_PROTOCOL_VERSION,
    requestId: candidate.requestId,
    workerBuildVersion: candidate.workerBuildVersion,
  };
};

export const parseClientBuildVersionResponse = (
  value: unknown,
): ClientBuildVersionResponse | null => {
  const candidate = record(value);
  const enabledFeatureIds = featureIds(candidate?.enabledFeatureIds);
  if (
    candidate === null ||
    candidate.type !== "CLIENT_BUILD_VERSION" ||
    candidate.protocolVersion !== FEATURE_ACQUISITION_PROTOCOL_VERSION ||
    !nonEmptyString(candidate.requestId) ||
    !nonEmptyString(candidate.buildVersion) ||
    enabledFeatureIds === null
  ) {
    return null;
  }
  return {
    type: "CLIENT_BUILD_VERSION",
    protocolVersion: FEATURE_ACQUISITION_PROTOCOL_VERSION,
    requestId: candidate.requestId,
    buildVersion: candidate.buildVersion,
    enabledFeatureIds,
  };
};

export const clientBuildVersionResponse = (
  currentBuildVersion: string,
  currentEnabledFeatureIds: readonly string[],
  value: unknown,
): ClientBuildVersionResponse | null => {
  const query = record(value);
  const enabledFeatureIds = featureIds(currentEnabledFeatureIds);
  if (
    currentBuildVersion.length === 0 ||
    enabledFeatureIds === null ||
    query === null ||
    query.type !== "QUERY_CLIENT_BUILD_VERSION" ||
    query.protocolVersion !== FEATURE_ACQUISITION_PROTOCOL_VERSION ||
    !nonEmptyString(query.requestId) ||
    !nonEmptyString(query.workerBuildVersion)
  ) {
    return null;
  }
  return {
    type: "CLIENT_BUILD_VERSION",
    protocolVersion: FEATURE_ACQUISITION_PROTOCOL_VERSION,
    requestId: query.requestId,
    buildVersion: currentBuildVersion,
    enabledFeatureIds,
  };
};

const FAILURE_CODES: ReadonlySet<WorkerAcquisitionFailureCode> = new Set([
  "cache-failure",
  "network-failure",
  "unknown-feature",
  "version-mismatch",
]);

export const parseAcquireFeatureResponse = (value: unknown): AcquireFeatureResponse | null => {
  const candidate = record(value);
  if (
    candidate === null ||
    candidate.type !== "ACQUIRE_FEATURE_RESULT" ||
    candidate.protocolVersion !== FEATURE_ACQUISITION_PROTOCOL_VERSION ||
    !nonEmptyString(candidate.requestId) ||
    !nonEmptyString(candidate.buildVersion) ||
    !nonEmptyString(candidate.featureId)
  ) {
    return null;
  }
  const base: AcquireFeatureResponseBase = {
    type: "ACQUIRE_FEATURE_RESULT",
    protocolVersion: FEATURE_ACQUISITION_PROTOCOL_VERSION,
    requestId: candidate.requestId,
    buildVersion: candidate.buildVersion,
    featureId: candidate.featureId,
  };
  if (
    candidate.status === "acquired" &&
    typeof candidate.assetCount === "number" &&
    Number.isSafeInteger(candidate.assetCount) &&
    candidate.assetCount >= 0
  ) {
    return { ...base, status: "acquired", assetCount: candidate.assetCount };
  }
  if (
    candidate.status === "failed" &&
    typeof candidate.code === "string" &&
    FAILURE_CODES.has(candidate.code as WorkerAcquisitionFailureCode) &&
    nonEmptyString(candidate.message)
  ) {
    return {
      ...base,
      status: "failed",
      code: candidate.code as WorkerAcquisitionFailureCode,
      message: candidate.message,
    };
  }
  return null;
};
