/**
 * Companion suggestions: for each crop already placed, what else the dataset
 * says grows well beside it and isn't already on the plot.
 *
 * `DESIGN.md` §1 step 4 asks for exactly this: "It also *suggests* companion
 * plants for what's already placed" — a prompt to plant something new near
 * what's there, not a badge confirming what's already a good pairing. So a
 * candidate already among the placements is skipped: there's nothing to
 * suggest about a crop the user has already put in the ground.
 *
 * A user-defined crop's `companions` is always absent (ADR 0011 §4), and no
 * *shipped* record's `companions` can ever name a `user-` id (those ids don't
 * exist at dataset-build time). So a user crop can neither produce nor receive
 * a suggestion, with no special-casing needed here — the data shape already
 * guarantees it, exactly as it does for antagonists (`antagonists.ts`).
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

import type { Plant, PlantLink } from '../schema/plant.ts';
import type { CompanionSuggestion, CropPlacement } from './model.ts';

/**
 * Every companion suggestion for the crops in `placements`: one entry per
 * (placed crop, unplaced companion) pair, in placement order.
 *
 * Deliberately not deduplicated across placements: if two different placed
 * crops both recommend the same candidate, each recommendation is its own
 * sentence with its own evidence tag, and merging them would either drop a
 * distinct citation or average two evidence levels together — exactly what
 * ADR 0008's evidence tagging exists to prevent.
 */
export function companionSuggestions(placements: readonly CropPlacement[]): CompanionSuggestion[] {
  const placedPlantIds = new Set(placements.map((placement) => placement.plant.id));
  const suggestions: CompanionSuggestion[] = [];

  for (const placement of placements) {
    for (const link of placement.plant.companions ?? []) {
      if (placedPlantIds.has(link.plantId)) continue; // Already on the plot — nothing to suggest.

      suggestions.push({
        forPlacementId: placement.id,
        forPlantId: placement.plant.id,
        suggestedPlantId: link.plantId,
        evidence: link.evidence,
        note: link.note,
        reason: companionReason(placement.plant, link),
      });
    }
  }

  return suggestions;
}

/**
 * A deliverable sentence, phrased per evidence level (ADR 0008, ADR 0014):
 * assertive for the three `well-supported` links the dataset carries, hedged
 * for the 82 `traditional` ones, so the honesty the evidence tag exists to
 * convey survives into the sentence rather than reading as one undifferentiated
 * "companions" list.
 *
 * `link.plantId` is a bare id (see `model.ts`'s note on `CompanionSuggestion`);
 * every shipped id doubles as a readable word or hyphenated phrase ("carrot",
 * "green-bean"), so the sentence is legible even before Stage 3.5 resolves it
 * to a display name.
 */
function companionReason(plant: Plant, link: PlantLink): string {
  return link.evidence === 'well-supported'
    ? `${plant.commonName} is well-supported to grow well alongside ${link.plantId} — worth planting nearby.`
    : `Gardeners traditionally say ${plant.commonName} grows well alongside ${link.plantId}, though this is folklore rather than a tested effect.`;
}
