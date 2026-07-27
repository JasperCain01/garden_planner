/**
 * The free-form outline editor (Workplan Stage 3.2): drag existing corners,
 * add a corner on an edge, remove a corner — re-validated via
 * `safeValidatePlotRegion` (`@garden-planner/engine`) after every single edit,
 * so an invalid outline (self-intersecting, a collapsed edge, too few
 * corners) is shown inline and never handed to `onChange`.
 *
 * **Plain SVG + pointer events, not react-konva.** See
 * `docs/adr/0016-outline-editor-svg-not-konva.md` for the reasoning — the
 * short version is that this is a handful of draggable points, not a canvas
 * scene, and react-konva stays deferred to Stage 3.4 where the plot canvas
 * actually needs it.
 *
 * **Drag math, and why it needs no DOM measurement.** The SVG is rendered
 * with its `width`/`height` attributes set to exactly `viewBox width/height *
 * PX_PER_CM`, so the browser's own viewBox scaling is the *only* thing
 * converting rendered pixels to plot centimetres, at a ratio this module
 * already knows — no `getBoundingClientRect`/`getScreenCTM` call is needed
 * (both are awkward-to-nonexistent under jsdom). A drag tracks each
 * pointermove's `clientX`/`clientY` against the previous event's (rather than
 * the native `movementX`/`movementY`, which jsdom's event implementation
 * doesn't populate — see `PlotOutlineEditor.test.tsx`) and converts the pixel
 * delta to centimetres by dividing by `PX_PER_CM`. Listened for on `window`
 * rather than the dragged circle so the drag survives the pointer leaving the
 * small hit target.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PlotRegion, Vertex } from '@garden-planner/engine';
import { safeValidatePlotRegion } from '@garden-planner/engine';
import { insertMidpoint, moveVertex, removeVertexAt } from './outline-ops.ts';

/** Rendered screen pixels per plot centimetre — see the module doc. */
export const PX_PER_CM = 0.3;

/** Radius of a draggable corner handle, in plot centimetres. */
const CORNER_RADIUS_CM = 14;

/** Radius of an "add a corner here" edge-midpoint handle, in plot centimetres. */
const MIDPOINT_RADIUS_CM = 7;

/** Padding around the outline's bounding box, in plot centimetres, so corners aren't clipped at the edge. */
const PADDING_CM = CORNER_RADIUS_CM * 2;

export interface PlotOutlineEditorProps {
  /** The committed, valid region — the source of truth whenever it isn't being actively dragged. */
  readonly region: PlotRegion;
  /** Called with a newly-valid region after an edit. Never called for an edit that fails validation. */
  readonly onChange: (region: PlotRegion) => void;
}

/** Axis-aligned bounds of a vertex list, for sizing the SVG viewport. */
function boundsOf(vertices: readonly Vertex[]): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

