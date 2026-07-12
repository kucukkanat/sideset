export interface Rect {
  readonly top: number;
  readonly left: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Shared-element morph between a card in a stack and a detail hero header.
 * `fwd` flips card → hero, `rev` flips hero → card. The overlay starts at
 * `rect`, and once the destination screen has mounted we measure `target`
 * and let CSS transition every box property plus rotateY in one move.
 */
export interface Flip {
  readonly id: string;
  readonly kind: "card" | "contact";
  readonly dir: "fwd" | "rev";
  readonly rect: Rect;
  readonly target: Rect | null;
  readonly phase: "start" | "end";
}

export const FALLBACK_CARD_RECT: Rect = { top: 150, left: 24, w: 364, h: 210 };
export const FALLBACK_HERO_RECT: Rect = { top: 0, left: 0, w: 412, h: 320 };
