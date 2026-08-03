/**
 * The canvas's live scale: measure the space, fit the plot to it, and let the
 * user zoom past that (UI redesign Phase 2's first bullet).
 *
 * Splits into two hooks because the two halves have different owners.
 * {@link useMeasuredViewport} is called once, by whoever renders the scrolling
 * viewport element (`PlotCanvasSection.tsx`); {@link useCanvasScale} is called
 * by anyone who needs the resulting number, which — see
 * `state/canvas-view-store.ts` — includes a component in a different subtree.
 *
 * **`ResizeObserver`, not a `resize` listener.** The viewport's size changes
 * for reasons the window never hears about: the dock under the canvas grows
 * when the first plant is placed, the settings column's disclosure panels open
 * and close, the narrow breakpoint restacks everything. A window `resize`
 * listener misses all three; an observer on the element itself catches every
 * one, and fires once on observe so the first paint is already fitted.
 *
 * It is guarded rather than assumed: jsdom implements no `ResizeObserver` (and
 * no layout for one to report), so under component tests the viewport stays
 * unmeasured and `geometry.ts#fitPxPerCm` answers with `FALLBACK_PX_PER_CM` —
 * the pre-Phase-2 constant, which is exactly the "renders as it always did"
 * behaviour those tests were written against.
 */

import { useEffect, useMemo, type RefObject } from 'react';
import type { PlotRegion } from '@garden-planner/engine';
import { useCanvasViewStore, ZOOM_STEP } from '../state/canvas-view-store.ts';
import { clampPxPerCm, fitPxPerCm, MAX_PX_PER_CM, MIN_PX_PER_CM } from './geometry.ts';
import { useDisplayRegion } from './useOutlineEditing.ts';

/**
 * Keep `state/canvas-view-store.ts`'s `viewportPx` in step with `ref`'s
 * measured content box, for as long as the component is mounted.
 *
 * The **content** box specifically (`entry.contentRect`, not
 * `getBoundingClientRect`): the viewport element is padded, and fitting the
 * plot to the border box would push the plot's edges under that padding —
 * which is where the dimension labels live.
 */
export function useMeasuredViewport(ref: RefObject<HTMLElement | null>): void {
  const setViewportPx = useCanvasViewStore((state) => state.setViewportPx);

  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect !== undefined) {
        setViewportPx({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, setViewportPx]);
}

/** The live scale, plus everything the zoom controls need to render and act. */
export interface CanvasScale {
  /** Rendered canvas pixels per plot centimetre — what every `geometry.ts` conversion and the Konva stage are drawn at. */
  readonly pxPerCm: number;
  /** The scale at which the plot exactly fits its viewport, before zoom. */
  readonly fittedPxPerCm: number;
  /** `pxPerCm / fittedPxPerCm`, i.e. what the zoom readout shows as a percentage. Not simply the store's `zoomFactor`, which is unclamped. */
  readonly zoomRatio: number;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  readonly zoomIn: () => void;
  readonly zoomOut: () => void;
  /** Back to "the whole plot, exactly fitted". */
  readonly zoomToFit: () => void;
  /** True when the plot is drawn larger than its viewport, i.e. there is something to pan to. */
  readonly isZoomedIn: boolean;
}

/**
 * The scale the canvas is currently drawn at, for `region`.
 *
 * Zoom is stored as a factor over the fitted scale and clamped *here*, where
 * the fitted scale is known — so a plot that already fills a small viewport
 * can't be zoomed past `MAX_PX_PER_CM` and a huge one can't be shrunk to
 * nothing. `zoomIn`/`zoomOut` refuse to move once clamped rather than letting
 * the stored factor drift off to a number it would take a dozen clicks to
 * unwind (the classic "I pressed − eight times and nothing happened, then it
 * jumped" bug).
 */
export function useCanvasScale(region: PlotRegion): CanvasScale {
  const viewportPx = useCanvasViewStore((state) => state.viewportPx);
  const zoomFactor = useCanvasViewStore((state) => state.zoomFactor);
  const zoomBy = useCanvasViewStore((state) => state.zoomBy);
  const resetZoom = useCanvasViewStore((state) => state.resetZoom);

  return useMemo(() => {
    const fittedPxPerCm = fitPxPerCm(region, viewportPx);
    const pxPerCm = clampPxPerCm(fittedPxPerCm * zoomFactor);
    const canZoomIn = pxPerCm < MAX_PX_PER_CM;
    const canZoomOut = pxPerCm > MIN_PX_PER_CM;
    return {
      pxPerCm,
      fittedPxPerCm,
      zoomRatio: pxPerCm / fittedPxPerCm,
      canZoomIn,
      canZoomOut,
      zoomIn: () => {
        if (canZoomIn) zoomBy(ZOOM_STEP);
      },
      zoomOut: () => {
        if (canZoomOut) zoomBy(1 / ZOOM_STEP);
      },
      zoomToFit: resetZoom,
      // A hair over 1, not `> 1`: floating-point fit maths lands on 1.0000001
      // often enough that a strictly-greater test would offer a pan cursor on
      // a plot that has nowhere to pan to.
      isZoomedIn: pxPerCm > fittedPxPerCm * 1.001,
    };
  }, [region, viewportPx, zoomFactor, zoomBy, resetZoom]);
}

/**
 * The live scale for callers that only need the number and don't render the
 * controls — `useCanvasDropHandler`, which converts a drop point and is called
 * from the page above the canvas region.
 *
 * Reads the region from the store itself rather than taking it as an argument,
 * because that is the *only* region the canvas is ever drawn for: a caller
 * passing a different one would be asking "what scale would this other plot be
 * at", which nothing wants and which would silently mis-place a drop. It reads
 * the *display* region for the same reason — during an invalid outline edit
 * the stage is drawn from the draft, and a drop has to convert against the
 * picture the user is looking at.
 */
export function useCanvasPxPerCm(): number {
  return useCanvasScale(useDisplayRegion()).pxPerCm;
}
