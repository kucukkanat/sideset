import { defineFeature } from "../../contracts/feature.ts";

export const settingsFeature = defineFeature({
  id: "settings",
  kind: "core",
  title: "Settings",
  summary: "Manage appearance, recovery, backups, and application features.",
  defaultEnabled: true,
  dock: {
    policy: "fixed",
    position: "last",
    entryPath: "/settings",
    label: "Settings",
    icon: "gear",
  },
  routes: [{ id: "settings", prefix: "/settings", dockOwner: "settings" }],
  permissions: [],
  consumes: [],
  provides: [],
});
