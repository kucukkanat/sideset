export type ShareResult =
  | { readonly ok: true; readonly method: "share" | "clipboard" }
  | { readonly ok: false; readonly reason: "cancelled" | "unavailable" | "failed" };

export const profileShareUrl = (pageUrl: string, profile: string): string => {
  const url = new URL(pageUrl);
  url.search = "";
  const query = new URLSearchParams({ sheet: "add", profile });
  url.hash = `/people?${query.toString()}`;
  return url.toString();
};

export const copyText = async (value: string): Promise<ShareResult> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return { ok: true, method: "clipboard" };
    } catch {
      // Some embedded browsers expose the API but deny it; the local fallback still works.
    }
  }

  const field = document.createElement("textarea");
  field.value = value;
  field.readOnly = true;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand("copy")
      ? { ok: true, method: "clipboard" }
      : { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "failed" };
  } finally {
    field.remove();
  }
};

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

export const shareProfile = async (input: {
  readonly title: string;
  readonly text: string;
  readonly url: string;
}): Promise<ShareResult> => {
  if (navigator.share) {
    try {
      await navigator.share(input);
      return { ok: true, method: "share" };
    } catch (error) {
      if (isAbort(error)) return { ok: false, reason: "cancelled" };
      return copyText(input.url);
    }
  }
  return copyText(input.url);
};
