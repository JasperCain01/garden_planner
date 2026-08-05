/**
 * Guards the colour mappings that exist in *both* TypeScript and CSS
 * (UI redesign Phase 0, ADR 0029; extended in Phase 2).
 *
 * `canvas/PlotCanvas.tsx`, `canvas/scene.ts` and `warnings/severity.ts` have to
 * hold their colours as literal strings because Konva paints a `<canvas>` and
 * can't read a CSS custom property. The DOM side of the same ideas — a
 * category chip, a severity label, the soil-coloured surround behind the
 * stage — has to read them from `tokens.css`. So the values are written twice,
 * which is exactly the kind of duplication that silently rots: someone
 * re-tunes a severity colour for contrast, the canvas badge follows, the
 * warnings list quietly doesn't.
 *
 * This test reads the stylesheet off disk and asserts the two copies still
 * agree. It is not a style test — it never renders anything — it is a
 * consistency test over two source files, in the same spirit as
 * `icons/budget.test.ts` guarding the icon size budget.
 *
 * (Read with `node:fs` rather than Vite's `?raw`: Vitest is configured without
 * CSS processing, which substitutes *every* CSS import — `?raw` included —
 * with an empty string, so `?raw` silently reads as "".)
 *
 * The suitability-band colours are deliberately *not* here: they have no Konva
 * consumer, so `tokens.css` is their only home and there is nothing to drift
 * against.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CATEGORY_COLORS } from '../canvas/PlotCanvas.tsx';
import { SCENE_COLORS } from '../canvas/scene.ts';
import { SEVERITY_COLORS } from '../warnings/severity.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(path.join(here, 'tokens.css'), 'utf8');

/** The value of a `--custom-property` in `tokens.css`'s `:root` block, lower-cased for comparison. */
function tokenValue(name: string): string | undefined {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(tokensCss);
  return match?.[1].trim().toLowerCase();
}

describe('tokens.css mirrors the colour maps Konva needs as literals', () => {
  it('has a --category-* token matching every CATEGORY_COLORS entry', () => {
    for (const [category, hex] of Object.entries(CATEGORY_COLORS)) {
      expect(tokenValue(`category-${category}`), `--category-${category}`).toBe(hex.toLowerCase());
    }
  });

  it('has a --severity-* token matching every SEVERITY_COLORS entry', () => {
    for (const [severity, hex] of Object.entries(SEVERITY_COLORS)) {
      expect(tokenValue(`severity-${severity}`), `--severity-${severity}`).toBe(hex.toLowerCase());
    }
  });

  /**
   * `canvas/scene.ts` is the strictest case of the three, and deliberately so:
   * its keys *are* token names, so the guard isn't "these two families agree"
   * but "the canvas is painting with the app's own palette". That is what
   * stops UI redesign Phase 2's scene — soil surround, plot fill, grid,
   * dimension labels, outline handles — from quietly becoming a fourth green
   * and a second brown that nothing else in the app uses.
   */
  it('paints the Konva scene with values taken from tokens.css, not near-misses', () => {
    for (const [token, hex] of Object.entries(SCENE_COLORS)) {
      expect(tokenValue(token), `--${token}`).toBe(hex.toLowerCase());
    }
  });
});
