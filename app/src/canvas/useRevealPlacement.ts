/**
 * "Show me" — scroll the canvas viewport until a placement is actually on
 * screen (UI redesign Phase 4, ADR 0033 §6).
 *
 * The warnings dock's "Show me" button used to call `selectPlacement` and
 * stop there, which on a zoomed-in plot selects a marker the user cannot see:
 * the selection glow is painted somewhere outside the viewport's scrollport and
 * nothing about the screen changes. This closes that.
 *
 * **Why a hook here, and not a store action.** ADR 0031 §7 made panning the
 * viewport element's own **native scroll**, on purpose, "so that there is one
 * notion of where the plot is rather than two that can disagree". A pan is
 * therefore a DOM operation on an element `state/canvas-view-store.ts` neither
 * owns nor should learn about — so the store carries a *request* (a placement
 * id and a nonce) and this hook, called by the component that holds the
 * viewport ref, performs it. The nonce is what lets the same warning's "Show
 * me" work twice in a row.
 *
 * **It pans; it does not zoom.** The review says "pans/zooms to", and zooming
 * is declined with a reason rather than skipped: today's warnings are all
 * *relationships between two placements* ("these two are only 10 cm apart"), so
 * zooming in on one of them is the likeliest way to push the other off screen —
 * the exact opposite of what the button is for. At the default fitted scale
 * there is nothing to pan to anyway, because the whole plot is already visible;
 * panning only does anything once the user has zoomed in, which is precisely
 * when they have told the app they want a closer look.
 *
 * **And it does nothing when the marker is already visible.** Re-centring a
 * marker the user is already looking at is a jump with no information in it,
 * and after the second press it reads as the button being broken.
 */

import { useEffect, type RefObject } from 'react';
import type { PlotRegion } from '@garden-planner/engine';
import { useCanvasViewStore } from '../state/canvas-view-store.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import { usePrefersReducedMotion } from '../ui/usePrefersReducedMotion.ts';
import { cmToPx } from './geometry.ts';

/**
 * How much of the viewport's own size a marker must be inside its edge before
 * "already visible" counts. A marker flush against the scrollport's border is
 * technically visible and practically not — you cannot see what is around it,
 * which for an adjacency warning is the whole point.
 */
const EDGE_MARGIN_FRACTION = 0.15;

/**
 * @param viewportRef - the scrolling element the stage sits in
 * (`PlotCanvasSection`'s `.viewport`).
 * @param region - the region the stage is currently drawn from, so a placement's
 * centimetres convert to the same pixels Konva painted it at.
 * @param pxPerCm - the live scale, for the same reason.
 */
export function useRevealPlacement(
  viewportRef: RefObject<HTMLDivElement | null>,
  region: PlotRegion,
  pxPerCm: number,
): void {
  const revealRequest = useCanvasViewStore((state) => state.revealRequest);
  const placements = usePlacementsStore((state) => state.placements);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (revealRequest === null) {
      return;
    }
    const viewport = viewportRef.current;
    const placement = placements.find((candidate) => candidate.id === revealRequest.placementId);
    // jsdom has neither layout nor `scrollBy`, so every component test takes
    // this branch — which is the honest outcome there rather than a mock: there
    // is nothing to scroll in a document with no boxes.
    if (viewport === null || placement === undefined || typeof viewport.scrollBy !== 'function') {
      return;
    }
    // The stage element, not the viewport, is what the placement's pixel
    // position is relative to — and the two differ whenever the plot is
    // smaller than its scrollport (`.viewport` centres it) or scrolled.
    const stage = viewport.querySelector('#plot-canvas');
    if (!(stage instanceof HTMLElement)) {
      return;
    }

    const stageBox = stage.getBoundingClientRect();
    const viewportBox = viewport.getBoundingClientRect();
    const offset = cmToPx({ x: placement.x, y: placement.y }, region, pxPerCm);
    const markerX = stageBox.left + offset.x;
    const markerY = stageBox.top + offset.y;

    const marginX = viewportBox.width * EDGE_MARGIN_FRACTION;
    const marginY = viewportBox.height * EDGE_MARGIN_FRACTION;
    const comfortablyVisible =
      markerX >= viewportBox.left + marginX &&
      markerX <= viewportBox.right - marginX &&
      markerY >= viewportBox.top + marginY &&
      markerY <= viewportBox.bottom - marginY;
    if (comfortablyVisible) {
      return;
    }

    // `scrollBy` rather than `scrollTo`: the delta is what has just been
    // computed from two client rects, and the browser clamps it to the
    // scrollable range, so a marker near an edge ends up as centred as it can
    // be instead of needing the range worked out here.
    viewport.scrollBy({
      left: markerX - (viewportBox.left + viewportBox.width / 2),
      top: markerY - (viewportBox.top + viewportBox.height / 2),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [revealRequest, placements, region, pxPerCm, reducedMotion, viewportRef]);
}
