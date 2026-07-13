import { defineFeature } from "../../contracts/feature.ts";

export const walletFeature = defineFeature({
  id: "wallet",
  kind: "core",
  title: "Wallet",
  summary: "Create and manage your identities.",
  defaultEnabled: true,
  dock: {
    policy: "fixed",
    position: "first",
    entryPath: "/wallet",
    label: "Wallet",
    icon: "wallet",
  },
  routes: [
    { id: "wallet", prefix: "/wallet", dockOwner: "wallet" },
    { id: "cards", prefix: "/cards", dockOwner: "wallet" },
  ],
  permissions: [],
  consumes: [{ id: "activity.journal", requirement: "optional", fallback: "drop-fact" }],
  provides: ["identity.reader"],
});
