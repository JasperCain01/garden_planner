# 0018 — Placement derivation for warnings: two shapes for two rule families, not one

- **Status:** Accepted
- **Date:** 2026-07-26
- **Workplan stage:** 3.5 — warnings overlay & companion suggestions UI

## Context

Stage 3.5 (`docs/stage-3.5-brief.md`) surfaces `packages/engine`'s warnings
engine (`evaluatePlot`, Stage 2.3) against Stage 3.4's plot canvas. The
brief's whole point is that this isn't just "call `evaluatePlot` and render
the array" — Stage 3.4's `state/placements-store.ts` models what's on the
canvas as **point instances**, `{ id, plant, x, y }`, one entry per
dragged-and-dropped plant. `evaluatePlot`'s `CropPlacement`
(`packages/engine/src/warnings/model.ts`) models a **bed**: `{ id, plant,
region, count }` — a crop, the sub-area it occupies, and how many are in it.
Nothing coerces one into the other, and the two warning-generating rules that
consume `CropPlacement` want that coercion done differently:

- **Overcrowding** (`overcrowding.ts`) calls `fitPlant(placement.plant,
placement.region)` and compares `placement.count` against the result. The
  natural mapping is: group Stage 3.4's point placements **by plant id**,
  `region` = the whole plot, `count` = how many of that plant are placed
  anywhere on it — exactly what `canvas/feedback.ts`'s `computePlacementTally`
  already computes for the Stage 3.4 live feedback panel.
