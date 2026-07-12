import { DEFAULT_ROUTE } from "@app/routing/model.ts";
import type { RouteDefinition } from "@app/routing/route-definition.ts";
import { optionalSheet } from "@app/routing/validation.ts";

export const settingsRoute: RouteDefinition = {
  route: { id: "settings", path: "/settings" },
  parse: (_params, search) => {
    const sheet = optionalSheet(search, [
      "backup",
      "restore",
      "appearance",
      "help",
      "reset",
    ] as const);
    return sheet === undefined
      ? DEFAULT_ROUTE
      : { page: "settings", ...(sheet === null ? {} : { sheet }) };
  },
};
