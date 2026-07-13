import { describe, expect, test } from "bun:test";
import type { ActivityFact } from "../../../src/contracts/capabilities.ts";
import type { ActivityItem } from "../../../src/features/activity/activity.ts";
import { MAX_ACTIVITY_ITEMS, projectActivityFact } from "../../../src/features/activity/journal.ts";

const NOW = 1_700_000_000_000;
const context = { id: () => "projected-id" } as const;

const cases: readonly {
  readonly fact: ActivityFact;
  readonly expected: Pick<ActivityItem, "icon" | "title" | "sub">;
}[] = [
  {
    fact: {
      kind: "identity.activated",
      name: "Work",
      previousName: "Everyday",
      occurredAt: NOW,
    },
    expected: {
      icon: { kind: "emoji", emoji: "🔄", bg: "#EDE7FB" },
      title: "Switched to Work",
      sub: "from Everyday",
    },
  },
  {
    fact: { kind: "identity.created", name: "Anon", avatar: "🎭", occurredAt: NOW },
    expected: {
      icon: { kind: "emoji", emoji: "🎭", bg: "#E9F7EC" },
      title: "Created Anon card",
      sub: "A separate profile",
    },
  },
  {
    fact: {
      kind: "identity.updated",
      name: "Everyday",
      avatar: "data:image/png;base64,a",
      occurredAt: NOW,
    },
    expected: {
      icon: { kind: "emoji", emoji: "🙂", bg: "#FCEDE7" },
      title: "Updated Everyday",
      sub: "Card details changed",
    },
  },
  {
    fact: { kind: "identity.deleted", name: "Old", avatar: "", occurredAt: NOW },
    expected: {
      icon: { kind: "emoji", emoji: "🗑️", bg: "#FDECE7" },
      title: "Deleted Old",
      sub: "Identity removed from this device",
    },
  },
  {
    fact: {
      kind: "account.connected",
      provider: "github",
      username: "finnriver",
      identityName: "Everyday",
      occurredAt: NOW,
    },
    expected: {
      icon: { kind: "provider", provider: "github" },
      title: "Connected finnriver",
      sub: "Everyday · GitHub",
    },
  },
  {
    fact: {
      kind: "account.disconnected",
      provider: "twitter",
      identityName: "Work",
      occurredAt: NOW,
    },
    expected: {
      icon: { kind: "provider", provider: "twitter" },
      title: "Disconnected X",
      sub: "Work",
    },
  },
  {
    fact: { kind: "person.added", name: "Aria", avatar: "🦉", occurredAt: NOW },
    expected: {
      icon: { kind: "emoji", emoji: "🦉", bg: "#E9F7EC" },
      title: "Added Aria",
      sub: "Saved to contacts",
    },
  },
  {
    fact: {
      kind: "person.updated",
      name: "Aria Local",
      avatar: "data:image/webp;base64,a",
      occurredAt: NOW,
    },
    expected: {
      icon: { kind: "emoji", emoji: "👤", bg: "#EDE7FB" },
      title: "Updated Aria Local",
      sub: "Contact details changed",
    },
  },
  {
    fact: {
      kind: "people.removed",
      count: 1,
      firstName: "Milo",
      firstAvatar: "🐈",
      occurredAt: NOW,
    },
    expected: {
      icon: { kind: "emoji", emoji: "🐈", bg: "#FDECE7" },
      title: "Removed Milo",
      sub: "From contacts",
    },
  },
  {
    fact: {
      kind: "people.removed",
      count: 3,
      firstName: "Aria",
      firstAvatar: "🦉",
      occurredAt: NOW,
    },
    expected: {
      icon: { kind: "emoji", emoji: "🗑️", bg: "#FDECE7" },
      title: "Removed 3 contacts",
      sub: "From contacts",
    },
  },
  {
    fact: { kind: "backup.prepared", occurredAt: NOW },
    expected: {
      icon: { kind: "emoji", emoji: "🛡️", bg: "#E9F7EC" },
      title: "Prepared an encrypted backup",
      sub: "Ready to download",
    },
  },
  {
    fact: { kind: "backup.restored", occurredAt: NOW },
    expected: {
      icon: { kind: "emoji", emoji: "📥", bg: "#FFF6DB" },
      title: "Restored a local backup",
      sub: "Selected backup data imported",
    },
  },
];

describe("activity fact projection", () => {
  test("owns the exhaustive presentation mapping", () => {
    for (const { fact, expected } of cases) {
      expect(projectActivityFact([], fact, context)).toEqual([
        { id: "projected-id", ...expected, occurredAt: NOW },
      ]);
    }
  });

  test("prepends immutably and retains exactly the newest 100 items", () => {
    const existing = Array.from(
      { length: MAX_ACTIVITY_ITEMS },
      (_, index): ActivityItem => ({
        id: `existing-${index}`,
        icon: { kind: "emoji", emoji: "•", bg: "#000000" },
        title: `Existing ${index}`,
        sub: "",
        occurredAt: NOW - index - 1,
      }),
    );
    const before = structuredClone(existing);

    const projected = projectActivityFact(
      existing,
      { kind: "backup.prepared", occurredAt: NOW },
      context,
    );

    expect(projected).toHaveLength(MAX_ACTIVITY_ITEMS);
    expect(projected[0]?.id).toBe("projected-id");
    expect(projected.at(-1)?.id).toBe("existing-98");
    expect(existing).toEqual(before);
    expect(projected).not.toBe(existing);
  });
});
