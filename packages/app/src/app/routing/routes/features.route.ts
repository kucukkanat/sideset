import { DEFAULT_ROUTE } from "@app/routing/model.ts";
import type { RouteDefinition } from "@app/routing/route-definition.ts";
import { hasSheet } from "@app/routing/validation.ts";

export const featuresRoute: RouteDefinition = {
  route: { id: "features", path: "/settings/features" },
  parse: (_params, search) => (hasSheet(search) ? DEFAULT_ROUTE : { page: "features" }),
};
