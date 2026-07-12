import { DEFAULT_ROUTE } from "@app/routing/model.ts";
import type { RouteDefinition } from "@app/routing/route-definition.ts";
import { optionalSheet } from "@app/routing/validation.ts";

export const personRoute: RouteDefinition = {
  route: { id: "person", path: "/people/:contactId" },
  parse: (params, search) => {
    const contactId = params.contactId;
    const sheet = optionalSheet(search, ["edit", "share"] as const);
    if (contactId === undefined || sheet === undefined) return DEFAULT_ROUTE;
    return { page: "person", contactId, ...(sheet === null ? {} : { sheet }) };
  },
};
