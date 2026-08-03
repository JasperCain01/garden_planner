/**
 * How much ground a crop wants, and how big that makes its marker (UI redesign
 * Phase 2 — `docs/ui-aesthetic-review.md`'s "footprint-true markers").
 *
 * Until this phase every marker was a 16px circle, so — as the review puts it
 * — "a squash and a radish read identical, so spatial planning ('what fits?')
 * gets no visual support even though the engine computes spacing precisely".
 * A butternut squash wants 150 cm between plants and an icicle radish wants 8;
 * on a 3m bed that is the difference between two plants and thirty-odd, and
 * the canvas was the one place in the app that didn't say so.
 *
 * **The footprint is the same figure the warnings engine already uses.**
 * `warnings/placement-derivation.ts` models a placement's personal space as a
 * square of side `max(inRowCm, betweenRowCm)` — "a plant's true personal space
 * isn't isotropic, but a square big enough to cover its wider dimension is a
 * reasonable, conservative stand-in". Rather than invent a second definition
 * for drawing, this reuses that one: the disc a user sees is the same
 * footprint `antagonistWarnings` reasons about, so a marker that looks like it
 * is crowding its neighbour is one the engine agrees is crowding its
 * neighbour. `resolveLatticeSpacing(…, 'auto')` is the same resolution
 * `fitPlant` and `adjacencyThresholdCm` perform, so a crop with only an
 * intensive figure is handled the same way here as everywhere else.
 *
 * No React, no Konva: a plant record and a scale in, numbers out.
 */

import { resolveLatticeSpacing, type Plant } from '@garden-planner/engine';

/**
 * The smallest a marker's canopy is ever drawn, in canvas pixels — the
 * review's "min 12px for clickability".
 *
 * A radish's 15 cm footprint at a scale that fits a 20m allotment into a
 * laptop window is under a pixel across: honest, unusable, and unclickable
 * (both for a pointer and for Konva's hit graph, which tests the drawn shape).
 * Below this size the marker stops being to scale and says so by staying the
 * same size as its neighbours — at which point the user is zoomed too far out
 * for footprint comparison to be the question anyway.
 */
export const MIN_MARKER_RADIUS_PX = 12;

/**
 * The largest the crop **icon** inside a canopy is drawn, in canvas pixels.
 *
 * The canopy grows without limit — that is the entire point — but the icon is
 * a 24px-ish line drawing (`icons/crops/`), and blowing it up to a 156px-radius
 * pumpkin canopy would make one plant the only thing on the plot. Capping the
 * icon and letting the translucent canopy carry the scale is what keeps
 * "how much room does this need" and "what is it" legible at the same time.
 */
export const MAX_ICON_RADIUS_PX = 18;

/** Below this scale a marker's name label is not drawn: the text would be longer than the plot. */
export const NAME_LABEL_MIN_PX_PER_CM = 0.9;

/**
 * The side of the square a single plant of this crop occupies, in centimetres
 * — see the module doc for why this definition and not another.
 */
export function footprintDiameterCm(plant: Plant): number {
  const lattice = resolveLatticeSpacing(plant.spacing, 'auto');
  return Math.max(lattice.inRowCm, lattice.betweenRowCm);
}

/**
 * The radius of a marker's canopy disc in canvas pixels: the crop's footprint
 * at the canvas's live scale, never below {@link MIN_MARKER_RADIUS_PX}.
 */
export function canopyRadiusPx(plant: Plant, pxPerCm: number): number {
  return Math.max((footprintDiameterCm(plant) / 2) * pxPerCm, MIN_MARKER_RADIUS_PX);
}

/**
 * The radius of the solid category-coloured core (and so of the icon drawn on
 * it): the canopy, capped at {@link MAX_ICON_RADIUS_PX}. Never larger than the
 * canopy, so a tiny crop is one disc rather than an icon spilling out of one.
 */
export function iconRadiusPx(plant: Plant, pxPerCm: number): number {
  return Math.min(canopyRadiusPx(plant, pxPerCm), MAX_ICON_RADIUS_PX);
}

/** The crop's spacing as a short phrase for the hover tooltip — "45 × 60 cm apart". */
export function spacingLabel(plant: Plant): string {
  const lattice = resolveLatticeSpacing(plant.spacing, 'auto');
  const round = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
  return `${round(lattice.inRowCm)} × ${round(lattice.betweenRowCm)} cm apart`;
}
