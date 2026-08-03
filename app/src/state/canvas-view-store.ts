/**
 * How the plot canvas is currently being *looked at* (UI redesign Phase 2):
 * how big its viewport measured, how far it is zoomed past "fit", and whether
 * the outline is being edited. Follows ADR 0015's convention — one small,
 * focused Zustand store per concern, plain data in and out — alongside
 * `plot-store.ts` (what the plot *is*) and `placements-store.ts` (what is on
 * it).
 *
 * **Why a store rather than component state.** The live scale has four
 * consumers in three different subtrees, and prop-threading it would have made
 * one of them impossible without moving state to a common ancestor that has no
 * business owning it:
 *
 * - `canvas/PlotCanvas.tsx` draws the stage at it;
 * - `canvas/PlotCanvasSection.tsx` puts the zoom controls on the toolbar, and
 *   passes it to `canvas/export.ts`;
 * - `canvas/useCanvasDropHandler.ts` converts a drop point with it — and that
 *   one is called by `plot/PlotDefinitionPage.tsx`, which owns the
 *   `DndContext` and sits *above* the canvas region entirely.
 *
 * The last one is the reason. `PlotDefinitionPage` would otherwise have to own
 * a scale measured from an element two components below it, which is the shape
 * of prop-drilling this codebase already answers with a store (the palette
 * reads `plot-store` directly rather than being handed conditions).
 *
 * **The zoom is a factor over fit, not an absolute scale.** Storing `1.25`
 * ("a quarter more than fits") rather than `2.6 px/cm` means resizing the
 * window, or applying a new plot shape, re-fits the plot and *keeps* the
 * user's zoom intent instead of leaving them at a scale that no longer relates
 * to anything. `canvas/useCanvasScale.ts` combines the two.
 */

import { create } from 'zustand';
import type { Vertex } from '@garden-planner/engine';
import type { ViewportPx } from '../canvas/geometry.ts';

/** How much one press of the zoom buttons (or one ctrl+wheel notch) changes the scale. A quarter is small enough to aim with and large enough that three presses are visibly different. */
export const ZOOM_STEP = 1.25;

/** The unmeasured viewport, which `geometry.ts#fitPxPerCm` answers with `FALLBACK_PX_PER_CM`. A module-level constant so the initial state is referentially stable and a selector on it can't loop. */
const UNMEASURED: ViewportPx = { width: 0, height: 0 };

interface CanvasViewState {
  /** The canvas viewport's measured content box. `{0, 0}` until a `ResizeObserver` reports (and forever under jsdom, which has no layout). */
  readonly viewportPx: ViewportPx;
  /** Multiplier over the scale at which the plot exactly fits its viewport. `1` is "fit". */
  readonly zoomFactor: number;
  /** Whether the canvas is in outline-editing mode (corner handles shown, arrow keys move a corner rather than a plant). */
  readonly editingOutline: boolean;
  /** Which corner the keyboard is currently acting on, or `null`. Meaningless unless `editingOutline`. */
  readonly selectedCornerIndex: number | null;
  /** The message from the last outline edit that failed `safeValidatePlotRegion`, or `null`. */
  readonly outlineError: string | null;
  /**
   * The outline as last *attempted*, which differs from `plot-store`'s
   * committed region only while an edit is invalid.
   *
   * `plot-store` holds validated regions only, by design — so without this a
   * corner dragged into a self-intersection would snap back under the pointer
   * mid-gesture, and the error message would describe a shape no longer on
   * screen. `PlotOutlineEditor.tsx` kept exactly this draft for exactly this
   * reason; merging the editor into the canvas kept the idea and moved it
   * here, where the canvas can read it.
   */
  readonly draftVertices: readonly Vertex[] | null;

  /** Record a fresh measurement. A no-op when the size hasn't actually changed, so a `ResizeObserver` firing on every scroll can't spin the render loop. */
  readonly setViewportPx: (viewport: ViewportPx) => void;
  /** Multiply the zoom factor (`ZOOM_STEP` to zoom in, `1 / ZOOM_STEP` to zoom out). Clamping to a usable scale happens in `useCanvasScale`, where the fitted scale is known. */
  readonly zoomBy: (factor: number) => void;
  /** Back to "the plot exactly fits". */
  readonly resetZoom: () => void;
  /** Enter or leave outline-editing mode. Leaving always drops the corner selection, the draft, and any stale error. */
  readonly setEditingOutline: (editing: boolean) => void;
  readonly selectCorner: (index: number | null) => void;
  /** Record an attempted edit: the shape to draw, and the reason it wasn't committed (`null` when it was). */
  readonly setOutlineDraft: (vertices: readonly Vertex[] | null, error: string | null) => void;
}

export const useCanvasViewStore = create<CanvasViewState>((set) => ({
  viewportPx: UNMEASURED,
  zoomFactor: 1,
  editingOutline: false,
  selectedCornerIndex: null,
  outlineError: null,
  draftVertices: null,

  setViewportPx: (viewport) =>
    set((state) =>
      state.viewportPx.width === viewport.width && state.viewportPx.height === viewport.height
        ? state
        : { viewportPx: viewport },
    ),

  zoomBy: (factor) => set((state) => ({ zoomFactor: state.zoomFactor * factor })),

  resetZoom: () => set({ zoomFactor: 1 }),

  setEditingOutline: (editing) =>
    set(
      editing
        ? { editingOutline: true }
        : {
            editingOutline: false,
            selectedCornerIndex: null,
            outlineError: null,
            draftVertices: null,
          },
    ),

  selectCorner: (index) => set({ selectedCornerIndex: index }),

  setOutlineDraft: (vertices, error) => set({ draftVertices: vertices, outlineError: error }),
}));
