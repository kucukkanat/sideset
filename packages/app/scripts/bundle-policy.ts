export const CORE_INSTALL_ASSETS = [
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
] as const;

const KIB = 1024;
const MIB = KIB * KIB;

export interface ByteSize {
  readonly rawBytes: number;
  readonly gzipBytes: number;
}

export interface ByteLimits {
  readonly rawBytes?: number;
  readonly gzipBytes?: number;
}

export interface BundleMetric {
  readonly current: ByteSize;
  readonly ratchet: ByteLimits;
  readonly target: ByteLimits;
  readonly withinRatchet: boolean;
  readonly atTarget: boolean;
}

export interface BundleException {
  readonly metric: "featureAcquisitionGraph";
  readonly featureId: string;
  readonly owner: string;
  readonly expiresOn: `${number}-${number}-${number}`;
  readonly reason: string;
}

export const BUNDLE_LIMITS = {
  startupJavaScript: {
    ratchet: { gzipBytes: 308_950 },
    target: { gzipBytes: 200 * KIB },
  },
  startupCss: {
    ratchet: { gzipBytes: 15 * KIB },
    target: { gzipBytes: 15 * KIB },
  },
  coreInstallGraph: {
    ratchet: { rawBytes: 2_132_375, gzipBytes: 1_434_200 },
    target: { rawBytes: 1.5 * MIB, gzipBytes: 750 * KIB },
  },
  largestAsyncChunk: {
    ratchet: { gzipBytes: 125 * KIB },
    target: { gzipBytes: 125 * KIB },
  },
  serviceWorkerJavaScript: {
    ratchet: { gzipBytes: 15 * KIB },
    target: { gzipBytes: 15 * KIB },
  },
  featureAcquisitionGraph: {
    ratchet: { rawBytes: 452_623, gzipBytes: 141_218 },
    target: { gzipBytes: 75 * KIB },
  },
  totalShippedJavaScript: {
    ratchet: { gzipBytes: 750 * KIB },
    target: { gzipBytes: 750 * KIB },
  },
} as const;

export const BUNDLE_EXCEPTIONS = [
  {
    metric: "featureAcquisitionGraph",
    featureId: "tools",
    owner: "Tools",
    expiresOn: "2026-10-01",
    reason: "StegCloak keeps the current Tools acquisition graph above the 75 KiB target.",
  },
] as const satisfies readonly BundleException[];

export const canonicalizeBuildVersion = (contents: string, buildVersion: string): string =>
  buildVersion.length === 0
    ? contents
    : contents.replaceAll(buildVersion, "0".repeat(buildVersion.length));

export const featureTargetExceptionFailures = (
  metrics: Readonly<Record<string, Pick<BundleMetric, "atTarget">>>,
  currentDate: string,
  exceptions: readonly BundleException[] = BUNDLE_EXCEPTIONS,
): readonly string[] => {
  const activeFeatures = new Set(
    exceptions
      .filter(({ expiresOn }) => expiresOn >= currentDate)
      .map(({ featureId }) => featureId),
  );
  return [
    ...exceptions.flatMap(({ expiresOn, featureId }) =>
      expiresOn < currentDate ? [`exceptions.expired.${featureId}`] : [],
    ),
    ...Object.entries(metrics).flatMap(([featureId, metric]) =>
      !metric.atTarget && !activeFeatures.has(featureId)
        ? [`featureTargets.unapproved.${featureId}`]
        : [],
    ),
  ];
};

interface OutputMetadata {
  readonly cssBundle?: string;
  readonly entryPoint?: string;
  readonly imports: readonly {
    readonly path: string;
    readonly kind: Bun.BuildMetafile["outputs"][string]["imports"][number]["kind"];
  }[];
}

export interface FeatureRuntimeEntry {
  readonly id: string;
  readonly entryPoint: string;
}

export type FeatureAssetOwnership = Readonly<Record<string, readonly string[]>>;

export interface FeatureAssetGraph {
  readonly schemaVersion: 1;
  readonly buildVersion: string;
  readonly features: Readonly<Record<string, { readonly assets: readonly string[] }>>;
}

export interface OutputClassification {
  readonly staticPaths: readonly string[];
  readonly dynamicPaths: readonly string[];
}

export interface ArtifactClassification {
  readonly shellPaths: readonly string[];
  readonly optionalPaths: readonly string[];
}

