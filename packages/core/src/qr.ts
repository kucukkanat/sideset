export const QR_SIZE = 21;

/**
 * Deterministic QR-look-alike pattern (finder squares + seeded noise).
 * Decorative only — the design renders a stylised code, not a scannable one.
 */
export const qrPattern = (seed: string): readonly boolean[] => {
  const cells: boolean[] = [];
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const rnd = (): number => {
    s = (s * 1103515245 + 12345) >>> 0;
    return (s >>> 16) / 65535;
  };
  const inFinder = (r: number, c: number): boolean => {
    const q = (a: number, b: number): boolean => r >= a && r < a + 7 && c >= b && c < b + 7;
    return q(0, 0) || q(0, 14) || q(14, 0);
  };
  for (let r = 0; r < QR_SIZE; r++) {
    for (let c = 0; c < QR_SIZE; c++) {
      if (inFinder(r, c)) {
        const cr = r < 7 ? r : r - 14;
        const cc = c < 7 ? c : c - 14;
        cells.push(
          cr === 0 ||
            cr === 6 ||
            cc === 0 ||
            cc === 6 ||
            (cr >= 2 && cr <= 4 && cc >= 2 && cc <= 4),
        );
      } else {
        cells.push(rnd() > 0.55);
      }
    }
  }
  return cells;
};
