import { describe, expect, test } from "bun:test";
import { FEATURE_PREFERENCES_STORAGE_KEY } from "@app/features/preference-storage.ts";
import { featureById, featureRegistry } from "@app/features/registry.ts";
import {
  ACTIVITY_STORAGE_KEY,
  MAX_ACTIVITY_STORAGE_BYTES,
  MAX_PEOPLE_STORAGE_BYTES,
  PEOPLE_STORAGE_KEY,
  WALLET_STORAGE_KEY,
} from "@app/storage.ts";
import * as ts from "typescript";

const manifestFiles = async (): Promise<readonly string[]> => {
  const files: string[] = [];
  for await (const file of new Bun.Glob("packages/app/src/features/*/manifest.ts").scan(".")) {
    files.push(file);
  }
  return files.toSorted();
};

const manifestId = (source: ts.SourceFile): string | null => {
  let result: string | null = null;
  const visit = (node: ts.Node): void => {
    if (
      result === null &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === "defineFeature" || node.expression.text === "defineRuntimeFeature")
    ) {
      const definition = node.arguments[0];
      if (definition !== undefined && ts.isObjectLiteralExpression(definition)) {
        const id = definition.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            ((ts.isIdentifier(property.name) && property.name.text === "id") ||
              (ts.isStringLiteral(property.name) && property.name.text === "id")),
        );
        if (id !== undefined && ts.isStringLiteral(id.initializer)) result = id.initializer.text;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
};

type LedgerStatus = "active" | "reserved" | "retired";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const ledgerEntries = (
  ledger: unknown,
  collection: string,
  valueKey: string,
): readonly { readonly value: string; readonly status: LedgerStatus }[] => {
  if (!isRecord(ledger) || !Array.isArray(ledger[collection])) {
    throw new Error(`Identifier ledger collection is invalid: ${collection}`);
  }
  return ledger[collection].map((entry) => {
    if (!isRecord(entry)) throw new Error(`Identifier ledger entry is invalid: ${collection}`);
    const value = entry[valueKey];
    const status = entry.status;
    if (
      typeof value !== "string" ||
      (status !== "active" && status !== "reserved" && status !== "retired")
    ) {
      throw new Error(`Identifier ledger entry is invalid: ${collection}`);
    }
    return { value, status };
  });
};

const active = (ledger: unknown, collection: string, valueKey: string): readonly string[] =>
  ledgerEntries(ledger, collection, valueKey)
    .flatMap(({ value, status }) => (status === "active" ? [value] : []))
    .toSorted();

describe("feature manifest architecture", () => {
  test("keeps manifests lightweight and gives Tools one literal dynamic boundary", async () => {
    const dynamicImports: { readonly file: string; readonly specifier: string }[] = [];
    const manifestIds: string[] = [];
    const violations: string[] = [];

    for (const file of await manifestFiles()) {
      const source = await Bun.file(file).text();
      const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const id = manifestId(parsed);
      if (id === null) violations.push(`${file}: has no literal feature identifier`);
      else manifestIds.push(id);
      const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          if (!node.moduleSpecifier.text.endsWith("/contracts/feature.ts")) {
            violations.push(`${file}: statically imports ${node.moduleSpecifier.text}`);
          }
        }
        if (
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments.length === 1
        ) {
          const argument = node.arguments[0];
          if (argument !== undefined && ts.isStringLiteral(argument)) {
            dynamicImports.push({ file, specifier: argument.text });
          } else {
            violations.push(`${file}: dynamic import is not a literal`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(parsed);
    }

    expect(violations).toEqual([]);
    expect(manifestIds.toSorted()).toEqual(featureRegistry.map(({ id }) => id).toSorted());
    expect(dynamicImports).toEqual([
      {
        file: "packages/app/src/features/tools/manifest.ts",
        specifier: "./Tools.tsx",
      },
    ]);
  });

  test("keeps live protocol identifiers in the append-only ledger", async () => {
    const ledger: unknown = JSON.parse(
      await Bun.file("packages/app/feature-identifiers.json").text(),
    );
    const liveFeatureIds = featureRegistry.map(({ id }) => id).toSorted();
    const liveRoutePrefixes = featureRegistry
      .flatMap(({ routes }) => routes.map(({ prefix }) => prefix))
      .toSorted();
    const liveCapabilities = [
      ...new Set(
        featureRegistry.flatMap(({ consumes, provides }) => [
          ...consumes.map(({ id }) => id),
          ...provides,
        ]),
      ),
    ].toSorted();

    expect(active(ledger, "featureIds", "id")).toEqual(liveFeatureIds);
    expect(active(ledger, "routePrefixes", "prefix")).toEqual(liveRoutePrefixes);
    expect(active(ledger, "capabilityIds", "id")).toEqual(liveCapabilities);
    expect(active(ledger, "storagePrefixes", "prefix")).toEqual(
      [
        ACTIVITY_STORAGE_KEY,
        FEATURE_PREFERENCES_STORAGE_KEY,
        PEOPLE_STORAGE_KEY,
        WALLET_STORAGE_KEY,
      ].toSorted(),
    );

    for (const [collection, valueKey] of [
      ["featureIds", "id"],
      ["routePrefixes", "prefix"],
      ["capabilityIds", "id"],
      ["storagePrefixes", "prefix"],
    ] as const) {
      const values = ledgerEntries(ledger, collection, valueKey).map(({ value }) => value);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  test("keeps durable feature manifests aligned with enforced storage budgets", () => {
    expect(featureById("people")).toMatchObject({
      dataVersion: 1,
      maxStoredBytes: MAX_PEOPLE_STORAGE_BYTES,
    });
    expect(featureById("activity")).toMatchObject({
      dataVersion: 1,
      maxStoredBytes: MAX_ACTIVITY_STORAGE_BYTES,
    });
  });
});
