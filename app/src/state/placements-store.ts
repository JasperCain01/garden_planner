/**
 * The placements store (Workplan Stage 3.4): "what's currently on the
 * canvas" — the single source of truth the plot canvas (`canvas/PlotCanvas.tsx`)
 * renders from and the palette's drag-drop handoff (`plot/PlotDefinitionPage.tsx`)
 * writes to. Follows ADR 0015's convention: one small, focused Zustand store
 * per concern, plain data in and out, separate from `plot-store.ts` (the
 * region/conditions) and `use-plant-list.ts` (which plants exist to place).
 *
 * A placement holds a whole `Plant`, not just an id, mirroring the brief's own
 * suggested shape (`docs/stage-3.4-brief.md`) — the canvas needs the plant's
 * name/category to render it and `fitPlant`'s feedback needs the full record
 * regardless, so there is nothing to save by storing an id and re-looking it
 * up through `usePlantList()` on every render.
 *
 * This stage stops at "placed, moved, removed, honestly counted" — whether a
 * placement is *valid* (inside the outline, not overcrowded, not next to an
 * antagonist) is Stage 3.5's job (`evaluatePlot`), not this store's.
 */

import { create } from 'zustand';
import type { Plant } from '@garden-planner/engine';

/** A plant instance placed on the canvas. `x`/`y` are centimetres in the plot region's own coordinate frame — the same frame `PlotRegion.vertices` uses. */
export interface PlacedPlant {
  /** Unique per placement (not per plant type) — the same crop can be placed many times. */
  readonly id: string;
  readonly plant: Plant;
  readonly x: number;
  readonly y: number;
}

interface PlacementsState {
  readonly placements: readonly PlacedPlant[];
  /** The placement currently selected on the canvas, or `null` if nothing is. */
  readonly selectedId: string | null;

  /** Place a new instance of `plant` at `position` and select it. Returns the new placement's id. */
  readonly addPlacement: (plant: Plant, position: { x: number; y: number }) => string;
  /** Move an existing placement to `position`. A no-op if `id` isn't a current placement. */
  readonly movePlacement: (id: string, position: { x: number; y: number }) => void;
  /** Remove a placement by id. Clears the selection if it was the selected one. A no-op if absent. */
  readonly removePlacement: (id: string) => void;
  /** Select a placement, or pass `null` to deselect (e.g. clicking empty canvas). */
  readonly selectPlacement: (id: string | null) => void;
}

export const usePlacementsStore = create<PlacementsState>((set) => ({
  placements: [],
  selectedId: null,

  addPlacement: (plant, position) => {
    const id = `placement-${crypto.randomUUID()}`;
    set((state) => ({
      placements: [...state.placements, { id, plant, x: position.x, y: position.y }],
      selectedId: id,
    }));
    return id;
  },

  movePlacement: (id, position) => {
    set((state) => ({
      placements: state.placements.map((placement) =>
        placement.id === id ? { ...placement, x: position.x, y: position.y } : placement,
      ),
    }));
  },

  removePlacement: (id) => {
    set((state) => ({
      placements: state.placements.filter((placement) => placement.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    }));
  },

  selectPlacement: (id) => set({ selectedId: id }),
}));
