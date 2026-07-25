/**
 * `antagonist-adjacency` — two placed crops with a known antagonist link,
 * planted closer than {@link adjacencyThresholdCm} allows.
 *
 * The shipped basis for this rule is thin by construction (ADR 0008 §"the
 * hand-curated set"): exactly three antagonist pairs, three reciprocal links
 * each way — garlic ↔ green-bean and onion ↔ pea (both `traditional`), potato
 * ↔ tomato (`well-supported`). This module doesn't need more than that to be
 * correct; it just needs to degrade to silence for everything else, including
 * every user-defined crop (ADR 0011 §4: a user crop's `antagonists` is always
 * absent, so it can never appear on either side of a pairing here — no
 * special case needed, the data shape already guarantees it).
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

import type { Plant, PlantLink } from '../schema/plant.ts';
import { adjacencyThresholdCm, regionDistanceCm } from './adjacency.ts';
import type { AntagonistAdjacencyWarning, CropPlacement } from './model.ts';
import { ANTAGONIST_SEVERITY_BY_EVIDENCE, formatCm } from './model.ts';

/**
 * The antagonist link between `a` and `b`, checked in both directions, or
 * `undefined` if neither lists the other.
 *
 * Shipped antagonist pairs are recorded reciprocally (ADR 0008 §3), so in
 * practice both directions agree; checking `a`'s list first is an arbitrary
 * but harmless tie-break for the hypothetical case where they didn't.
 */
function antagonistLinkBetween(a: Plant, b: Plant): PlantLink | undefined {
  return (a.antagonists ?? []).find((link) => link.plantId === b.id);
}

/**
 * Check every pair of placements for an antagonist relationship planted too
 * close, and return one warning per pairing that trips.
 *
 * O(n²) in the number of placements, which is fine at garden scale (a plot
 * has tens of beds, not thousands) — the same cost profile Stage 2.2 accepted
 * for its O(n²) self-intersection check (ADR 0013 §2).
 */
export function antagonistWarnings(
  placements: readonly CropPlacement[],
): AntagonistAdjacencyWarning[] {
  const warnings: AntagonistAdjacencyWarning[] = [];

  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const first = placements[i];
      const second = placements[j];
      const link =
        antagonistLinkBetween(first.plant, second.plant) ??
        antagonistLinkBetween(second.plant, first.plant);
      if (link === undefined) continue;

      const distanceCm = regionDistanceCm(first.region, second.region);
      const thresholdCm = adjacencyThresholdCm(first.plant.spacing, second.plant.spacing);
      if (distanceCm >= thresholdCm) continue;

      warnings.push({
        kind: 'antagonist-adjacency',
        severity: ANTAGONIST_SEVERITY_BY_EVIDENCE[link.evidence],
        subjects: [
          { placementId: first.id, plantId: first.plant.id },
          { placementId: second.id, plantId: second.plant.id },
        ],
        evidence: link.evidence,
        distanceCm,
        thresholdCm,
        note: link.note,
        reason: antagonistReason(first.plant, second.plant, link, distanceCm, thresholdCm),
      });
    }
  }

  return warnings;
}

/** A short, evidence-aware sentence; the link's own (often much longer) `note` stays available separately. */
function antagonistReason(
  a: Plant,
  b: Plant,
  link: PlantLink,
  distanceCm: number,
  thresholdCm: number,
): string {
  const claim =
    link.evidence === 'well-supported'
      ? 'are known to grow poorly together'
      : 'are traditionally said to grow poorly together';
  return (
    `${a.commonName} and ${b.commonName} ${claim}, and here they are only ${formatCm(distanceCm)} cm apart ` +
    `— closer than the ${formatCm(thresholdCm)} cm we'd suggest keeping between them.`
  );
}
