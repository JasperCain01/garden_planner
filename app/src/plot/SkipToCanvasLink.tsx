/**
 * "Skip to plot canvas" — a standard skip-link pattern (WCAG 2.4.1 "Bypass
 * Blocks"), added for a real, measured friction the keyboard-only walkthrough
 * found (Workplan Stage 6.2, `docs/accessibility.md`): placing a crop via
 * the palette's "Add to plot" button leaves focus in the palette, and
 * reaching `canvas/PlotCanvas.tsx`'s canvas (`#plot-canvas`) to nudge the new
 * placement into position means tabbing through every remaining filtered
 * palette row *and* the whole "Add your own crop" form first — over 20 tab
 * presses in that walkthrough's six-crop search match.
 *
 * Standard implementation: an `<a href="#plot-canvas">` that's visually hidden
 * until it receives keyboard focus, so sighted mouse users never see it but a
 * keyboard user tabbing from the top of the page meets it first.
 *
 * **Why this is now two CSS rules and no state (UI redesign Phase 0).** Stage
 * 6.2 wrote "hidden until focused" as a `useState` toggle on `onFocus`/`onBlur`
 * for one reason it stated plainly: there was no stylesheet in this app to put
 * a `:focus` rule in. Phase 0 adds one, so the component drops the state and
 * the two inline style objects for `SkipToCanvasLink.module.css` — the plain
 * pattern, which also keeps working if React hasn't hydrated yet.
 */

import styles from './SkipToCanvasLink.module.css';

export function SkipToCanvasLink() {
  return (
    <a href="#plot-canvas" className={styles.skipLink}>
      Skip to plot canvas
    </a>
  );
}
