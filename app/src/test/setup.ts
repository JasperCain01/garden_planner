/**
 * Global Vitest setup (Workplan Stage 3.4). One job today: stub out
 * `react-konva` for every component test.
 *
 * Two separate problems make this necessary, not just tidy:
 *
 * 1. **`konva`'s `main` field crashes on import under Node.** `konva`
 *    ships a browser build (`browser` field, what a real Vite build always
 *    resolves) and a Node build (`main`, `lib/index-node.js`) that `require`s
 *    the optional native `canvas` package for server-side rendering. Vitest
 *    runs under Node, so — unlike the shipped app — it follows `main`, and
 *    this repository deliberately does not install `canvas` (a native addon
 *    with system-library build requirements that would undercut "easy to
 *    clone and build", `WORKPLAN.md` §0.2, for a capability nothing here
 *    needs). Without this mock, merely *importing* `react-konva` inside a
 *    Vitest run throws `Cannot find module 'canvas'` — before any component
 *    even renders.
 * 2. **Even with that solved, a Konva `<Stage>` renders to an HTML5
 *    `<canvas>`, which jsdom cannot back and which has no DOM structure to
 *    query or click anyway** — the same limitation ADR 0016 already
 *    documented for `PlotOutlineEditor`'s design. `PlotCanvas.tsx` (Stage
 *    3.4) is deliberately not component-tested for this reason; see
 *    `docs/adr/0017-plot-canvas-konva-and-dnd-kit.md` for what covers it
 *    instead (the pure logic it's built on, plus Playwright E2E).
 *
 * This mock exists so tests that render a page *containing* the canvas
 * (`PlotDefinitionPage.test.tsx`) can still exercise everything else on that
 * page without tripping over either problem — not to pretend the Konva scene
 * itself is under test.
 */

import { createElement, type PropsWithChildren, type ReactElement } from 'react';
import { vi } from 'vitest';

function konvaMock(tag: string) {
  return function MockKonvaNode({ children }: PropsWithChildren): ReactElement {
    return createElement('div', { 'data-konva-mock': tag }, children);
  };
}

vi.mock('react-konva', () => ({
  Stage: konvaMock('Stage'),
  Layer: konvaMock('Layer'),
  Group: konvaMock('Group'),
  Line: konvaMock('Line'),
  Circle: konvaMock('Circle'),
  Text: konvaMock('Text'),
}));
