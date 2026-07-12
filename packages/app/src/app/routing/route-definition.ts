import type { Route } from "@app/routing/model.ts";
import type { RouteObject } from "react-router";

export interface RouteDefinition {
  readonly route: RouteObject & { readonly id: string };
  readonly parse: (
    params: Readonly<Record<string, string | undefined>>,
    search: URLSearchParams,
  ) => Route;
}
