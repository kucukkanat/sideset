import { describe, expect, test } from "bun:test";
import { QR_SIZE, qrPattern } from "@keychain/core";

const at = (cells: readonly boolean[], row: number, column: number): boolean =>
  cells[row * QR_SIZE + column] === true;

describe("qrPattern", () => {
  test("produces a full 21×21 grid", () => {
    expect(qrPattern("keychain.me/everyday")).toHaveLength(QR_SIZE * QR_SIZE);
  });

  test("is deterministic per seed and differs across seeds", () => {
    const cells = qrPattern("seed-a");
    expect(cells).toEqual(qrPattern("seed-a"));
    expect(cells).not.toEqual(qrPattern("seed-b"));
  });

  test("draws the three finder squares regardless of seed", () => {
    const cells = qrPattern("anything");
    for (const [top, left] of [
      [0, 0],
      [0, 14],
      [14, 0],
    ] as const) {
      expect(at(cells, top, left)).toBe(true);
      expect(at(cells, top + 6, left + 6)).toBe(true);
      expect(at(cells, top + 1, left + 1)).toBe(false);
      expect(at(cells, top + 3, left + 3)).toBe(true);
    }
  });
});
