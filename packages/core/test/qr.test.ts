import { describe, expect, test } from "bun:test";
import { QR_SIZE, qrPattern } from "@keychain/core";

const at = (cells: readonly boolean[], r: number, c: number): boolean =>
  cells[r * QR_SIZE + c] === true;

describe("qrPattern", () => {
  test("produces a full 21×21 grid", () => {
    expect(qrPattern("keychain.me/everyday")).toHaveLength(QR_SIZE * QR_SIZE);
  });
  test("is deterministic per seed and differs across seeds", () => {
    const a = qrPattern("seed-a");
    expect(a).toEqual(qrPattern("seed-a"));
    expect(a).not.toEqual(qrPattern("seed-b"));
  });
  test("draws the three finder squares regardless of seed", () => {
    const cells = qrPattern("anything");
    for (const [r0, c0] of [
      [0, 0],
      [0, 14],
      [14, 0],
    ] as const) {
      // outer ring on, inner ring off, centre 3×3 on
      expect(at(cells, r0, c0)).toBe(true);
      expect(at(cells, r0 + 6, c0 + 6)).toBe(true);
      expect(at(cells, r0 + 1, c0 + 1)).toBe(false);
      expect(at(cells, r0 + 3, c0 + 3)).toBe(true);
    }
  });
});
