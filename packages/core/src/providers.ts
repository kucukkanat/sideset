import type { ProviderId, ProviderMeta } from "./types.ts";

export const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  twitter: { name: "X", bg: "#EAEAEB", fg: "#0A0A0A", shadow: "rgba(0,0,0,.25)" },
  github: { name: "GitHub", bg: "#ECECEC", fg: "#181717", shadow: "rgba(24,23,23,.25)" },
  reddit: { name: "Reddit", bg: "#FFE7DB", fg: "#FF4500", shadow: "rgba(255,69,0,.3)" },
  facebook: { name: "Facebook", bg: "#E7F0FF", fg: "#1877F2", shadow: "rgba(24,119,242,.3)" },
  slack: { name: "Slack", bg: "#F4E9F3", fg: "#611f69", shadow: "rgba(74,21,75,.25)" },
  confluence: { name: "Confluence", bg: "#E4EEFF", fg: "#0052CC", shadow: "rgba(0,82,204,.3)" },
  email: { name: "Email", bg: "#FFEDE7", fg: "#E8502A", shadow: "rgba(224,80,42,.3)" },
};

/** Order providers are offered in the "Add a proof" sheet. */
export const PROOF_ORDER: readonly ProviderId[] = [
  "twitter",
  "github",
  "reddit",
  "facebook",
  "slack",
  "confluence",
  "email",
];

/** The username a proof would claim for a card on a given provider. */
export const proofUserFor = (
  card: { readonly name: string; readonly handle: string },
  provider: ProviderId,
): string => {
  const base = card.handle || card.name.toLowerCase().replace(/\s+/g, "");
  switch (provider) {
    case "twitter":
      return `@${base}`;
    case "reddit":
      return `u/${base}`;
    case "email":
      return `${base}@hey.com`;
    case "facebook":
      return card.name;
    case "slack":
      return "Acme HQ";
    case "confluence":
      return `${base}@acme`;
    case "github":
      return base;
  }
};
