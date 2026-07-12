export const QR_SIZE = 21;

/**
 * Deterministic QR-look-alike pattern (finder squares + seeded noise).
 * Decorative only — the design renders a stylised code, not a scannable one.
 */
export const qrPattern = (seed: string): readonly boolean[] => {
  const cells: boolean[] = [];
  let state = 0;
  for (let index = 0; index < seed.length; index += 1) {
    state = (state * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const random = (): number => {
    state = (state * 1_103_515_245 + 12_345) >>> 0;
    return (state >>> 16) / 65_535;
  };
  const inFinder = (row: number, column: number): boolean => {
    const contains = (top: number, left: number): boolean =>
      row >= top && row < top + 7 && column >= left && column < left + 7;
    return contains(0, 0) || contains(0, 14) || contains(14, 0);
  };
  for (let row = 0; row < QR_SIZE; row += 1) {
    for (let column = 0; column < QR_SIZE; column += 1) {
      if (inFinder(row, column)) {
        const relativeRow = row < 7 ? row : row - 14;
        const relativeColumn = column < 7 ? column : column - 14;
        cells.push(
          relativeRow === 0 ||
            relativeRow === 6 ||
            relativeColumn === 0 ||
            relativeColumn === 6 ||
            (relativeRow >= 2 && relativeRow <= 4 && relativeColumn >= 2 && relativeColumn <= 4),
        );
      } else {
        cells.push(random() > 0.55);
      }
    }
  }
  return cells;
};
