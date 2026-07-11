import type { Palette } from "./types.ts";

export const PALETTES: readonly [Palette, ...Palette[]] = [
  {
    grad: "linear-gradient(140deg,#FF7A45 0%,#E8502A 55%,#C0341A 100%)",
    shadow: "rgba(224,80,42,.55)",
  },
  {
    grad: "linear-gradient(140deg,#4A6CF7 0%,#3A4FCB 55%,#28308F 100%)",
    shadow: "rgba(58,79,203,.5)",
  },
  {
    grad: "linear-gradient(140deg,#4B4A54 0%,#2E2D36 60%,#1A1920 100%)",
    shadow: "rgba(30,29,38,.55)",
  },
  {
    grad: "linear-gradient(140deg,#22C1A6 0%,#12A08C 55%,#0A7768 100%)",
    shadow: "rgba(18,160,140,.5)",
  },
  {
    grad: "linear-gradient(140deg,#C86BE0 0%,#9C43C9 55%,#6F2C9E 100%)",
    shadow: "rgba(156,67,201,.5)",
  },
  {
    grad: "linear-gradient(140deg,#F5A623 0%,#EA8318 55%,#C96A0C 100%)",
    shadow: "rgba(234,131,24,.5)",
  },
];

export const paletteFor = (color: number): Palette => {
  const n = PALETTES.length;
  return PALETTES[((color % n) + n) % n] ?? PALETTES[0];
};
