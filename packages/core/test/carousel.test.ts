import { describe, expect, test } from "bun:test";
import { cardPlacement, dampDrag, dragFraction, signedDistance, wrapIndex } from "@keychain/core";

describe("wrapIndex", () => {
  test("wraps both directions", () => {
    expect(wrapIndex(0, 3)).toBe(0);
    expect(wrapIndex(4, 3)).toBe(1);
    expect(wrapIndex(-1, 3)).toBe(2);
  });
});

describe("signedDistance", () => {
  test("is 0 at the front and signed on the flanks", () => {
    expect(signedDistance(1, 1, 3)).toBe(0);
    expect(signedDistance(2, 1, 3)).toBe(1);
    expect(signedDistance(0, 1, 3)).toBe(-1);
  });
  test("takes the short way around the ring", () => {
    expect(signedDistance(0, 4, 5)).toBe(1);
    expect(signedDistance(4, 0, 5)).toBe(-1);
  });
  test("supports fractional positions mid-drag", () => {
    expect(signedDistance(1, 0.5, 3)).toBeCloseTo(0.5);
  });
});

describe("dragFraction", () => {
  test("one step per 150px, drag left advances", () => {
    expect(dragFraction(-150)).toBeCloseTo(1);
    expect(dragFraction(75)).toBeCloseTo(-0.5);
  });
  test("clamps to ±1.15", () => {
    expect(dragFraction(-10000)).toBe(1.15);
    expect(dragFraction(10000)).toBe(-1.15);
  });
});

describe("cardPlacement", () => {
  test("front card sits centred, full size, undimmed", () => {
    const p = cardPlacement(0);
    expect(p.x).toBe(0);
    expect(p.rotateY).toBe(-0);
    expect(p.scale).toBe(1);
    expect(p.translateZ).toBe(-0);
    expect(p.zIndex).toBe(20);
    expect(p.opacity).toBe(1);
    expect(p.dim).toBe(0);
  });
  test("flank card is offset, rotated, scaled back and dimmed", () => {
    const p = cardPlacement(1);
    expect(p.x).toBeCloseTo(122);
    expect(p.rotateY).toBe(-52);
    expect(p.scale).toBeCloseTo(0.82);
    expect(p.translateZ).toBe(-96);
    expect(p.zIndex).toBe(15);
    expect(p.dim).toBeCloseTo(0.3);
  });
  test("mirror symmetry on the left flank", () => {
    const p = cardPlacement(-1);
    expect(p.x).toBeCloseTo(-122);
    expect(p.rotateY).toBe(52);
  });
  test("rotation clamps past 1.3 and cards past 1.5 vanish", () => {
    expect(cardPlacement(2).rotateY).toBe(-1.3 * 52);
    expect(cardPlacement(2).opacity).toBe(0);
    expect(cardPlacement(1.4).opacity).toBe(1);
  });
  test("dim caps at 0.46 equivalent clamp", () => {
    expect(cardPlacement(3).dim).toBeCloseTo(0.3); // ar clamps to 1 first
  });
});

describe("dampDrag", () => {
  test("sub-linear and sign-preserving", () => {
    expect(dampDrag(0)).toBe(0);
    expect(dampDrag(100)).toBeCloseTo(100 ** 0.92);
    expect(dampDrag(-100)).toBeCloseTo(-(100 ** 0.92));
    expect(dampDrag(100)).toBeLessThan(100);
  });
});