- **Antagonist adjacency** (`adjacency.ts`) calls `regionDistanceCm` — real
  polygon-to-polygon distance between **two** placements' `region`s, `0` if
  they touch or overlap. The overcrowding mapping above (whole plot as every
  crop's `region`) would make every antagonist pairing's distance `0`
  regardless of how far apart the two crops actually are on the plot — two
  antagonist crops in opposite corners would warn exactly as loudly as two
  planted touching. That defeats the entire point of Stage 3.4 capturing
  precise `x`/`y` positions.

The brief laid out three concrete options rather than mandating one: (1) two
different `CropPlacement[]` derivations, one per rule family; (2) one
per-instance derivation used for everything, `count: 1`, a small footprint
region, re-deriving "overcrowded" some other way; (3) a hybrid — call the
per-rule engine functions directly (`suitabilityWarningsFor`,
`overcrowdingWarning`, `antagonistWarnings`, `companionSuggestions`, all
individually exported) rather than routing everything through `evaluatePlot`'s
own single-list loop.

## Decision

**Two derivations, chosen by rule family, and the engine's per-rule functions
are called directly rather than `evaluatePlot` itself** — options 1 and 3
together, since once two different placement lists exist there's nothing left
for `evaluatePlot`'s own loop to buy (see Alternatives below).

`app/src/warnings/placement-derivation.ts` exports two pure functions:

- **`deriveOvercrowdingPlacements(placements, region)`** — one `CropPlacement`
  per **distinct crop**, `region` = the whole plot, `count` = how many
  instances of it are placed anywhere. Reuses `canvas/feedback.ts`'s
  `computePlacementTally` grouping directly (Stage 3.4's live feedback panel
  answers the same "how many of this crop, versus how many fit" question over
  the same data — no reason to re-derive the grouping a second time). Feeds
  `overcrowdingWarning` and `companionSuggestions` (see below for why
  suggestions use this list too, not the per-instance one).
- **`derivePerInstancePlacements(placements)`** — one `CropPlacement` per
  placed instance, `count` always `1`, `region` a small square footprint
  centred on that instance's own `(x, y)`, sized via `resolveLatticeSpacing`'s
  `auto` rule (the same one `adjacency.ts`'s `adjacencyThresholdCm` already
  resolves internally) — the larger of the crop's in-row/between-row
  distances, so a courgette's footprint isn't the same size as a radish's.
  Feeds `suitabilityWarningsFor` (which never inspects `region` at all, only
  `plant` and `conditions`, so per-instance is harmless and gives every
  warning its own real placement id) and `antagonistWarnings` (which needs
  exactly this: real, instance-specific geometry).

`app/src/warnings/evaluate-canvas.ts`'s `evaluateCanvasWarnings` is the actual
Stage 3.5 entry point, composing the four per-rule functions against whichever
derivation each one needs, then indexing every resulting `Warning` by the
placement id(s) it concerns so `PlotCanvas.tsx` can look up "does this marker
have anything to show" in O(1).

### `CropPlacement.id` stays a real Stage 3.4 placement id, in both derivations

The brief's one hard requirement, regardless of which option was chosen:
`WarningSubject.placementId` / `CompanionSuggestion.forPlacementId` must be a
real `state/placements-store.ts` id, not a synthesised group key, or the
canvas can't locate which marker a warning is about. `derivePerInstancePlacements`
gets this for free (`id` = the instance's own id). `deriveOvercrowdingPlacements`
uses the group's **first-placed instance's id** as the whole group's
`CropPlacement.id` (via `computePlacementTally`'s new
`representativePlacementId` field) — a real id, just one of potentially
several equivalent instances of that crop.

### The overcrowding broadening: one warning, every marker of that crop

An `overcrowded` warning's `subjects` names only that one representative
instance — but being overcrowded is a property of the whole bed of a crop, not
of whichever instance happened to be placed first. `evaluate-canvas.ts`'s
indexing step special-cases `kind === 'overcrowded'`: instead of attaching the
warning only to `subjects[0].placementId`, it attaches it to **every current
placement sharing that crop's id**, so every marker of an overcrowded crop
gets the severity badge, not one arbitrarily-chosen marker. Every other
warning kind already names the exact placement(s) it's about (they run
against the per-instance list), so no broadening is needed for them.

### Companion suggestions run against the grouped list too

`companionSuggestions` doesn't look at `region` or `count` at all, only
`plant.companions` — so running it against the per-instance list would
produce one identical suggestion per marker of the same crop (three placed
onions → three copies of "plant garlic near onion"). Running it against the
grouped list instead gives one suggestion per distinct crop, still attached to
a real placement id (the group's representative instance), matching how a
gardener actually reads the suggestion ("this crop could use a companion"),
not "this specific plant needs one".

## Alternatives considered

- **Option 2 (one per-instance derivation for everything, `count: 1` against
  a small footprint region for overcrowding too).** Rejected per the brief's
  own caution: a footprint region sized for antagonist-adjacency purposes is
  far smaller than the whole plot, so `fitPlant(plant, footprint)` would
  almost always report a capacity of 0 or 1, making every second instance of
  any crop "overcrowded" in a way that says nothing useful about the actual
  bed. This would also have needed a second, parallel path (reusing
  `canvas/feedback.ts`'s tally) to recover a meaningful placed-vs-fits number
  for the UI regardless — at which point the two-derivation approach is no
  more code, and is honest about there being two different questions instead
  of forcing one shape to answer both badly.
- **Calling `evaluatePlot` itself, twice, and merging the results** (the
  brief's other framing of option 1). Once two different placement lists
  exist for the two rule families, calling `evaluatePlot` with each would
  still run _every_ rule against _both_ lists — `overcrowdingWarning` would
  also run (uselessly) against the per-instance list and `antagonistWarnings`
  against the grouped one — producing warnings to filter back out, or
  duplicate ones to dedupe. Calling the four per-rule functions directly,
  each against the one list it actually needs, is less code than either
  filtering or deduplicating, and reads as "the derivation that makes sense
  for this rule" rather than "which of these two evaluations do we trust for
  which warning kind".
- **A single, richer `CropPlacement`-like type carrying both a whole-plot
  region and a per-instance footprint**, so one `evaluatePlot`-shaped call
  could pick whichever it needed internally. Rejected as scope creep into
  `packages/engine` itself: the engine is a dependency, not editable this
  stage (ADR 0003), and the whole point of the per-rule functions being
  individually exported is that a caller with two genuinely different
  placement shapes for two different questions doesn't need the engine's own
  types to grow a third, hybrid shape to accommodate it.

## Consequences

- `app/src/warnings/` is the new feature: `placement-derivation.ts` (the
  decision above, pure and directly tested), `severity.ts` (severity→colour
  and severity-ranking, pure), `evaluate-canvas.ts` (the actual Stage 3.5
  entry point and the overcrowding-broadening index, pure), `useCanvasWarnings.ts`
  (thin hook wiring the pure function to the shared stores, untested per ADR
  0017's precedent for thin glue), `WarningsPanel.tsx` (plain DOM, component-
  tested per ADR 0017's precedent for non-Konva UI), and `WarningsSection.tsx`
  (thin composition, untested directly — covered via `PlotDefinitionPage`
  rendering it and the E2E journey).
- `app/src/canvas/feedback.ts`'s `PlacementTallyRow` gained one field,
  `representativePlacementId` — a minimal, backward-compatible extension (no
  existing call site or test asserted on the row's exact shape) rather than a
  parallel grouping function.
- `app/src/canvas/PlotCanvas.tsx` gained a `severityByPlacementId` prop (a
  plain `Map`, defaulting to empty) and renders a small severity-coloured
  badge on any marker present in it — no new warning logic in the Konva
  scene itself, matching ADR 0017's "keep `PlotCanvas.tsx` thin" precedent.
- `PlotDefinitionPage.tsx` computes `useCanvasWarnings` once and threads the
  result to both `PlotCanvasSection` (marker badges, and the selected
  placement's own warnings shown inline) and the new `WarningsSection` (the
  "4. Check for problems" list) — evaluating the five rules happens once per
  render, not once per consumer.
- A future stage changing what a "bed" means on the canvas (e.g. Stage 3.4
  itself growing a notion of drawn beds rather than point instances) should
  revisit this ADR — the whole two-derivation design exists specifically
  because Stage 3.4 committed to point instances, and a bed-shaped canvas
  model would likely collapse back to something closer to option 2.