export const discoverFeatureRuntimeEntries = (
  outputs: Readonly<Record<string, OutputMetadata>>,
  outputGraph: OutputClassification,
): readonly FeatureRuntimeEntry[] => {
  const graph = new Map(
    Object.entries(outputs).map(([path, output]) => [normalizedPath(path), output] as const),
  );
  const roots = outputGraph.staticPaths.flatMap((path) =>
    (graph.get(normalizedPath(path))?.imports ?? []).flatMap((imported) =>
      imported.kind === "dynamic-import" ? [normalizedPath(imported.path)] : [],
    ),
  );
  const entries = roots.flatMap((root): readonly FeatureRuntimeEntry[] => {
    const entryPoint = graph.get(root)?.entryPoint;
    const id = entryPoint?.match(/(?:^|\/)src\/features\/([^/]+)\//u)?.[1];
    return entryPoint === undefined || id === undefined ? [] : [{ id, entryPoint }];
  });
  const ids = new Set<string>();
  for (const { id } of entries) {
    if (ids.has(id)) throw new Error(`Feature has multiple runtime roots: ${id}`);
    ids.add(id);
  }
  return entries.toSorted((left, right) => left.id.localeCompare(right.id));
};

const normalizedPath = (path: string): string => path.replace(/^\.\//u, "");

const outputClosure = (
  graph: ReadonlyMap<string, OutputMetadata>,
  root: string,
): ReadonlySet<string> => {
  const paths = new Set<string>();
  const pending = [root];
  while (pending.length > 0) {
    const path = pending.pop();
    if (path === undefined || paths.has(path)) continue;
    const output = graph.get(path);
    if (output === undefined) continue;
    paths.add(path);
    if (output.cssBundle !== undefined) pending.push(normalizedPath(output.cssBundle));
    for (const imported of output.imports) pending.push(normalizedPath(imported.path));
  }
  return paths;
};

export const classifyOutputGraph = (
  outputs: Readonly<Record<string, OutputMetadata>>,
  entryPoint: string,
): OutputClassification => {
  const graph = new Map(
    Object.entries(outputs).map(([path, output]) => [normalizedPath(path), output] as const),
  );
  const pending = [...graph]
    .filter(([, output]) => output.entryPoint === entryPoint)
    .map(([path]) => path);
  if (pending.length === 0) throw new Error(`Metafile has no output for entry point ${entryPoint}`);

  const staticPaths = new Set<string>();
  while (pending.length > 0) {
    const path = pending.pop();
    if (path === undefined || staticPaths.has(path)) continue;
    const output = graph.get(path);
    if (output === undefined) continue;
    staticPaths.add(path);
    if (output.cssBundle !== undefined) pending.push(normalizedPath(output.cssBundle));
    for (const imported of output.imports) {
      if (imported.kind !== "dynamic-import") pending.push(normalizedPath(imported.path));
    }
  }

  return {
    staticPaths: [...staticPaths].sort(),
    dynamicPaths: [...graph.keys()].filter((path) => !staticPaths.has(path)).sort(),
  };
};

export const classifyArtifacts = (
  emittedPaths: readonly string[],
  outputGraph: OutputClassification,
  staticOutputContents: readonly string[],
  copiedCoreAssets: readonly string[],
): ArtifactClassification => {
  const emitted = [...new Set(emittedPaths.map(normalizedPath))].sort();
  const graphPaths = new Set([...outputGraph.staticPaths, ...outputGraph.dynamicPaths]);
  const untrackedArtifacts = emitted.filter((path) => !graphPaths.has(path));
  const referencedStaticArtifacts = untrackedArtifacts.filter((path) => {
    const filename = path.split("/").at(-1);
    return (
      filename !== undefined && staticOutputContents.some((source) => source.includes(filename))
    );
  });
  const shell = new Set([
    ...outputGraph.staticPaths,
    ...referencedStaticArtifacts,
    ...copiedCoreAssets.map(normalizedPath),
  ]);
  return {
    shellPaths: [...shell].sort(),
    optionalPaths: emitted.filter((path) => !shell.has(path)),
  };
};

export const classifyFeatureAssets = (
  outputs: Readonly<Record<string, OutputMetadata>>,
  runtimeEntries: readonly FeatureRuntimeEntry[],
  shellPaths: readonly string[],
  emittedPaths: readonly string[],
  outputContents: Readonly<Record<string, string>>,
): FeatureAssetOwnership => {
  const graph = new Map(
    Object.entries(outputs).map(([path, output]) => [normalizedPath(path), output] as const),
  );
  const shell = new Set(shellPaths.map(normalizedPath));
  const emitted = [...new Set(emittedPaths.map(normalizedPath))].sort();
  const graphPaths = new Set(graph.keys());
  const emittedAssets = emitted.filter((path) => !graphPaths.has(path) && !shell.has(path));

  return Object.fromEntries(
    runtimeEntries.map(({ id, entryPoint }) => {
      const root = [...graph].find(
        ([, output]) => output.entryPoint !== undefined && output.entryPoint === entryPoint,
      )?.[0];
      if (root === undefined) throw new Error(`No emitted runtime entry for feature ${id}`);
      if (shell.has(root)) throw new Error(`Feature runtime entered the app shell: ${id}`);

      const closure = outputClosure(graph, root);
      const referencedAssets = emittedAssets.filter((asset) => {
        const filename = asset.split("/").at(-1);
        return (
          filename !== undefined &&
          [...closure].some((path) => outputContents[path]?.includes(filename) === true)
        );
      });
      return [
        id,
        [
          ...new Set([...closure].filter((path) => !shell.has(path)).concat(referencedAssets)),
        ].sort(),
      ] as const;
    }),
  );
};

export const createFeatureAssetGraph = (
  buildVersion: string,
  ownership: FeatureAssetOwnership,
): FeatureAssetGraph => {
  if (!/^[a-zA-Z0-9._-]+$/u.test(buildVersion)) {
    throw new TypeError("Build version must be a non-empty cache-safe identifier");
  }
  return {
    schemaVersion: 1,
    buildVersion,
    features: Object.fromEntries(
      Object.entries(ownership).map(([id, assets]) => [id, { assets }] as const),
    ),
  };
};

const within = (size: ByteSize, limits: ByteLimits): boolean =>
  (limits.rawBytes === undefined || size.rawBytes <= limits.rawBytes) &&
  (limits.gzipBytes === undefined || size.gzipBytes <= limits.gzipBytes);

export const bundleMetric = (
  current: ByteSize,
  limits: Readonly<{ readonly ratchet: ByteLimits; readonly target: ByteLimits }>,
): BundleMetric => ({
  current,
  ratchet: limits.ratchet,
  target: limits.target,
  withinRatchet: within(current, limits.ratchet),
  atTarget: within(current, limits.target),
});
