import { DEFAULT_ROUTE } from "@app/routing/model.ts";
import type { RouteDefinition } from "@app/routing/route-definition.ts";
import { hasSheet, isOneOf } from "@app/routing/validation.ts";

export const toolRoute: RouteDefinition = {
  route: { id: "tool", path: "/tools/:operation" },
  parse: (params, search) => {
    const operation = params.operation;
    return !hasSheet(search) &&
      operation !== undefined &&
      isOneOf(operation, ["encrypt", "decrypt", "sign", "verify", "cloak"] as const)
      ? { page: "tools", operation }
      : DEFAULT_ROUTE;
  },
};
