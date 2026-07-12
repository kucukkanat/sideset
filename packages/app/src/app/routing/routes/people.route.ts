import { BASE64URL, DEFAULT_ROUTE, MAX_PROFILE_LENGTH } from "@app/routing/model.ts";
import type { RouteDefinition } from "@app/routing/route-definition.ts";
import { optionalSheet, queryValue } from "@app/routing/validation.ts";

export const peopleRoute: RouteDefinition = {
  route: { id: "people", path: "/people" },
  parse: (_params, search) => {
    const sheet = optionalSheet(search, ["add"] as const);
    if (sheet === undefined) return DEFAULT_ROUTE;
    if (sheet === null) return { page: "people" };
    const profile = queryValue(search, "profile");
    if (
      profile.kind === "invalid" ||
      (profile.kind === "value" &&
        (!BASE64URL.test(profile.value) || profile.value.length > MAX_PROFILE_LENGTH))
    ) {
      return DEFAULT_ROUTE;
    }
    return {
      page: "people",
      sheet: "add",
      ...(profile.kind === "value" ? { profile: profile.value } : {}),
    };
  },
};
