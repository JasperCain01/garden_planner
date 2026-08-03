/**
 * Editing the plot outline **on the plot canvas** (UI redesign Phase 2) — the
 * one behaviour that used to live in `plot/PlotOutlineEditor.tsx`, a second
 * SVG picture of the same plot over in the settings column, drawn at its own
 * scale. There is one picture of the plot now; ADR 0031 records why, and ADR
 * 0016's dated addendum records what changed about the premise it decided on.
 *
 * **Pointer and keyboard, not pointer and a note.** The old editor's corner
 * handles were pointer-only, a gap Stage 6.2 recorded honestly rather than
 * fixed (`docs/accessibility.md` §5, ADR 0026: the keyboard-drag alternative
 * was scoped to the palette→canvas handoff and on-canvas move/remove, not to
 * this). Moving the editor was the moment to close it, so every operation
 * below has both: a corner has a *selection* (the same idea `PlotCanvasSection`
 * already uses for placements, with the same Previous/Next buttons), and the
 * canvas's own arrow keys move the selected corner exactly as they nudge a
 * selected plant. Konva shapes aren't focusable, which is the same constraint
 * that shaped the placement path — so this is the same answer, not a new one.
 *
 * **Where the state lives.** `state/canvas-view-store.ts`, because the toolbar
 * (`PlotCanvasSection`) and the scene (`PlotCanvas`) both act on it and
 * neither owns the other's half. The *committed* outline stays in
 * `plot-store`, which holds validated regions only — see that store's
 * `draftVertices` for how a mid-drag invalid shape stays on screen anyway.
 */

import { useMemo } from 'react';
import type { PlotRegion, Vertex } from '@garden-planner/engine';
import { useCanvasViewStore } from '../state/canvas-view-store.ts';
import { usePlotStore } from '../state/plot-store.ts';
import { insertMidpoint, moveVertex, removeVertexAt } from '../plot/outline-ops.ts';
import { validateOutlineEdit } from './outline-edit.ts';

/**
 * The outline the canvas should **draw**: the last attempted edit while one is
 * invalid, the committed region otherwise.
 *
 * Everything in the scene is measured from this one region — the stage's
 * pixel size, the grid, the dimension labels, every placement's position — so
 * an in-progress edit moves the whole picture together instead of leaving the
 * outline somewhere its own grid isn't.
 */
export function useDisplayRegion(): PlotRegion {
  const region = usePlotStore((state) => state.region);
  const draftVertices = useCanvasViewStore((state) => state.draftVertices);
  return useMemo(
    // Copied rather than aliased: `PlotRegion.vertices` is a mutable array
    // (it is `validatePlotRegion`'s output type) and the draft is `readonly`,
    // which is the right way round — the draft is never handed out to be
    // edited in place.
    () => (draftVertices === null ? region : { vertices: [...draftVertices] }),
    [region, draftVertices],
  );
}

/** Everything the toolbar and the scene need to edit the outline. */
export interface OutlineEditing {
  /** Whether edit mode is on: handles drawn, arrow keys aimed at a corner rather than a plant. */
  readonly active: boolean;
  /** The corner list currently on screen (the draft while one is invalid). */
  readonly vertices: readonly Vertex[];
  readonly selectedCornerIndex: number | null;
  /** The reason the last edit wasn't committed, or `null`. */
  readonly error: string | null;
  readonly setActive: (active: boolean) => void;
  readonly selectCorner: (index: number | null) => void;
  /** Move the selection by ±1 corner, wrapping — the keyboard way to reach one, mirroring the Previous/Next placement buttons. */
  readonly selectRelativeCorner: (offset: 1 | -1) => void;
  /** Move a corner to an absolute position, in plot centimetres. The pointer path (a Konva handle drag). */
  readonly moveCorner: (index: number, position: { x: number; y: number }) => void;
  /** Move the selected corner by a centimetre delta. The keyboard path (arrow keys on the canvas). */
  readonly nudgeSelectedCorner: (dx: number, dy: number) => void;
  /** Insert a corner at the midpoint of the edge that *starts* at `index` — the midpoint handles, and the "Add corner" button. */
  readonly addCornerAfter: (index: number) => void;
  /** Remove a corner — double-click on a handle, or Delete with one selected. */
  readonly removeCorner: (index: number) => void;
}

