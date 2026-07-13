import { defineRuntimeFeature } from "../../contracts/feature.ts";

export const toolsFeature = defineRuntimeFeature({
  id: "tools",
  kind: "destination",
  title: "Tools",
  summary: "Encrypt, decrypt, cloak, sign, and verify on this device.",
  defaultEnabled: false,
  dock: {
    policy: "configurable",
    defaultPinned: false,
    entryPath: "/tools",
    label: "Tools",
    icon: "tools",
  },
  routes: [{ id: "tools", prefix: "/tools", dockOwner: "tools" }],
  permissions: ["clipboard-write", "file-open", "file-save"],
  consumes: [
    { id: "identity.reader", requirement: "required-core" },
    { id: "people.recipient-source", requirement: "optional", fallback: "manual-input" },
  ],
  provides: [],
  load: () => import("./Tools.tsx"),
});
