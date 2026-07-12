import { DEFAULT_ROUTE } from "@app/routing/model.ts";
import type { RouteDefinition } from "@app/routing/route-definition.ts";
import { optionalSheet, queryValue } from "@app/routing/validation.ts";

export const walletRoute: RouteDefinition = {
  route: { id: "wallet", path: "/wallet" },
  parse: (_params, search) => {
    const card = queryValue(search, "card");
    const sheet = optionalSheet(search, ["create", "connect"] as const);
    if (card.kind === "invalid" || sheet === undefined) return DEFAULT_ROUTE;
    return {
      page: "wallet",
      ...(card.kind === "value" ? { cardId: card.value } : {}),
      ...(sheet === null ? {} : { sheet }),
    };
  },
};
