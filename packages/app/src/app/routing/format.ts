import { BASE64URL, DEFAULT_ROUTE, MAX_PROFILE_LENGTH, type Route } from "@app/routing/model.ts";

const withQuery = (path: string, params: URLSearchParams): string => {
  const query = params.toString();
  return query.length === 0 ? path : `${path}?${query}`;
};

const encodedId = (id: string, name: string): string => {
  if (id.length === 0) throw new TypeError(`${name} must not be empty`);
  return encodeURIComponent(id);
};

export const formatHashRoute = (route: Route): string => {
  switch (route.page) {
    case "wallet": {
      const params = new URLSearchParams();
      if (route.cardId !== undefined) {
        if (route.cardId.length === 0) throw new TypeError("cardId must not be empty");
        params.set("card", route.cardId);
      }
      if (route.sheet !== undefined) params.set("sheet", route.sheet);
      return withQuery("#/wallet", params);
    }
    case "card": {
      const params = new URLSearchParams();
      if (route.sheet !== undefined) params.set("sheet", route.sheet);
      return withQuery(`#/cards/${encodedId(route.cardId, "cardId")}`, params);
    }
    case "people": {
      const params = new URLSearchParams();
      if (route.sheet === "add") {
        params.set("sheet", route.sheet);
        if (route.profile !== undefined) {
          if (!BASE64URL.test(route.profile) || route.profile.length > MAX_PROFILE_LENGTH) {
            throw new TypeError("profile must be a non-empty base64url value");
          }
          params.set("profile", route.profile);
        }
      }
      return withQuery("#/people", params);
    }
    case "person": {
      const params = new URLSearchParams();
      if (route.sheet !== undefined) params.set("sheet", route.sheet);
      return withQuery(`#/people/${encodedId(route.contactId, "contactId")}`, params);
    }
    case "activity":
      return "#/activity";
    case "tools":
      return `#/tools/${route.operation}`;
    case "features":
      return "#/settings/features";
    case "settings": {
      const params = new URLSearchParams();
      if (route.sheet !== undefined) params.set("sheet", route.sheet);
      return withQuery("#/settings", params);
    }
  }
};

export const routeWithoutOverlay = (route: Route): Route | null => {
  switch (route.page) {
    case "wallet":
      if (route.sheet === undefined) return null;
      return route.cardId === undefined ? DEFAULT_ROUTE : { page: "wallet", cardId: route.cardId };
    case "card":
      return route.sheet === undefined ? null : { page: "card", cardId: route.cardId };
    case "people":
      return route.sheet === "add" ? { page: "people" } : null;
    case "settings":
      return route.sheet === undefined ? null : { page: "settings" };
    case "person":
      return route.sheet === undefined ? null : { page: "person", contactId: route.contactId };
    case "activity":
    case "features":
    case "tools":
      return null;
  }
};
