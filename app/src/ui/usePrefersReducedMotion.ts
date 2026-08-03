/**
 * Whether the user has asked their system for less motion.
 *
 * `styles/global.css` already honours `prefers-reduced-motion` for everything
 * the DOM animates, and has since Phase 0 — but UI redesign Phase 2 animates
 * things Konva paints onto a `<canvas>` (a marker's drop pop), and a
 * stylesheet cannot reach inside a canvas any more than it can hand Konva a
 * custom property. So the query gets read in JavaScript for that one purpose,
 * with the same answer the CSS is acting on.
 *
 * **Live, not read once.** The media query is subscribed to rather than
 * sampled at mount: the preference is an OS setting a user can change while
 * the app is open, and a page that keeps animating until it is reloaded has
 * not really honoured it.
 *
 * Guarded for jsdom, which implements no `matchMedia` at all — component tests
 * get `false`, which is the browser default (motion allowed) rather than a
 * test-only special case.
 */

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const query = window.matchMedia(QUERY);
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
