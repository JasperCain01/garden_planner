/**
 * The workspace's skip links (WCAG 2.4.1 "Bypass Blocks") — visually hidden
 * until focused, so sighted mouse users never see them and a keyboard user
 * tabbing from the top of the page meets them first.
 *
 * **Why there are two of them (UI redesign Phase 1).** Stage 6.2 added the
 * first, "Skip to plot canvas", for a friction its keyboard-only walkthrough
 * measured (`docs/accessibility.md`): placing a crop via the palette's "Add to
 * plot" button leaves focus in the palette, and reaching the canvas
 * (`canvas/PlotCanvas.tsx`'s `#plot-canvas`) to nudge that placement meant
 * tabbing through every remaining palette row first — over 20 presses for a
 * six-crop search match, and ~290 for the unfiltered list.
 *
 * The workspace layout doesn't create that block, but it does move it. Reading
 * order now runs plants → plot → settings, so the *shape and conditions form
 * sits behind the whole palette* where before it came first. That is a real
 * cost of putting the palette beside the canvas, and the honest answer is the
 * one Stage 6.2 already reached for: a second skip link, straight to the
 * settings column. The alternative — ordering the DOM differently from the
 * visible columns with `grid-column` — would fix the tab count by breaking
 * WCAG 2.4.3's focus order, which is a worse trade than one more link.
 *
 * Both are plain `<a href="#…">`s pointing at elements that can take focus:
 * the canvas is `tabIndex={0}` for its own arrow-key nudging, and the settings
 * region carries `tabIndex={-1}` purely so an anchor jump lands focus there
 * (browsers don't move focus to a non-focusable target on their own).
 *
 * **Why this is CSS and no state (UI redesign Phase 0).** Stage 6.2 wrote
 * "hidden until focused" as a `useState` toggle on `onFocus`/`onBlur` for one
 * reason it stated plainly: there was no stylesheet in this app to put a
 * `:focus` rule in. Phase 0 added one, so this is the plain pattern — which
 * also keeps working if React hasn't hydrated yet.
 */

import styles from './SkipLinks.module.css';

/** The settings column's anchor-target id (`PlotDefinitionPage.tsx` puts it on the region, with `tabIndex={-1}` so focus can land there). */
export const PLOT_SETTINGS_ID = 'plot-settings';

export function SkipLinks() {
  return (
    <>
      <a href="#plot-canvas" className={styles.skipLink}>
        Skip to plot canvas
      </a>
      <a href={`#${PLOT_SETTINGS_ID}`} className={styles.skipLink}>
        Skip to plot settings
      </a>
    </>
  );
}
