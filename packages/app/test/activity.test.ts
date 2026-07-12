import { describe, expect, test } from "bun:test";
import {
  type ActivityItem,
  createInitialActivity,
  formatActivityTime,
  groupActivity,
} from "../src/activity.ts";

const item = (id: string, occurredAt: number): ActivityItem => ({
  id,
  icon: { kind: "emoji", emoji: "•", bg: "#000" },
  title: id,
  sub: "",
  occurredAt,
});

describe("activity grouping", () => {
  test("sorts newest-first, groups by local calendar day, and omits empty groups", () => {
    const now = new Date(2026, 6, 11, 12, 0).getTime();
    const todayEarly = new Date(2026, 6, 11, 0, 1).getTime();
    const todayLate = new Date(2026, 6, 11, 11, 0).getTime();
    const yesterday = new Date(2026, 6, 10, 23, 59).getTime();
    const earlier = new Date(2026, 6, 9, 23, 59).getTime();

    const groups = groupActivity(
      [
        item("earlier", earlier),
        item("today-early", todayEarly),
        item("yesterday", yesterday),
        item("today-late", todayLate),
      ],
      now,
    );

    expect(groups.map((group) => group.day)).toEqual(["Today", "Yesterday", "Earlier"]);
    expect(groups[0]?.items.map(({ id }) => id)).toEqual(["today-late", "today-early"]);
    expect(groups[1]?.items.map(({ id }) => id)).toEqual(["yesterday"]);
    expect(groups[2]?.items.map(({ id }) => id)).toEqual(["earlier"]);
    expect(groupActivity([item("only", todayLate)], now)).toEqual([
      { day: "Today", items: [item("only", todayLate)] },
    ]);
  });

  test("treats future entries as today without mutating the input", () => {
    const now = new Date(2026, 6, 11, 12, 0).getTime();
    const entries = [item("past", now - 1_000), item("future", now + 60_000)] as const;
    const originalOrder = entries.map(({ id }) => id);

    expect(groupActivity(entries, now)[0]?.items.map(({ id }) => id)).toEqual(["future", "past"]);
    expect(entries.map(({ id }) => id)).toEqual(originalOrder);
  });

  test("creates deterministic seed timestamps relative to the supplied clock", () => {
    const now = 2_000_000_000_000;
    const entries = createInitialActivity(now);

    expect(entries).toHaveLength(5);
    expect(entries.map(({ occurredAt }) => now - occurredAt)).toEqual([
      2 * 60_000,
      60 * 60_000,
      5 * 60 * 60_000,
      26 * 60 * 60_000,
      3 * 24 * 60 * 60_000,
    ]);
  });
});

describe("activity time formatting", () => {
  test("formats every threshold and clamps future timestamps", () => {
    const now = 2_000_000_000_000;
    const cases = [
      [now + 1, "Now"],
      [now, "Now"],
      [now - 59_999, "Now"],
      [now - 60_000, "1m"],
      [now - 59 * 60_000, "59m"],
      [now - 60 * 60_000, "1h"],
      [now - 23 * 60 * 60_000, "23h"],
      [now - 24 * 60 * 60_000, "1d"],
      [now - 3 * 24 * 60 * 60_000, "3d"],
    ] as const;

    for (const [occurredAt, expected] of cases) {
      expect(formatActivityTime(occurredAt, now)).toBe(expected);
    }
  });
});