export function PlotOutlineEditor({ region, onChange }: PlotOutlineEditorProps) {
  const [draftVertices, setDraftVertices] = useState<readonly Vertex[]>(region.vertices);
  const [error, setError] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // The `region` prop is the committed source of truth; when it changes for a
  // reason other than this editor's own last edit (a preset applied via
  // ShapePicker), the draft and any stale error should reset to match it.
  useEffect(() => {
    setDraftVertices(region.vertices);
    setError(null);
  }, [region]);

  // Refs, not state: the window-level pointermove listener below is set up
  // once per drag (not re-subscribed on every move) and needs the latest
  // vertices and last pointer position without that subscription churn.
  const draftVerticesRef = useRef(draftVertices);
  draftVerticesRef.current = draftVertices;
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  function applyEdit(nextVertices: readonly Vertex[]): void {
    setDraftVertices(nextVertices);
    const result = safeValidatePlotRegion({ vertices: nextVertices });
    if (result.success) {
      setError(null);
      onChange(result.data);
    } else {
      setError(result.error.issues[0]?.message ?? 'that outline is not valid');
    }
  }

  useEffect(() => {
    if (draggingIndex === null) {
      return undefined;
    }

    function handleMove(event: globalThis.PointerEvent): void {
      const last = lastPointerRef.current;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      if (last === null) {
        return;
      }
      const dx = (event.clientX - last.x) / PX_PER_CM;
      const dy = (event.clientY - last.y) / PX_PER_CM;
      const current = draftVerticesRef.current;
      const vertex = current[draggingIndex as number];
      applyEdit(
        moveVertex(current, draggingIndex as number, { x: vertex.x + dx, y: vertex.y + dy }),
      );
    }

    function handleUp(): void {
      lastPointerRef.current = null;
      setDraggingIndex(null);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    // applyEdit closes over the latest onChange/setters via component scope,
    // not over draggingIndex-changing values that would need re-subscribing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingIndex]);

  function handleCornerPointerDown(
    index: number,
    event: ReactPointerEvent<SVGCircleElement>,
  ): void {
    event.preventDefault();
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setDraggingIndex(index);
  }

  function handleRemove(index: number): void {
    // No "at least three corners" guard here beyond keeping the array
    // non-empty (so the bounding box stays defined) — dropping below three is
    // exactly the case `safeValidatePlotRegion` exists to reject with its own
    // message, rather than this component silently blocking it.
    if (draftVertices.length <= 1) {
      return;
    }
    applyEdit(removeVertexAt(draftVertices, index));
  }

  function handleAddMidpoint(edgeIndex: number): void {
    applyEdit(insertMidpoint(draftVertices, edgeIndex));
  }

  const bounds = boundsOf(draftVertices);
  const viewBoxWidth = bounds.width + PADDING_CM * 2;
  const viewBoxHeight = bounds.height + PADDING_CM * 2;
  const viewBox = `${bounds.minX - PADDING_CM} ${bounds.minY - PADDING_CM} ${viewBoxWidth} ${viewBoxHeight}`;

  return (
    <div>
      {/* Workplan Stage 6.2: a large outline can render wider than a phone viewport at this fixed PX_PER_CM; scrolling here (not the whole page) keeps the rest of the layout from being dragged sideways with it — same reasoning as `PlotCanvasSection.tsx`'s canvas wrapper. */}
      <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
        <svg
          role="img"
          aria-label="plot outline — drag a corner to adjust, or use the add/remove handles"
          width={viewBoxWidth * PX_PER_CM}
          height={viewBoxHeight * PX_PER_CM}
          viewBox={viewBox}
        >
          <polygon
            points={draftVertices.map((vertex) => `${vertex.x},${vertex.y}`).join(' ')}
            fill="rgba(76, 175, 80, 0.25)"
            stroke={error !== null ? '#c0392b' : '#2e7d32'}
            strokeWidth={4}
          />
          {/*
           * `role="button"` (Workplan Stage 6.2 a11y pass) makes these valid
           * `aria-label` targets — a `<circle>` with no ARIA role has an
           * implicit role that doesn't support naming at all, which axe's
           * `aria-prohibited-attr` rule correctly flagged. **This does not
           * make the corners keyboard-operable** — no `tabIndex` is added,
           * deliberately: there's no keyboard handler behind them yet, and a
           * focusable-but-inert control is worse than one a screen reader's
           * virtual cursor can at least announce correctly. The brief for
           * this stage scoped the keyboard-drag alternative to exactly two
           * places (`docs/stage-6.2-brief.md`) — the palette→canvas handoff
           * and on-canvas move/remove — not this editor; see
           * `docs/accessibility.md`'s "known gaps" section, and ADR 0026.
           */}
          {draftVertices.map((vertex, index) => {
            const next = draftVertices[(index + 1) % draftVertices.length];
            const midpoint: Vertex = { x: (vertex.x + next.x) / 2, y: (vertex.y + next.y) / 2 };
            return (
              <g key={index}>
                <circle
                  data-testid={`plot-corner-add-${index}`}
                  role="button"
                  aria-label={`add a corner after corner ${index + 1}`}
                  cx={midpoint.x}
                  cy={midpoint.y}
                  r={MIDPOINT_RADIUS_CM}
                  fill="#90caf9"
                  onClick={() => handleAddMidpoint(index)}
                />
                <circle
                  data-testid={`plot-corner-${index}`}
                  role="button"
                  aria-label={`corner ${index + 1} — drag to move, double-click to remove`}
                  cx={vertex.x}
                  cy={vertex.y}
                  r={CORNER_RADIUS_CM}
                  fill="#2e7d32"
                  onPointerDown={(event) => handleCornerPointerDown(index, event)}
                  onDoubleClick={() => handleRemove(index)}
                />
              </g>
            );
          })}
        </svg>
      </div>
      {error !== null && <p role="alert">{error}</p>}
    </div>
  );
}
