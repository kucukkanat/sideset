import type { ProviderId } from "@keychain/core";

export type ActivityIcon =
  | { readonly kind: "provider"; readonly provider: ProviderId }
  | { readonly kind: "emoji"; readonly emoji: string; readonly bg: string };

export interface ActivityItem {
  readonly id: string;
  readonly icon: ActivityIcon;
  readonly title: string;
  readonly sub: string;
  readonly occurredAt: number;
}

export interface ActivityGroup {
  readonly day: "Today" | "Yesterday" | "Earlier";
  readonly items: readonly ActivityItem[];
}

export const MAX_ACTIVITY_ITEMS = 100;

const provider = (
  id: string,
  p: ProviderId,
  title: string,
  sub: string,
  occurredAt: number,
): ActivityItem => ({ id, icon: { kind: "provider", provider: p }, title, sub, occurredAt });

const emoji = (
  id: string,
  value: string,
  bg: string,
  title: string,
  sub: string,
  occurredAt: number,
): ActivityItem => ({
  id,
  icon: { kind: "emoji", emoji: value, bg },
  title,
  sub,
  occurredAt,
});

export const createInitialActivity = (now = Date.now()): readonly ActivityItem[] => [
  provider("seed-x", "twitter", "Connected X account", "@finnriver · Everyday", now - 2 * 60_000),
  provider(
    "seed-github",
    "github",
    "Connected GitHub account",
    "finnriver · Everyday",
    now - 60 * 60_000,
  ),
  emoji("seed-switch", "🔄", "#EDE7FB", "Switched to Everyday", "from Work", now - 5 * 60 * 60_000),
  emoji(
    "seed-backup",
    "🛡️",
    "#E9F7EC",
    "Prepared an encrypted backup",
    "Work · download requested",
    now - 26 * 60 * 60_000,
  ),
  emoji(
    "seed-create",
    "🎭",
    "#EFEAF7",
    "Created Anon card",
    "A separate profile",
    now - 3 * 24 * 60 * 60_000,
  ),
];

const startOfDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

export const groupActivity = (
  items: readonly ActivityItem[],
  now = Date.now(),
): readonly ActivityGroup[] => {
  const today = startOfDay(now);
  const groups: Record<ActivityGroup["day"], ActivityItem[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };
  for (const item of [...items].sort((a, b) => b.occurredAt - a.occurredAt)) {
    const days = Math.round((today - startOfDay(item.occurredAt)) / 86_400_000);
    const day = days <= 0 ? "Today" : days === 1 ? "Yesterday" : "Earlier";
    groups[day].push(item);
  }
  return (["Today", "Yesterday", "Earlier"] as const)
    .filter((day) => groups[day].length > 0)
    .map((day) => ({ day, items: groups[day] }));
};

export const formatActivityTime = (occurredAt: number, now = Date.now()): string => {
  const elapsed = Math.max(0, now - occurredAt);
  if (elapsed < 60_000) return "Now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h`;
  return `${Math.floor(elapsed / 86_400_000)}d`;
};
