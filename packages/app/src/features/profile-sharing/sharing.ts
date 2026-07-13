import { copyText } from "@shared/lib/clipboard.ts";

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
