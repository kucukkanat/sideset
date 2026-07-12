export interface CardPlacement {
  readonly x: number;
  readonly rotateY: number;
  readonly scale: number;
  readonly translateZ: number;
  readonly zIndex: number;
  readonly opacity: number;
  /** 0…0.46 darkening overlay as the card turns away. */
  readonly dim: number;
}

export const wrapIndex = (i: number, n: number): number => ((i % n) + n) % n;

/** Signed continuous distance from the (fractional) front position, in (-n/2, n/2]. */
export const signedDistance = (index: number, pos: number, n: number): number => {
  let rel = (((index - pos) % n) + n) % n;
  if (rel > n / 2) rel -= n;
  return rel;
};

/** ~150px of drag travel = one full carousel step; clamped so cards never over-rotate. */
export const dragFraction = (dragX: number, step = 150): number =>
  Math.max(-1.15, Math.min(1.15, -dragX / step));

/**
 * Coverflow placement: the front card pivots in place; flanks hold their slots.
 * Non-linear x keeps small drags reading as rotation, not translation.
 */
export const cardPlacement = (rel: number): CardPlacement => {
  const ar = Math.min(Math.abs(rel), 1);
  const sgn = rel < 0 ? -1 : 1;
  return {
    x: sgn * Math.min(Math.abs(rel), 2) ** 1.4 * 122,
    rotateY: -Math.max(-1.3, Math.min(1.3, rel)) * 52,
    scale: 1 - ar * 0.18,
    translateZ: -ar * 96,
    zIndex: Math.round(20 - Math.abs(rel) * 5),
    opacity: Math.abs(rel) > 1.5 ? 0 : 1,
    dim: Math.min(0.46, ar * 0.3),
  };
};

/** Weighted rubber-band applied to raw drag pixels so the card feels heavy, not 1:1. */
export const dampDrag = (dx: number): number => (dx >= 0 ? dx ** 0.92 : -((-dx) ** 0.92));
