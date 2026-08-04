/**
 * The two accessible names a palette row exposes, in one place.
 *
 * These are the **most load-bearing selectors in the E2E suite**. `e2e/drag.ts`
 * finds the drag surface by an *anchored* match on {@link paletteDragLabel} —
 * anchored, and naming the crop, because a wildcard plus `.first()` silently
 * drags whatever stale entry is still rendered (that module's doc records the
 * real failure it caused). `e2e/a11y.spec.ts`, `e2e/canvas-scale.spec.ts` and
 * `keyboard-walkthrough.mjs` all reach the keyboard placement path through
 * {@link paletteAddLabel}.
 *
 * Until UI redesign Phase 3 both strings were written out in `PlantPalette.tsx`
 * and again, as regex source, in `e2e/drag.ts`. That is a duplication that
 * rots in exactly one direction — the component's label changes, the spec's
 * regex stops matching anything, and an anchored locator that matches nothing
 * fails several assertions later with a message about something else. This
 * module is imported by both, the same way `e2e/drag.ts` already imports
 * `CANVAS_PADDING_CM` from the app rather than restating it: a rename now moves
 * the specs with it instead of leaving them quietly aiming elsewhere.
 *
 * It is deliberately dependency-free (a string in, a string out — no React, no
 * CSS Modules, not even an engine type), because Playwright's TypeScript loader
 * imports it directly out of `app/src`.
 */

/**
 * The drag surface's name — and, since Phase 3, its *other* job.
 *
 * The card is one element with two gestures on it: dragging places the crop,
 * pressing it discloses the engine's reasoning (ADR 0032 §2). A name that
 * mentioned only the drag would leave a screen-reader user with no idea that
 * the thing they just heard announced as "collapsed" opens anything, so the
 * name says both. The old wording is kept verbatim as the prefix, so the
 * anchored regexes in `e2e/drag.ts` gained a suffix rather than being rewritten.
 */
export function paletteDragLabel(commonName: string): string {
  return `drag ${commonName} onto the plot to place it, or press to see why it ranks here`;
}

/**
 * The `＋` button's name (Workplan Stage 6.2, ADR 0026 — the keyboard
 * placement path). Phase 3 shrank the button's *drawing* to a single glyph and
 * left its name alone: an icon-only control is compact on screen and never in
 * the accessibility tree.
 */
export function paletteAddLabel(commonName: string): string {
  return `Add ${commonName} to the plot, without dragging`;
}
