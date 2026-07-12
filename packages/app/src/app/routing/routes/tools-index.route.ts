import { DEFAULT_ROUTE } from "@app/routing/model.ts";
import type { RouteDefinition } from "@app/routing/route-definition.ts";
import { hasSheet } from "@app/routing/validation.ts";

export const toolsIndexRoute: RouteDefinition = {
  route: { id: "tools-index", path: "/tools" },
  parse: (_params, search) =>
    hasSheet(search) ? DEFAULT_ROUTE : { page: "tools", operation: "encrypt" },
};
