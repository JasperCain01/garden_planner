/**
 * The Stage 3.5 entry point: run the engine's five warning rules and its
 * companion-suggestion pass against what's actually on the canvas, and index
 * the results by placement so `PlotCanvas.tsx` can look up "does *this*
 * marker have anything to show" with no second pass over the warning list.
 *
 * Calls the engine's per-rule functions directly rather than `evaluatePlot`
 * itself (`docs/adr/0018-placement-derivation-for-warnings.md`'s option 3):
 * `suitabilityWarningsFor` and `antagonistWarnings` run against
 * `derivePerInstancePlacements`' per-instance list, `overcrowdingWarning`
 * against `deriveOvercrowdingPlacements`' grouped-by-crop list, and
 * `companionSuggestions` also against the grouped list (see below for why).
 * `evaluatePlot` itself always takes one placement list, and the two rule
 * families genuinely need different ones (`placement-derivation.ts`'s doc
 * comment) — calling it twice and merging would still need this same
 * per-rule split internally, just with an extra list-merge step that buys
 * nothing.
 */

import {
  antagonistWarnings,
  companionSuggestions,
  overcrowdingWarning,
  suitabilityWarningsFor,
  type CompanionSuggestion,
  type PlotConditions,
  type PlotRegion,
  type Warning,
  type WarningSeverity,
} from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';
import {
  deriveOvercrowdingPlacements,
  derivePerInstancePlacements,
} from './placement-derivation.ts';
import { worseSeverity } from './severity.ts';

/** Everything the canvas and the "check for problems" panel need for one plot state. */
export interface CanvasWarnings {
  readonly warnings: readonly Warning[];
  readonly suggestions: readonly CompanionSuggestion[];
  /** Every warning that names a given placement id, broadened for `overcrowded` — see this module's doc comment below. */
  readonly warningsByPlacementId: ReadonlyMap<string, readonly Warning[]>;
  /** The single worst severity for a given placement id, or absent if it has no warnings. */
  readonly severityByPlacementId: ReadonlyMap<string, WarningSeverity>;
}

/**
 * Evaluate every placement currently on the canvas against `conditions`,
 * fresh — no diffing or caching, matching `evaluatePlot`'s own "call again
 * whenever placements/conditions/region change" contract
 * (`docs/stage-3.5-brief.md`'s gotchas).
 *
 * Companion suggestions run against the **grouped** (overcrowding-style)
 * placement list, not the per-instance one: `companionSuggestions` doesn't
 * look at `region` or `count` at all, only `plant.companions`, so running it
 * per-instance would produce one identical suggestion per marker of the same
 * crop (three placed onions → three copies of "plant garlic near onion").
 * Grouping first gives one suggestion per distinct crop, still attached to a
 * real placement id (the group's representative instance).
 */
export function evaluateCanvasWarnings(
  placements: readonly PlacedPlant[],
  region: PlotRegion,
  conditions: PlotConditions,
): CanvasWarnings {
  const perInstance = derivePerInstancePlacements(placements);
  const grouped = deriveOvercrowdingPlacements(placements, region);

  const warnings: Warning[] = [
    ...perInstance.flatMap((placement) => suitabilityWarningsFor(placement, conditions)),
    ...grouped.flatMap((placement) => overcrowdingWarning(placement) ?? []),
    ...antagonistWarnings(perInstance),
  ];
  const suggestions = companionSuggestions(grouped);

  const { warningsByPlacementId, severityByPlacementId } = indexByPlacement(warnings, placements);

  return { warnings, suggestions, warningsByPlacementId, severityByPlacementId };
}

/**
 * Index `warnings` by every placement id they concern.
 *
 * An `overcrowded` warning's one subject names the group's *representative*
 * instance (`deriveOvercrowdingPlacements`), but the overcrowding is a
 * property of the whole bed of that crop, not of the one instance that
 * happened to be placed first — so this broadens an `overcrowded` warning to
 * every current placement sharing that crop's id, which is what lets every
 * marker of an overcrowded crop show the badge, not just one arbitrarily
 * chosen marker. Every other warning kind already names the exact placement
 * it's about (they run against the per-instance list), so no broadening is
 * needed for them.
 */
function indexByPlacement(
  warnings: readonly Warning[],
  placements: readonly PlacedPlant[],
): {
  warningsByPlacementId: Map<string, Warning[]>;
  severityByPlacementId: Map<string, WarningSeverity>;
} {
  const warningsByPlacementId = new Map<string, Warning[]>();

  for (const warning of warnings) {
    for (const subject of warning.subjects) {
      const placementIds =
        warning.kind === 'overcrowded'
          ? placements
              .filter((placement) => placement.plant.id === subject.plantId)
              .map((placement) => placement.id)
          : [subject.placementId];

      for (const placementId of placementIds) {
        const existing = warningsByPlacementId.get(placementId);
        if (existing === undefined) warningsByPlacementId.set(placementId, [warning]);
        else existing.push(warning);
      }
    }
  }

  const severityByPlacementId = new Map<string, WarningSeverity>();
  for (const [placementId, placementWarnings] of warningsByPlacementId) {
    severityByPlacementId.set(
      placementId,
      placementWarnings.reduce<WarningSeverity>(
        (worst, warning) => worseSeverity(worst, warning.severity),
        'info',
      ),
    );
  }

  return { warningsByPlacementId, severityByPlacementId };
}
