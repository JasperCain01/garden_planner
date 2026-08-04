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
 *
 * **A "show me this placement" request lives here too, and is a request and
 * not a position** (UI redesign Phase 4, ADR 0033 §6). The warnings dock's
 * "Show me" has to *scroll the plot to* a marker, and ADR 0031 §7 made panning
 * the canvas viewport element's **native scroll** deliberately, so that there
 * is one notion of "where the plot is". That means the pan is a DOM operation
 * on an element this store does not own and must not learn about: a store
 * holding a `ref` would be the second notion of where the plot is, in the file
 * whose whole job is to be the first.
 *
 * So the store carries the *intent* — a placement id and a nonce — and
 * `canvas/PlotCanvasSection.tsx`, which owns the viewport element, watches it
 * and does the scrolling. The nonce is what makes "show me the same warning
 * twice" work: without it the second press sets state to the value it already
 * had, React sees no change, and nothing happens.
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
  /**
   * The last "show me this placement" request, or `null` if none has been
   * made. Consumed by whoever owns the canvas viewport element — see the module
   * doc for why the scrolling is not done here.
   */
  readonly revealRequest: { readonly placementId: string; readonly nonce: number } | null;

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
  /** Ask the canvas to bring a placement into view. Selecting it is a separate action on `placements-store` — see `warnings/WarningsSection.tsx`, which does both. */
  readonly requestReveal: (placementId: string) => void;
}

export const useCanvasViewStore = create<CanvasViewState>((set) => ({
  viewportPx: UNMEASURED,
  zoomFactor: 1,
  editingOutline: false,
  selectedCornerIndex: null,
  outlineError: null,
  draftVertices: null,
  revealRequest: null,

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

  requestReveal: (placementId) =>
    set((state) => ({
      revealRequest: { placementId, nonce: (state.revealRequest?.nonce ?? 0) + 1 },
    })),
}));
