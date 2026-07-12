import { DEFAULT_ROUTE } from "@app/routing/model.ts";
import type { RouteDefinition } from "@app/routing/route-definition.ts";
import { hasSheet } from "@app/routing/validation.ts";

export const activityRoute: RouteDefinition = {
  route: { id: "activity", path: "/activity" },
  parse: (_params, search) => (hasSheet(search) ? DEFAULT_ROUTE : { page: "activity" }),
};
