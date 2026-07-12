export type WalletSheet = "create" | "connect";
export type CardSheet = "edit" | "share" | "backup" | "connect";
export type PersonSheet = "edit";
export type SettingsSheet = "backup" | "restore" | "appearance" | "help" | "reset";
export type ToolOperation = "encrypt" | "decrypt" | "sign" | "verify" | "cloak";

export type Route =
  | {
      readonly page: "wallet";
      readonly cardId?: string;
      readonly sheet?: WalletSheet;
    }
  | {
      readonly page: "card";
      readonly cardId: string;
      readonly sheet?: CardSheet;
    }
  | {
      readonly page: "people";
      readonly sheet?: never;
      readonly profile?: never;
    }
  | {
      readonly page: "people";
      readonly sheet: "add";
      readonly profile?: string;
    }
  | { readonly page: "person"; readonly contactId: string; readonly sheet?: PersonSheet }
  | { readonly page: "activity" }
  | { readonly page: "tools"; readonly operation: ToolOperation }
  | { readonly page: "settings"; readonly sheet?: SettingsSheet };

export const DEFAULT_ROUTE: Route = { page: "wallet" };

type QueryValue =
  | { readonly kind: "missing" }
  | { readonly kind: "value"; readonly value: string }
  | { readonly kind: "invalid" };

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const MAX_PROFILE_LENGTH = 12_000;

const queryValue = (params: URLSearchParams, key: string): QueryValue => {
  const values = params.getAll(key);
  if (values.length === 0) return { kind: "missing" };
  const value = values[0];
  if (values.length !== 1 || value === undefined || value.length === 0) {
    return { kind: "invalid" };
  }
  return { kind: "value", value };
};

const hasValidEncoding = (rawQuery: string): boolean => {
  try {
    for (const part of rawQuery.split("&")) {
      const equals = part.indexOf("=");
      const key = equals < 0 ? part : part.slice(0, equals);
      const value = equals < 0 ? "" : part.slice(equals + 1);
      decodeURIComponent(key.replaceAll("+", " "));
      decodeURIComponent(value.replaceAll("+", " "));
    }
    return true;
  } catch {
    return false;
  }
};

const decodePath = (rawPath: string): readonly string[] | null => {
  const rawSegments = rawPath.split("/");
  if (rawSegments[0] !== "") return null;

  const segments: string[] = [];
  try {
    for (const rawSegment of rawSegments.slice(1)) {
      const segment = decodeURIComponent(rawSegment);
      if (segment.length === 0) return null;
      segments.push(segment);
    }
  } catch {
    return null;
  }
  return segments;
};

const isOneOf = <T extends string>(value: string, options: readonly T[]): value is T =>
  options.some((option) => option === value);

const optionalSheet = <T extends string>(
  params: URLSearchParams,
  options: readonly T[],
): T | null | undefined => {
  const sheet = queryValue(params, "sheet");
  if (sheet.kind === "missing") return null;
  if (sheet.kind === "invalid" || !isOneOf(sheet.value, options)) return undefined;
  return sheet.value;
};

const parseWallet = (params: URLSearchParams): Route => {
  const card = queryValue(params, "card");
  const sheet = optionalSheet(params, ["create", "connect"] as const);
  if (card.kind === "invalid" || sheet === undefined) return DEFAULT_ROUTE;

  return {
    page: "wallet",
    ...(card.kind === "value" ? { cardId: card.value } : {}),
    ...(sheet === null ? {} : { sheet }),
  };
};

const parseCard = (cardId: string, params: URLSearchParams): Route => {
  const sheet = optionalSheet(params, ["edit", "share", "backup", "connect"] as const);
  if (sheet === undefined) return DEFAULT_ROUTE;
  return { page: "card", cardId, ...(sheet === null ? {} : { sheet }) };
};

