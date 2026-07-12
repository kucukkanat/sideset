type QueryValue =
  | { readonly kind: "missing" }
  | { readonly kind: "value"; readonly value: string }
  | { readonly kind: "invalid" };

export const queryValue = (params: URLSearchParams, key: string): QueryValue => {
  const values = params.getAll(key);
  if (values.length === 0) return { kind: "missing" };
  const value = values[0];
  return values.length === 1 && value !== undefined && value.length > 0
    ? { kind: "value", value }
    : { kind: "invalid" };
};

export const isOneOf = <T extends string>(value: string, options: readonly T[]): value is T =>
  options.some((option) => option === value);

export const optionalSheet = <T extends string>(
  params: URLSearchParams,
  options: readonly T[],
): T | null | undefined => {
  const sheet = queryValue(params, "sheet");
  if (sheet.kind === "missing") return null;
  if (sheet.kind === "invalid" || !isOneOf(sheet.value, options)) return undefined;
  return sheet.value;
};

export const hasSheet = (params: URLSearchParams): boolean =>
  queryValue(params, "sheet").kind !== "missing";

export const hasValidLocationEncoding = (pathname: string, rawQuery: string): boolean => {
  if (!pathname.startsWith("/")) return false;
  try {
    const pathIsValid = pathname
      .slice(1)
      .split("/")
      .every((segment) => segment.length > 0 && decodeURIComponent(segment).length > 0);
    if (!pathIsValid) return false;
    for (const part of rawQuery.split("&")) {
      const equals = part.indexOf("=");
      decodeURIComponent((equals < 0 ? part : part.slice(0, equals)).replaceAll("+", " "));
      decodeURIComponent((equals < 0 ? "" : part.slice(equals + 1)).replaceAll("+", " "));
    }
    return true;
  } catch {
    return false;
  }
};
