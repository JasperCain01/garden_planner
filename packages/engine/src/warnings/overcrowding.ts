/**
 * `overcrowded` — has the user placed more of a crop in a bed than it fits?
 *
 * Stage 2.2's counts are already conservative and whole-cell-based (ADR 0013
 * §3: "a plant that half-fits doesn't"), so `fitPlant`'s `count` for a bed is
 * already the most that fits without crowding the crop's own spacing. That
 * makes the two phrasings the Stage 2.3 brief gives for this rule — "placed
 * more than fits" and "placed closer than the crop's spacing" — **the same
 * test** for a whole-bed placement: if the user's `count` exceeds `fitPlant`'s
 * `count` for that identical bed, the extra plants can only have been fitted
 * by standing closer together than the spacing allows, because `fitPlant`'s
 * count is already the maximum consistent with it. There is no second,
 * independent "too close" check to write.
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

import { fitPlant } from '../spacing/fit.ts';
import type { SpacingCalculation } from '../spacing/model.ts';
import type { CropPlacement, OvercrowdingWarning } from './model.ts';
import { OVERCROWDING_SEVERE_RATIO, formatCm } from './model.ts';

/**
 * Check one placement for overcrowding, or return `undefined` if it fits.
 *
 * Calls `fitPlant` itself (rather than requiring the caller to have already
 * computed it) so this rule is self-contained and exercises the exact same
 * region/options `fitPlant` would use if Stage 3.4's canvas called it
 * directly — the two must agree on what a bed holds.
 */
export function overcrowdingWarning(placement: CropPlacement): OvercrowdingWarning | undefined {
  const calculation = fitPlant(placement.plant, placement.region, placement.options);
  if (placement.count <= calculation.count) return undefined;

  return {
    kind: 'overcrowded',
    severity: severityFor(placement.count, calculation.count),
    subjects: [{ placementId: placement.id, plantId: placement.plant.id }],
    plantedCount: placement.count,
    maxCount: calculation.count,
    spacingSource: calculation.spacingSource,
    reason: overcrowdingReason(placement, calculation),
  };
}

/**
 * `severe` when nothing at all fits (any planted count is then infinitely
 * over capacity) or when the planted count is at least
 * {@link OVERCROWDING_SEVERE_RATIO} times the bed's capacity; `warning`
 * otherwise.
 */
function severityFor(plantedCount: number, maxCount: number): OvercrowdingWarning['severity'] {
  if (maxCount === 0) return 'severe';
  return plantedCount / maxCount >= OVERCROWDING_SEVERE_RATIO ? 'severe' : 'warning';
}

/**
 * The sentence a user acts on: what's planted, what fits, and — following
 * `spacing/fit.ts`'s own `derivationNote` — an honest note when the spacing
 * behind `maxCount` was derived rather than recorded (ADR 0013 §6), since a
 * derived figure is a softer basis for telling someone to thin out their bed.
 */
function overcrowdingReason(placement: CropPlacement, calculation: SpacingCalculation): string {
  const grid = `${formatCm(calculation.grid.inRowCm)} × ${formatCm(calculation.grid.betweenRowCm)} cm`;
  const base = `${placement.plant.commonName} — ${placement.count} planted but only ${calculation.count} fit at ${grid} spacing in this bed.`;
  if (calculation.spacingSource === 'recorded') return base;
  return `${base} That figure was derived from this crop's other growing method, not recorded directly, so treat it as an estimate.`;
}
