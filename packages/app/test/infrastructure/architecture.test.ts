import { describe, expect, test } from "bun:test";

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

describe("module boundaries", () => {
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
});
