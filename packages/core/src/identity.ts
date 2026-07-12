import { PROVIDER_META } from "./providers.ts";
import type { Proof } from "./types.ts";

/** "X · GitHub +2" — the short proof list shown on a card face. */
export const proofsSummary = (proofs: readonly Proof[]): string => {
  if (proofs.length === 0) return "No accounts connected";
  const names = proofs.map((p) => PROVIDER_META[p.provider].name);
  if (names.length <= 2) return names.join(" · ");
  return `${names.slice(0, 2).join(" · ")} +${names.length - 2}`;
};

export const friendlyId = (name: string): string =>
  `keychain.me/${name.toLowerCase().replace(/\s+/g, "")}`;

export const greetingFor = (hour: number): string =>
  hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

/** 0 (unusable) … 3 (very strong). */
export const passStrength = (pass: string): number => {
  let n = 0;
  if (pass.length >= 8) n++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) n++;
  if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) n++;
  if (pass.length >= 12 && n >= 2) n = 3;
  return Math.min(n, 3);
};

export const STRENGTH_LABELS = ["Too weak", "Getting there", "Strong", "Very strong"] as const;
export const STRENGTH_COLORS = ["#D14B2E", "#EA8318", "#28B463"] as const;