export function useOutlineEditing(): OutlineEditing {
  const setRegion = usePlotStore((state) => state.setRegion);
  const active = useCanvasViewStore((state) => state.editingOutline);
  const setEditingOutline = useCanvasViewStore((state) => state.setEditingOutline);
  const selectedCornerIndex = useCanvasViewStore((state) => state.selectedCornerIndex);
  const selectCorner = useCanvasViewStore((state) => state.selectCorner);
  const error = useCanvasViewStore((state) => state.outlineError);
  const setOutlineDraft = useCanvasViewStore((state) => state.setOutlineDraft);
  const displayRegion = useDisplayRegion();
  const vertices = displayRegion.vertices;

  return useMemo(() => {
    /**
     * Validate an edit, keep it on screen either way, and commit it only if
     * it validates — `PlotOutlineEditor`'s rule, unchanged. On success the
     * draft is cleared rather than set to the new vertices, so
     * `useDisplayRegion` falls back to the committed region and there is
     * exactly one source of truth again the moment there can be.
     */
    function applyEdit(next: readonly Vertex[]): void {
      const result = validateOutlineEdit(next);
      if (result.region === null) {
        setOutlineDraft(next, result.error);
      } else {
        setOutlineDraft(null, null);
        setRegion(result.region);
      }
    }

    return {
      active,
      vertices,
      selectedCornerIndex,
      error,

      setActive: (next: boolean) => {
        setEditingOutline(next);
        // Entering edit mode with nothing selected would make the arrow keys
        // silently do nothing until the user found a corner to click — which
        // is the pointer-first assumption this whole path exists to remove.
        // The first corner is as good a starting point as any and is always
        // present: `PlotRegionSchema` requires at least three.
        if (next && selectedCornerIndex === null) {
          selectCorner(0);
        }
      },

      selectCorner,

      selectRelativeCorner: (offset: 1 | -1) => {
        if (vertices.length === 0) return;
        const current = selectedCornerIndex;
        selectCorner(
          current === null
            ? offset === 1
              ? 0
              : vertices.length - 1
            : (current + offset + vertices.length) % vertices.length,
        );
      },

      moveCorner: (index: number, position: { x: number; y: number }) => {
        applyEdit(moveVertex(vertices, index, position));
      },

      nudgeSelectedCorner: (dx: number, dy: number) => {
        if (selectedCornerIndex === null) return;
        const vertex = vertices[selectedCornerIndex];
        if (vertex === undefined) return;
        applyEdit(
          moveVertex(vertices, selectedCornerIndex, { x: vertex.x + dx, y: vertex.y + dy }),
        );
      },

      addCornerAfter: (index: number) => {
        applyEdit(insertMidpoint(vertices, index));
        // The new corner is inserted immediately after `index`, and selecting
        // it is what makes "add a corner, then move it" a keyboard sequence
        // rather than an add followed by a hunt.
        selectCorner(index + 1);
      },

      removeCorner: (index: number) => {
        // No "at least three corners" guard beyond keeping the list non-empty
        // (so the bounding box stays defined) — dropping below three is
        // exactly what `safeValidatePlotRegion` exists to reject, with its own
        // message, rather than this silently refusing. Same call
        // `PlotOutlineEditor` made.
        if (vertices.length <= 1) return;
        applyEdit(removeVertexAt(vertices, index));
        // Keep a selection, and keep it in range: removing the last corner
        // would otherwise leave the index pointing past the end and the arrow
        // keys doing nothing.
        selectCorner(Math.min(index, vertices.length - 2));
      },
    };
  }, [
    active,
    vertices,
    selectedCornerIndex,
    error,
    setEditingOutline,
    selectCorner,
    setOutlineDraft,
    setRegion,
  ]);
}
