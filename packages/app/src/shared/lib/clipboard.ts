export type ClipboardResult =
  | { readonly ok: true; readonly method: "clipboard" }
  | { readonly ok: false; readonly reason: "unavailable" | "failed" };

export const copyText = async (value: string): Promise<ClipboardResult> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return { ok: true, method: "clipboard" };
    } catch {
      // Embedded browsers can expose the API while denying it; the local fallback may still work.
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
