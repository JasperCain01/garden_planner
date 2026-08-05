/**
 * Which placed-plant name labels can render without colliding (post-review
 * fix A2 — `docs/post-review-fixes-workplan.md`).
 *
 * `PlotCanvas.tsx` draws a marker's name once the canvas is zoomed in past
 * `NAME_LABEL_MIN_PX_PER_CM`. Nothing stopped two neighbouring labels from
 * overlapping — "Brussels sprouts" and "Broad bean" ran together into one
 * unreadable line when the review clustered a few crops at plot centre, and a
 * label could land under a neighbour's marker or its own warning badge.
 *
 * **The fix is a visibility pass, not layout.** No nudging, no leader lines —
 * a label either has clear space or it doesn't, and a suppressed name is
 * still available from the hover tooltip and the selected-placement readout
 * (`PlacementFeedbackPanel.tsx`), so hiding it costs nothing but a redundant
 * caption. Walk placements in a stable order — the *selected* placement's
 * label always wins the walk, so selecting a crowded marker is how a user
 * resolves the ambiguity — then drop any label whose estimated box
 * intersects one already kept.
 *
 * Pure and deterministic: a plant list, a scale and a selection in, a set of
 * which placement ids get a label out. No Konva, no DOM — kept out of
 * `PlotCanvas.tsx` for the same reason `footprint.ts` and `grid.ts` are (see
 * their module docs): this is the sort of thing a unit test can pin exactly,
 * and a Konva `<Stage>` renders to a `<canvas>` jsdom can't query (ADR 0017).
 */

import type { PlotRegion } from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';
import { canopyRadiusPx, NAME_LABEL_MIN_PX_PER_CM } from './footprint.ts';
import { cmToPx } from './geometry.ts';

/**
 * The marker name label's font size, in screen pixels. Lives here rather than
 * in `PlotCanvas.tsx` because {@link labelBox} needs the same figure to
 * estimate a label's width, and this module — not the component — is what
 * `PlotCanvas.tsx` now defers to for "how big is this label".
 */
export const NAME_FONT_SIZE_PX = 11;

/**
 * Estimated screen-pixel width per character, matching the width heuristic
 * `PlotCanvas.tsx`'s `PlantTooltip` already uses for its own background
 * panel: Konva can only measure text from a constructed node (unavailable to
 * this pure module, ADR 0017), so a character-count estimate stands in. Too
 * wide by a few pixels only makes the collision pass *more* cautious, which is
 * the safe direction to be wrong in for a check whose job is avoiding overlap.
 */
const CHAR_WIDTH_FACTOR = 0.58;

/** Vertical padding added to the font size for a label's estimated height. */
const LABEL_HEIGHT_PADDING_PX = 4;

/** How far below the canopy the label sits — matches `PlotCanvas.tsx`'s `y={canopyPx + 3}`. */
const LABEL_OFFSET_PX = 3;

/** An axis-aligned pixel box, top-left origin — what {@link visibleLabels} tests for overlap. */
export interface LabelBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The pixel box a placement's name label would occupy, centred under its
 * canopy exactly the way `PlotCanvas.tsx` draws it (`align="center"`,
 * `y={canopyPx + 3}`).
 */
export function labelBox(placement: PlacedPlant, region: PlotRegion, pxPerCm: number): LabelBox {
  const centre = cmToPx(placement, region, pxPerCm);
  const canopyPx = canopyRadiusPx(placement.plant, pxPerCm);
  const width = placement.plant.commonName.length * NAME_FONT_SIZE_PX * CHAR_WIDTH_FACTOR;
  const height = NAME_FONT_SIZE_PX + LABEL_HEIGHT_PADDING_PX;
  return {
    x: centre.x - width / 2,
    y: centre.y + canopyPx + LABEL_OFFSET_PX,
    width,
    height,
  };
}

/** Whether two axis-aligned boxes overlap at all (touching edges don't count as a collision). */
function boxesIntersect(a: LabelBox, b: LabelBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Which placements should render a name label at `pxPerCm`, given every
 * current placement and (if any) the selected one.
 *
 * Below {@link NAME_LABEL_MIN_PX_PER_CM} nothing is shown at all, matching
 * `PlotCanvas.tsx`'s existing zoomed-out behaviour. Otherwise: the selected
 * placement (if placed) is walked first and always kept, then the rest in
 * their given order, each surviving only if its box doesn't intersect one
 * already kept. `Array#sort` is stable in every engine this app targets (the
 * same guarantee `geometry.ts#ringCandidates` relies on), so moving the
 * selected placement to the front doesn't reorder anything else.
 */
export function visibleLabels(
  placements: readonly PlacedPlant[],
  region: PlotRegion,
  pxPerCm: number,
  selectedId: string | null,
): ReadonlySet<string> {
  if (pxPerCm < NAME_LABEL_MIN_PX_PER_CM) {
    return new Set();
  }

  const ordered = [...placements].sort((a, b) => {
    if (a.id === selectedId) return -1;
    if (b.id === selectedId) return 1;
    return 0;
  });

  const keptBoxes: LabelBox[] = [];
  const visible = new Set<string>();
  for (const placement of ordered) {
    const box = labelBox(placement, region, pxPerCm);
    if (keptBoxes.some((kept) => boxesIntersect(kept, box))) {
      continue;
    }
    keptBoxes.push(box);
    visible.add(placement.id);
  }
  return visible;
}