const parsePeople = (params: URLSearchParams): Route => {
  const sheet = optionalSheet(params, ["add"] as const);
  if (sheet === undefined) return DEFAULT_ROUTE;
  if (sheet === null) return { page: "people" };

  const profile = queryValue(params, "profile");
  if (profile.kind === "invalid") return DEFAULT_ROUTE;
  if (
    profile.kind === "value" &&
    (!BASE64URL.test(profile.value) || profile.value.length > MAX_PROFILE_LENGTH)
  ) {
    return DEFAULT_ROUTE;
  }
  return {
    page: "people",
    sheet: "add",
    ...(profile.kind === "value" ? { profile: profile.value } : {}),
  };
};

const parsePerson = (contactId: string, params: URLSearchParams): Route => {
  const sheet = optionalSheet(params, ["edit"] as const);
  if (sheet === undefined) return DEFAULT_ROUTE;
  return { page: "person", contactId, ...(sheet === null ? {} : { sheet }) };
};

const parseSettings = (params: URLSearchParams): Route => {
  const sheet = optionalSheet(params, [
    "backup",
    "restore",
    "appearance",
    "help",
    "reset",
  ] as const);
  if (sheet === undefined) return DEFAULT_ROUTE;
  return { page: "settings", ...(sheet === null ? {} : { sheet }) };
};

const hasSheet = (params: URLSearchParams): boolean =>
  queryValue(params, "sheet").kind !== "missing";

/** Parse a location hash. Invalid routes deliberately resolve to the canonical wallet route. */
export const parseHashRoute = (hash: string): Route => {
  if (!hash.startsWith("#/")) return DEFAULT_ROUTE;

  const question = hash.indexOf("?");
  const rawPath = question < 0 ? hash.slice(1) : hash.slice(1, question);
  const rawQuery = question < 0 ? "" : hash.slice(question + 1);
  if (!hasValidEncoding(rawQuery)) return DEFAULT_ROUTE;

  const segments = decodePath(rawPath);
  if (segments === null) return DEFAULT_ROUTE;
  const params = new URLSearchParams(rawQuery);

  if (segments.length === 1 && segments[0] === "wallet") return parseWallet(params);
  if (segments.length === 2 && segments[0] === "cards") {
    const cardId = segments[1];
    return cardId === undefined ? DEFAULT_ROUTE : parseCard(cardId, params);
  }
  if (segments.length === 1 && segments[0] === "people") return parsePeople(params);
  if (segments.length === 2 && segments[0] === "people") {
    const contactId = segments[1];
    return contactId === undefined ? DEFAULT_ROUTE : parsePerson(contactId, params);
  }
  if (segments.length === 1 && segments[0] === "activity") {
    return hasSheet(params) ? DEFAULT_ROUTE : { page: "activity" };
  }
  if (segments.length === 1 && segments[0] === "tools")
    return hasSheet(params) ? DEFAULT_ROUTE : { page: "tools", operation: "encrypt" };
  if (segments.length === 2 && segments[0] === "tools") {
    const operation = segments[1];
    return !hasSheet(params) &&
      operation !== undefined &&
      isOneOf(operation, ["encrypt", "decrypt", "sign", "verify", "cloak"])
      ? { page: "tools", operation }
      : DEFAULT_ROUTE;
  }
  if (segments.length === 1 && segments[0] === "settings") return parseSettings(params);
  return DEFAULT_ROUTE;
};

const withQuery = (path: string, params: URLSearchParams): string => {
  const query = params.toString();
  return query.length === 0 ? path : `${path}?${query}`;
};

const encodedId = (id: string, name: string): string => {
  if (id.length === 0) throw new TypeError(`${name} must not be empty`);
  return encodeURIComponent(id);
};

/** Format a route using a stable parameter order. */
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
    case "settings": {
      const params = new URLSearchParams();
      if (route.sheet !== undefined) params.set("sheet", route.sheet);
      return withQuery("#/settings", params);
    }
  }
};

export const canonicalizeHashRoute = (hash: string): string =>
  formatHashRoute(parseHashRoute(hash));

/** Return the page beneath a route-backed sheet, or null when no sheet is open. */
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
    case "tools":
      return null;
  }
};
