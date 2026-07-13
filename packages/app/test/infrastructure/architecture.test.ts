import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import * as ts from "typescript";

const sources = async (): Promise<ReadonlyMap<string, string>> => {
  const result = new Map<string, string>();
  for await (const file of new Bun.Glob("packages/app/src/**/*.{ts,tsx}").scan(".")) {
    result.set(file, await Bun.file(file).text());
  }
  return result;
};

const imports = (source: string, prefix: string): readonly string[] =>
  [...source.matchAll(new RegExp(`from ["']${prefix}/([^/"']+)`, "gu"))].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );

const moduleSpecifiers = (file: string, source: string): readonly string[] => {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const result: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      result.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      result.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return result;
};

const featureDependency = (file: string, specifier: string): string | null => {
  if (specifier.startsWith("@features/")) return specifier.split("/")[1] ?? null;
  if (!specifier.startsWith(".")) return null;
  return resolve(dirname(file), specifier).match(/\/src\/features\/([^/]+)\//u)?.[1] ?? null;
};

// This is a shrinking migration ledger, not an exemption mechanism. New edges fail CI.
const LEGACY_CROSS_FEATURE_EDGES = [
  "backup -> cards",
  "cards -> identity",
  "contacts -> cards",
  "contacts -> profile-sharing",
  "profile-sharing -> identity",
  "settings -> cards",
  "wallet -> cards",
] as const;

describe("module boundaries", () => {
  test("keeps Activity presentation policy out of application composition", async () => {
    const app = await Bun.file("packages/app/src/app/App.tsx").text();
    expect(app).not.toContain("createActivity");
    expect(app).not.toContain('kind: "emoji"');
    expect(app).not.toMatch(/bg:\s*"#[0-9A-Fa-f]{6}"/u);
  });

  test("keeps feature acquisition and preference orchestration behind the feature host", async () => {
    const app = await Bun.file("packages/app/src/app/App.tsx").text();
    const host = await Bun.file("packages/app/src/app/features/useFeatureHost.ts").text();
    expect(app).not.toContain("acquireFeature");
    expect(app).not.toContain("useFeaturePreferences({");
    expect(app).not.toContain("CURRENT_FEATURE_PREFERENCES");
    expect(app).not.toContain("@features/tools/manifest.ts");
    expect(app).not.toMatch(
      /featureHost\.preferences\.(?:disable|enable|pin|reorder|reset|unpin)\b/u,
    );
    expect(host).toContain("readonly preferences: NormalizedFeaturePreferences<CurrentFeatureId>");
    expect(host).not.toContain("FeaturePreferencesController");
  });

  test("keeps runtime activation and cleanup behind an explicit lifecycle", async () => {
    const contract = await Bun.file("packages/app/src/contracts/feature.ts").text();
    const host = await Bun.file("packages/app/src/app/features/useFeatureHost.ts").text();
    const tools = await Bun.file("packages/app/src/features/tools/Tools.tsx").text();
    const boundary = await Bun.file("packages/app/src/shared/ui/FeatureBoundary.tsx").text();
    const app = await Bun.file("packages/app/src/app/App.tsx").text();

    expect(contract).toContain("FeatureRuntimeLoader<Module extends FeatureRuntime");
    expect(host).toContain("runtimeDisposers");
    expect(host).toContain("runtime.activate(runtimeContextRef.current)");
    expect(tools).toContain('export const activate: FeatureRuntime["activate"]');
    expect(boundary).toContain("this.props.onError?.(error)");
    expect(app).toContain('featureHost.fail("tools", error)');
  });

  test("keeps shared code independent and features independent from app composition", async () => {
    const violations: string[] = [];
    for (const [file, source] of await sources()) {
      if (file.includes("/src/shared/") && /from ["']@(app|features)\//u.test(source)) {
        violations.push(`${file}: shared code imports an application layer`);
      }
      if (file.includes("/src/features/") && /from ["']@app\//u.test(source)) {
        violations.push(`${file}: feature imports app composition`);
      }
    }
    expect(violations).toEqual([]);
  });

  test("keeps the feature dependency graph acyclic", async () => {
    const graph = new Map<string, Set<string>>();
    for (const [file, source] of await sources()) {
      const feature = file.match(/\/src\/features\/([^/]+)\//u)?.[1];
      if (feature === undefined) continue;
      const dependencies = graph.get(feature) ?? new Set<string>();
      for (const dependency of imports(source, "@features")) {
        if (dependency !== feature) dependencies.add(dependency);
      }
      graph.set(feature, dependencies);
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const findCycle = (feature: string, path: readonly string[]): readonly string[] | null => {
      if (visiting.has(feature)) return [...path, feature];
      if (visited.has(feature)) return null;
      visiting.add(feature);
      for (const dependency of graph.get(feature) ?? []) {
        const cycle = findCycle(dependency, [...path, feature]);
        if (cycle !== null) return cycle;
      }
      visiting.delete(feature);
      visited.add(feature);
      return null;
    };

    const cycles = [...graph.keys()].flatMap((feature) => {
      const cycle = findCycle(feature, []);
      return cycle === null ? [] : [cycle.join(" -> ")];
    });
    expect(cycles).toEqual([]);
  });

  test("prevents any new cross-feature implementation imports", async () => {
    const edges = new Set<string>();
    for (const [file, source] of await sources()) {
      const feature = file.match(/\/src\/features\/([^/]+)\//u)?.[1];
      if (feature === undefined) continue;
      for (const specifier of moduleSpecifiers(file, source)) {
        const dependency = featureDependency(file, specifier);
        if (dependency !== null && dependency !== feature) {
          edges.add(`${feature} -> ${dependency}`);
        }
      }
    }

    expect([...edges].toSorted()).toEqual([...LEGACY_CROSS_FEATURE_EDGES]);
  });
});
