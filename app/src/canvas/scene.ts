/**
 * The colours the Konva scene paints with (UI redesign Phase 2).
 *
 * **Why this file exists at all.** Konva draws to a `<canvas>`, so it cannot
 * read a CSS custom property — every colour it uses has to be a literal
 * string. Phase 0 met that with two small maps held in TypeScript
 * (`PlotCanvas.tsx`'s `CATEGORY_COLORS`, `warnings/severity.ts`'s
 * `SEVERITY_COLORS`) and mirrored into `styles/tokens.css`, with
 * `styles/tokens.test.ts` failing if the copies drift. Phase 2 turns the
 * canvas from a green rectangle into a whole scene — soil surround, plot fill,
 * two grid densities, dimension labels, outline handles — and every one of
 * those needs a literal too.
 *
 * **These are not new colours.** They are the *existing* design tokens,
 * spelled out for Konva. The key of each entry is the token's own name, and
 * `styles/tokens.test.ts` asserts each value equals what `tokens.css` declares
 * for that name — so this map cannot invent a fourth green or drift away from
 * the one the DOM uses. Adding an entry here means picking a token, not
 * picking a colour; if nothing in `tokens.css` is right, the token goes there
 * first and this map follows.
 *
 * Alpha variants are derived at the point of use with {@link withAlpha}
 * rather than stored, for the same reason: a translucent green must
 * demonstrably be *the* green, not a hand-mixed near-miss.
 */

/**
 * Design tokens, as literal strings for Konva. Keys are `tokens.css` custom
 * property names without the `--` prefix; `styles/tokens.test.ts` guards every
 * one against its declaration there.
 */
export const SCENE_COLORS = {
  /** The plot's interior fill. */
  'green-100': '#d8f3dc',
  /** The 1m grid, the "drag lands here" tint, the corner handles. */
  'green-500': '#40916c',
  /** The outline stroke, and a selected marker's glow ring. */
  'green-700': '#2d6a4f',
  /** The ground outside the plot — matches the viewport's own CSS background, so the stage and its surround read as one surface. */
  'soil-100': '#efe6dc',
  /** Dimension labels, on that soil surround (6.01:1 — see this file's contrast note in `docs/accessibility.md` §7). */
  'soil-700': '#6f4e37',
  /** The "add a corner here" midpoint handles, matching the same affordance's colour in the DOM. */
  'sky-500': '#4d94c4',
  /** Marker outlines and tooltip fill — the same white every card in the app uses. */
  'surface-card': '#ffffff',
  /** Tooltip text. */
  'text-strong': '#1b2b23',
  /** An outline edit that doesn't validate. */
  danger: '#b3261e',
} as const;

/**
 * `hex` as an `rgba()` string at `alpha` — Konva accepts CSS colour strings,
 * and this keeps every translucent fill provably the same hue as its opaque
 * token rather than a separately-chosen tint.
 *
 * Accepts only the 6-digit `#rrggbb` form, which is the only form
 * {@link SCENE_COLORS} and `tokens.css` use.
 */
export function withAlpha(hex: string, alpha: number): string {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

/**
 * `hex`, converted to a neutral grey at the same perceived lightness (Rec.
 * 601 luma: `0.299R + 0.587G + 0.114B`) — post-review fix B3's "desaturated"
 * treatment for a marker whose placement has been stranded outside the plot
 * outline by a reshape. Derived at the point of use from the crop's own
 * category colour, the same way {@link withAlpha} derives a translucent
 * variant, rather than a fourth hand-picked grey living beside
 * {@link SCENE_COLORS}: the marker is still honestly "this crop, muted", not
 * a new colour with its own meaning to learn.
 */
export function desaturateColor(hex: string): string {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const gray = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
  const channel = gray.toString(16).padStart(2, '0');
  return `#${channel}${channel}${channel}`;
}
