/**
 * Turns Stage 3.4's point placements (`state/placements-store.ts`'s
 * `{ id, plant, x, y }`) into the engine's `CropPlacement` (`{ id, plant,
 * region, count }` — `@garden-planner/engine`'s `warnings/model.ts`) — the one
 * piece of modelling work `docs/stage-3.5-brief.md` flags as this stage's own
 * call, not something `evaluatePlot`'s signature settles for you. Recorded in
 * full in `docs/adr/0018-placement-derivation-for-warnings.md`; the short
 * version:
 *
 * **Two different derivations for two different rule families**, not one
 * `CropPlacement[]` used everywhere (the brief's option 1/3):
 *
 * - {@link deriveOvercrowdingPlacements} — one `CropPlacement` **per distinct
 *   crop**, `region` = the whole plot, `count` = how many instances of it are
 *   placed anywhere. This is exactly `canvas/feedback.ts`'s
 *   `computePlacementTally` grouping (reused here rather than re-derived, per
 *   the brief), because it is the same question the live feedback panel
 *   already answers: "how many of this crop are down, versus how many the
 *   whole plot holds?" `overcrowdingWarning` needs nothing finer-grained than
 *   that.
 * - {@link derivePerInstancePlacements} — one `CropPlacement` **per placed
 *   instance**, `count` always `1`, `region` a small square footprint centred
 *   on that instance's own `(x, y)`. `antagonistWarnings` needs real
 *   center-to-center-ish distance between two *specific* plants, not "are
 *   these two crops anywhere on the same plot" — grouping by crop here would
 *   make every antagonist pairing on the same plot warn regardless of
 *   distance, defeating the entire point of Stage 3.4 capturing precise
 *   positions. `suitabilityWarningsFor` also runs against this list: it never
 *   inspects `region` at all (only `plant` and `conditions`), so per-instance
 *   is harmless for it and gives every warning-worthy placement its own
 *   `WarningSubject.placementId` rather than a shared group one.
 *
 * Both derivations keep `CropPlacement.id` as a **real Stage 3.4 placement
 * id** — the first-placed instance's id for the grouped list, the instance's
 * own id for the per-instance list — never a synthesised group key, so a
 * `Warning`'s `subjects[].placementId` always names something the canvas can
 * actually locate (`docs/stage-3.5-brief.md`'s one hard requirement,
 * regardless of which option is chosen).
 *
 * Framework-adjacent but framework-free itself: plain data in, plain data
 * out, no React — testable directly, matching ADR 0017's precedent for what
 * gets a component test versus a plain unit test.
 */

import { resolveLatticeSpacing, type CropPlacement, type PlotRegion } from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';
import { computePlacementTally } from '../canvas/feedback.ts';

/**
 * One `CropPlacement` per distinct crop placed anywhere on the plot: `region`
 * is the whole plot, `count` is how many instances are placed, `id` is the
 * first-placed instance's own id. Feeds `overcrowdingWarning` (directly, or
 * via `evaluatePlot`) — see this module's doc comment for why the whole plot
 * is the right `region` for this rule specifically.
 *
 * Reuses `computePlacementTally`'s grouping (`canvas/feedback.ts`, Stage 3.4)
 * rather than re-deriving "group by plant id, first-placed order" a second
 * time — the live feedback panel and this rule are answering the same
 * question over the same data.
 *
 * **Known limitation — this is per-crop, never cumulative.** Every crop is
 * checked against the whole plot's capacity *for that crop alone*, so two
 * crops each planted to their own maximum leave the plot at ~200% capacity
 * with no warning. That falls out of the two-derivation design rather than
 * being a defect in it, and ADR 0018's "Known limitation" section records why
 * it isn't fixed here and what a future stage should do about it. Do not
 * "fix" it by shrinking `region` — that is option 2, and the ADR explains why
 * it makes overcrowding meaningless.
 */
export function deriveOvercrowdingPlacements(
  placements: readonly PlacedPlant[],
  region: PlotRegion,
): CropPlacement[] {
  return computePlacementTally(placements, region).map((row) => ({
    id: row.representativePlacementId,
    plant: row.plant,
    region,
    count: row.placedCount,
  }));
}

/**
 * One `CropPlacement` per placed instance, `count` always `1`, `region` a
 * small square footprint centred on the instance's own position. Feeds
 * `suitabilityWarningsFor` and `antagonistWarnings` (directly, or via
 * `evaluatePlot`) — see this module's doc comment for why per-instance
 * geometry is what `antagonistWarnings` needs to mean anything.
 */
export function derivePerInstancePlacements(placements: readonly PlacedPlant[]): CropPlacement[] {
  return placements.map((placement) => ({
    id: placement.id,
    plant: placement.plant,
    region: footprintRegion(placement),
    count: 1,
  }));
}

/**
 * A square footprint centred on `placement`'s `(x, y)`, sized from the
 * plant's own spacing figure — `resolveLatticeSpacing`'s `auto` rule, the
 * same one `adjacency.ts`'s `adjacencyThresholdCm` already resolves internally
 * — so a courgette's footprint isn't the same size as a radish's (the brief's
 * own suggestion). The side is the larger of the crop's in-row and
 * between-row distances: a plant's true "personal space" isn't isotropic, but
 * a square big enough to cover its wider dimension is a reasonable,
 * conservative stand-in for a full per-plant canopy shape this stage has no
 * other model for.
 *
 * Not run through `validatePlotRegion`: this is an internally-constructed
 * square with four distinct corners and strictly positive side length (every
 * shipped and user-defined spacing figure is a positive number —
 * `RowSpacingSchema`/`IntensiveSpacingSchema`), so it is valid by
 * construction and re-validating it on every render would be ceremony
 * without a guarantee, mirroring `CropPlacement.region`'s own doc comment on
 * why `evaluatePlot` doesn't re-validate a caller-supplied region either.
 */
function footprintRegion(placement: PlacedPlant): PlotRegion {
  const lattice = resolveLatticeSpacing(placement.plant.spacing, 'auto');
  const halfSide = Math.max(lattice.inRowCm, lattice.betweenRowCm) / 2;
  const { x, y } = placement;
  return {
    vertices: [
      { x: x - halfSide, y: y - halfSide },
      { x: x + halfSide, y: y - halfSide },
      { x: x + halfSide, y: y + halfSide },
      { x: x - halfSide, y: y + halfSide },
    ],
  };
}
