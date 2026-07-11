import type { ProviderId } from "@keychain/core";

export type ActivityIcon =
  | { readonly kind: "provider"; readonly provider: ProviderId }
  | { readonly kind: "emoji"; readonly emoji: string; readonly bg: string };

export interface ActivityItem {
  readonly icon: ActivityIcon;
  readonly title: string;
  readonly sub: string;
  readonly time: string;
}

export interface ActivityGroup {
  readonly day: string;
  readonly items: readonly ActivityItem[];
}

const provider = (p: ProviderId, title: string, sub: string, time: string): ActivityItem => ({
  icon: { kind: "provider", provider: p },
  title,
  sub,
  time,
});
const emoji = (e: string, bg: string, title: string, sub: string, time: string): ActivityItem => ({
  icon: { kind: "emoji", emoji: e, bg },
  title,
  sub,
  time,
});

export const RECENT_ACTIVITY: readonly ActivityItem[] = [
  provider("twitter", "Verified your X account", "@finnriver · Everyday", "2m"),
  provider("github", "Verified your GitHub", "finnriver · Everyday", "1h"),
  emoji("⚡", "#FFF6DB", "Received a tip", "2,100 sats · Everyday", "3h"),
];

export const ACTIVITY_GROUPS: readonly ActivityGroup[] = [
  {
    day: "Today",
    items: [...RECENT_ACTIVITY, emoji("🔄", "#EDE7FB", "Switched to Everyday", "from Work", "5h")],
  },
  {
    day: "Yesterday",
    items: [
      provider("confluence", "Verified on Confluence", "finn@acme · Work", "1d"),
      emoji("🛡️", "#E9F7EC", "Backup saved", "Work · to iCloud", "1d"),
      provider("slack", "Verified on Slack", "Acme HQ · Work", "1d"),
    ],
  },
  {
    day: "Earlier",
    items: [
      emoji("🎭", "#EFEAF7", "Created Anon card", "new identity", "3d"),
      provider("reddit", "Verified on Reddit", "u/finnriver · Everyday", "3d"),
    ],
  },
];
