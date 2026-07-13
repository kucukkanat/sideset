import { PROVIDER_META } from "@keychain/core";
import type { ActivityFact } from "../../contracts/capabilities.ts";
import { type ActivityIcon, type ActivityItem, MAX_ACTIVITY_ITEMS } from "./activity.ts";

export { MAX_ACTIVITY_ITEMS } from "./activity.ts";

export interface ActivityProjectionContext {
  readonly id: () => string;
}

type ActivityPresentation = Readonly<{
  icon: ActivityIcon;
  title: string;
  sub: string;
}>;

const emoji = (value: string, fallback: string): string =>
  value.length > 0 && !value.startsWith("data:image/") ? value : fallback;

const presentation = (fact: ActivityFact): ActivityPresentation => {
  switch (fact.kind) {
    case "identity.activated":
      return {
        icon: { kind: "emoji", emoji: "🔄", bg: "#EDE7FB" },
        title: `Switched to ${fact.name}`,
        sub: `from ${fact.previousName}`,
      };
    case "identity.created":
      return {
        icon: { kind: "emoji", emoji: emoji(fact.avatar, "🙂"), bg: "#E9F7EC" },
        title: `Created ${fact.name} card`,
        sub: "A separate profile",
      };
    case "identity.updated":
      return {
        icon: { kind: "emoji", emoji: emoji(fact.avatar, "🙂"), bg: "#FCEDE7" },
        title: `Updated ${fact.name}`,
        sub: "Card details changed",
      };
    case "identity.deleted":
      return {
        icon: { kind: "emoji", emoji: emoji(fact.avatar, "🗑️"), bg: "#FDECE7" },
        title: `Deleted ${fact.name}`,
        sub: "Identity removed from this device",
      };
    case "account.connected":
      return {
        icon: { kind: "provider", provider: fact.provider },
        title: `Connected ${fact.username}`,
        sub: `${fact.identityName} · ${PROVIDER_META[fact.provider].name}`,
      };
    case "account.disconnected":
      return {
        icon: { kind: "provider", provider: fact.provider },
        title: `Disconnected ${PROVIDER_META[fact.provider].name}`,
        sub: fact.identityName,
      };
    case "person.added":
      return {
        icon: { kind: "emoji", emoji: emoji(fact.avatar, "👤"), bg: "#E9F7EC" },
        title: `Added ${fact.name}`,
        sub: "Saved to contacts",
      };
    case "person.updated":
      return {
        icon: { kind: "emoji", emoji: emoji(fact.avatar, "👤"), bg: "#EDE7FB" },
        title: `Updated ${fact.name}`,
        sub: "Contact details changed",
      };
    case "people.removed":
      return {
        icon: {
          kind: "emoji",
          emoji: fact.count === 1 ? emoji(fact.firstAvatar, "👤") : "🗑️",
          bg: "#FDECE7",
        },
        title: fact.count === 1 ? `Removed ${fact.firstName}` : `Removed ${fact.count} contacts`,
        sub: "From contacts",
      };
    case "backup.prepared":
      return {
        icon: { kind: "emoji", emoji: "🛡️", bg: "#E9F7EC" },
        title: "Prepared an encrypted backup",
        sub: "Ready to download",
      };
    case "backup.restored":
      return {
        icon: { kind: "emoji", emoji: "📥", bg: "#FFF6DB" },
        title: "Restored a local backup",
        sub: "Selected backup data imported",
      };
  }
};

export const projectActivityFact = (
  items: readonly ActivityItem[],
  fact: ActivityFact,
  context: ActivityProjectionContext,
): readonly ActivityItem[] => {
  const projected = presentation(fact);
  return [
    {
      id: context.id(),
      ...projected,
      occurredAt: fact.occurredAt,
    },
    ...items,
  ].slice(0, MAX_ACTIVITY_ITEMS);
};
