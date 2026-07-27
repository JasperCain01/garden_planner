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
 * Standard implementation: an `<a href="#plot-canvas">` that's visually
 * hidden until it receives keyboard focus, so sighted mouse users never see
 * it but a keyboard user tabbing from the top of the page meets it first.
 * No CSS file exists in this app (every other component uses inline
 * `style`), so "hidden until focused" is a small `useState` toggle on
 * `onFocus`/`onBlur` rather than a `:focus` pseudo-class — the same
 * inline-styles convention as everywhere else here, not a special case.
 */

import { useState } from 'react';

export function SkipToCanvasLink() {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <a
      href="#plot-canvas"
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={
        isFocused
          ? {
              position: 'fixed',
              top: '0.5rem',
              left: '0.5rem',
              zIndex: 10,
              padding: '0.5rem 0.75rem',
              background: '#1a7f37',
              color: '#ffffff',
              borderRadius: '0.25rem',
              textDecoration: 'none',
            }
          : {
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
            }
      }
    >
      Skip to plot canvas
    </a>
  );
}
