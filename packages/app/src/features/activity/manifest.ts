import { defineFeature } from "../../contracts/feature.ts";

export const activityFeature = defineFeature({
  id: "activity",
  kind: "capability",
  title: "Activity",
  summary: "Review a local history of wallet changes.",
  defaultEnabled: true,
  routes: [{ id: "activity", prefix: "/activity", dockOwner: "wallet" }],
  permissions: [],
  consumes: [],
  provides: ["activity.journal"],
  dataVersion: 1,
  maxStoredBytes: 1_000_000,
});
