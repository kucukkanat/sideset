import { DEFAULT_ROUTE } from "@app/routing/model.ts";
import type { RouteDefinition } from "@app/routing/route-definition.ts";
import { optionalSheet } from "@app/routing/validation.ts";

export const cardRoute: RouteDefinition = {
  route: { id: "card", path: "/cards/:cardId" },
  parse: (params, search) => {
    const cardId = params.cardId;
    const sheet = optionalSheet(search, ["edit", "share", "connect"] as const);
    if (cardId === undefined || sheet === undefined) return DEFAULT_ROUTE;
    return { page: "card", cardId, ...(sheet === null ? {} : { sheet }) };
  },
};
