import { defineFeature } from "../../contracts/feature.ts";

export const peopleFeature = defineFeature({
  id: "people",
  kind: "destination",
  title: "People",
  summary: "Keep a private address book for identities you know.",
  defaultEnabled: true,
  dock: {
    policy: "configurable",
    defaultPinned: true,
    entryPath: "/people",
    label: "People",
    icon: "people",
  },
  routes: [{ id: "people", prefix: "/people", dockOwner: "people" }],
  permissions: [],
  consumes: [],
  provides: ["people.recipient-source"],
  dataVersion: 1,
  maxStoredBytes: 12_000_000,
});
