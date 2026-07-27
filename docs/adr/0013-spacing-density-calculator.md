# 0013 — Spacing / density calculator: the region model, the packing geometry, and the method-fallback rule

> **Dated note (Stage 6.4, 2026-07-27 — the project's closing consistency
> pass).** The spacing-shape table below measured the dataset **as it was at
> Stage 2.2** and is kept as the record of what the fallback rule was designed
> against. Re-measured today against `data/plants.json` (144 records): `row`
> only **135/144**, `row` **and** `intensive` **9/144** (the same nine crops),
> `intensive` only **0/144**. The proportion barely moved — 94% of the
> catalogue still has no intensive figure of its own — so the method-fallback
> rule this ADR decides on is doing exactly as much work as it was built to do.

- **Status:** Accepted
- **Date:** 2026-07-25
- **Workplan stage:** 2.2 (⭐ algorithmic) — spacing / density calculator

## Context

`DESIGN.md` §1 names two calculations that make the app useful. Stage 2.1 built
the first (suitability scoring). This is the second: **"how many onions can I
fit?"** — pure, framework-free functions in `packages/engine/src/spacing/` that
turn a crop's method-aware spacing (ADR 0004 §2) and a plot region into a count
that respects the region's _shape_, not merely its area, and that can offer
square or offset (hexagonal) packing.

The region model was **settled before this stage started** (`WORKPLAN.md` Stage
2.2, "Region model (decided)"): the plot is an **arbitrary simple polygon**,
because the product direction is preset shapes that the user then adjusts
free-form by dragging, adding and removing corners. So the open questions were
never "should we support shapes" but the consequences of that decision:

1. **How the polygon is represented and validated** — a free-form editor will
   produce self-intersecting and degenerate outlines, and those have to become
   errors a UI can show rather than garbage a calculator swallows.
2. **The packing geometry** — where the lattice starts, what "a plant fits"
   means at an edge, how offset packing's row pitch is derived, and which way
   the rows run on a shape where that genuinely matters.
3. **The method-selection and fallback rule** — because of what the data looks
   like (below), "the user asked for an intensive bed and this crop has no
   intensive figure" is not an edge case.
4. **How a count explains itself**, given that Stage 2.3 will build overcrowding
   rules on these results and Stage 3.4 has to draw them.

### The constraint that shaped the fallback: the intensive data barely exists

`data/plants.json` as it ships today (160 records):

| Spacing shape             | Records                                                                       |
| ------------------------- | ----------------------------------------------------------------------------- |
| `row` only                | **151/160**                                                                   |
| `row` **and** `intensive` | 9/160 — beet, carrot, garlic, green-bean, lettuce, onion, pea, radish, tomato |
| `intensive` only          | **0/160**                                                                     |

Every one of those nine intensive blocks carries `plantsPerSquare` and **no**
`perSquareMetre`. So the intensive toggle would answer "no figure for this crop"
for 94% of the catalogue if it refused to fall back, and the offset-packing story
has no shipped data that exercises it especially well — both had to be designed
for deliberately rather than discovered later.

## Decision

### 1. One polygon type, presets as factory functions

A region is `{ vertices: Vertex[] }` and nothing else — an ordered list of
centimetre coordinates with the closing edge implied. `rectangleRegion`,
`lShapeRegion` and `circleRegion` are **factories that build one**, not variants
of a discriminated union.

A union of `rectangle | lShape | polygon` would put a `switch` in every packing
routine, every containment test and every future obstacle feature, and would
leave the free-form branch — the one the user reaches within seconds of opening
the editor — the least-exercised path in the module. As factories, the presets
are exercised by every test that uses them, and a test asserts that a preset
rectangle and a hand-built four-vertex polygon of the same size produce
**identical counts and identical positions**.

The wrapping object (rather than a bare array) exists so zod's error paths point
at `vertices[3].x`, which is what Stage 3.2 needs to highlight the offending
corner.

**No region remembers it was a preset.** A `{ shape: 'rectangle', widthCm,
heightCm }` descriptor alongside the vertices was considered and rejected: one
corner-drag makes it a lie, and a stale descriptor that disagrees with the
geometry is worse than no descriptor. Stage 3.2's form keeps its own dimensions
as form state; the engine only ever sees the polygon.

Units are **centimetres**, matching `SpacingSchema`, so the calculator converts
nothing. The coordinate origin is arbitrary — see §3 on translation invariance.

### 2. Validation is part of the schema, and rejects what an editor really produces

`PlotRegionSchema` enforces four rules, each of them a thing a corner-drag can
cause:

- **3 ≤ corners ≤ 1000.** The upper bound is practical, not geometric: the
  self-intersection check is O(n²) and a hand-drawn allotment has tens of
  corners, so a thousand-corner outline is far likelier to be a bug than a plot.
- **No two consecutive corners in the same place.** This is also how the
  **closure convention is enforced**: the ring is implicitly closed, so a caller
  that repeats the first vertex at the end trips this rule and gets a message
  saying the closing edge is automatic.
- **The outline must not cross itself.** `findSelfIntersection` returns _which
  two edges_ conflict so the UI can point at them. Adjacent edges are allowed to
  share their vertex (obviously) but not to fold back along one another — a
  180° spike is degenerate even though no vertex repeats. A merely _redundant_
  collinear corner is allowed: adding a corner without moving it is a normal
  thing to do in a free-form editor, and rejecting it would fight the UI.
- **The outline must enclose some area**, so three collinear corners fail.

**Winding is not constrained and does not matter.** Clockwise and
counter-clockwise describe the same patch of ground: area is `|shoelace|` and
ray-casting containment is winding-agnostic. `polygonWinding` is exported for
the canvas's benefit (with a note that the label flips in a y-down screen frame),
but nothing in the calculator consults it. Tests assert that reversing the vertex
order, and rotating which corner the list starts from, leave the count unchanged.

Validation follows ADR 0012 §7's boundary pattern: `validatePlotRegion` throws
(mirroring `validatePlant`), `safeValidatePlotRegion` returns zod's result for a
form to render. The preset factories throw `RangeError` for a nonsensical
dimension — a zero width is a programming/UI-input error about that dimension,
and "width must be a positive number of centimetres" is a better message than a
geometry error about collinear corners.

### 3. The packing geometry: every plant owns a rectangle, and it must fit

Lay a lattice over the region's **bounding box**, keep the positions whose
plants fit inside the **outline**. Square and offset packing are the same
routine with a different lattice, and the non-convex case needs no special
handling — a re-entrant corner is just another edge.

**"Fits" means the plant's whole cell is inside.** Each plant owns an
axis-aligned rectangle, `inRowCm` along the row by the row pitch across, centred
on it; it is counted only if that rectangle lies entirely within the outline.
Three consequences, all deliberate:

- **A plant that half-fits doesn't.** A 106 cm bed at 10 cm spacing holds ten,
  not eleven.
- **The area upper bound is a theorem, not a hope.** The cells are disjoint and
  all inside the outline, so `count × cell area ≤ plot area` follows. The
  Workplan's property test therefore checks the implementation against a bound
  the design guarantees. (Counting bare lattice _points_ inside the polygon —
  the obvious alternative — breaks this: a comb of thin teeth can catch far more
  centres than its area allows.)
- **Plants may sit right on the boundary.** A cell may touch the outline, so the
  outermost plants stand half a spacing in from the edge. This matches how a
  raised bed is actually planted: the bed edge is not a competing plant. Callers
  who need a margin (a path, an overhanging fence) pass `edgeInsetCm`, which
  inflates the tested rectangle — an exact erosion of the usable region, with no
  need to construct an offset polygon, which for a non-convex shape is a
  genuinely hard piece of geometry we are glad not to own.

Testing "is this rectangle inside the polygon?" is two cheap tests: no edge
crosses the rectangle's **interior**, and its centre is inside. The word
_interior_ is load-bearing — the commonest case in the whole calculator is an
outline lying exactly along a cell boundary (a 200 cm bed at 10 cm spacing puts
it there), and counting that as an intersection would report 18 columns instead
of 20. It is implemented as Liang–Barsky clipping against the cell shrunk by a
1e-6 cm epsilon.

**The lattice is anchored to the bounding box's minimum corner.** The first cell
spans `[min, min + pitch]` and its plant sits at the centre, which makes a
rectangle's answer exactly the arithmetic a gardener does by hand —
`floor(width / inRow) × floor(height / pitch)` — and, more importantly, makes
the count **translation-invariant**: the same allotment drawn at a different
offset counts the same.

The price is that _growing_ a plot leftwards or downwards re-phases the lattice,
so a strictly larger plot can occasionally hold one fewer plant. This is real,
not theoretical, and `properties.test.ts` contains a hand-worked comb-shaped
plot that demonstrates it (7 plants; add 3 cm to the left-hand end and it drops
to 5). We accept it because the alternative — anchoring to a fixed global origin,
which _would_ make growth strictly monotone — means sliding the same plot three
centimetres sideways changes its answer, which is a far worse thing for a user
to see. Monotonicity in region size therefore holds whenever growth leaves the
minimum corner alone, which is how the property test states it.

A phase _search_ (trying several lattice offsets and keeping the best) was
considered and rejected: it would win back the occasional lost plant at the cost
of making every count un-hand-checkable and every result mildly unpredictable.

### 4. Offset packing: `√(b² − (s/2)²)`, which reduces to the familiar `√3/2`

Offset packing staggers alternate rows by half an in-row step (`s/2`), which
frees the rows to sit closer without bringing any two plants nearer than the
crop asks for. With row pitch `p`, the nearest neighbour in the next row is
`√((s/2)² + p²)`, and requiring that to be at least the between-row clearance
`b` gives `p = √(b² − (s/2)²)`.

When the spacing is equal in both directions — which is exactly what an
intensive bed's single density figure means — this collapses to the hexagonal
constant every gardening book quotes: `p = (√3/2)·s ≈ 0.866·s`, rows 13.4%
closer, about **15% more plants**.

The generalised form was chosen over applying `√3/2` unconditionally because
row spacings are usually **anisotropic**: 45 × 60 cm tomatoes staggered by
22.5 cm can only pull the rows in to 55.6 cm, a 7% gain, and blanket-multiplying
60 by 0.866 would put the diagonal neighbours 6% closer than the crop asks for —
inventing density out of arithmetic. Two guards complete it: if `s/2 ≥ b` there
is no room to pull in at all (pitch stays `b`), and `p` never drops below `b/2`,
because plants two rows apart have no stagger between them.

Two honest caveats, both tested:

- The ~15% gain is **asymptotic**. The stagger costs half a column on every
  other row and edge losses are proportionally larger on a small bed: a 1 m
  square gains 5%, a 3 m square 11%, a 20 m square over 14%.
- On a small or awkward plot, offset packing can count **fewer** plants than
  square (a 2 × 1 m bed of onions: 59 against 60). This is one reason it is an
  explicit opt-in rather than a silent optimisation — the other being that it is
  a real change to how the bed is planted.

Because the shipped data exercises offset packing poorly, its behaviour is
pinned by **hand-built fixtures with the arithmetic worked in the comments**
(`packing.test.ts`), not by the dataset.

### 5. Row orientation: try both, keep the better, say which

Rows run along the x or the y axis; `orientation: 'best'` (the default) lays
both and keeps the higher count. Orientation matters much more now that regions
are polygons — on an L-shape, rows along one arm and rows along the other
genuinely differ — and neither choice is a priori right, so trying both is
defensible _because_ it is cheap (two passes over a lattice).

A tie on the count breaks towards **fewer rows** (the same plants in longer rows
means fewer paths to tread, and reads better: "1 row of 50", not "50 rows of 1"),
and a remaining tie towards `horizontal`, so the result never depends on
iteration order. The chosen orientation is reported in `grid.orientation` so the
canvas draws what was counted.

**Only the two axis-aligned orientations exist.** An arbitrary row angle is an
unbounded search with no natural stopping point, and rows that run diagonally
across a rectangular bed are not what anyone plants. It remains possible later
without changing the result shape.

### 6. Method selection: follow the crop, fall back honestly, and label it

- `auto` (the default) uses **rows when the crop has them**, intensive
  otherwise. Row growing is the traditional default `DESIGN.md` describes, and a
  crop happening to carry a square-foot figure must not silently switch the
  user's growing method — the method belongs to the gardener, not the plant.
- An **explicit** `row` or `intensive` is honoured whether the crop carries it or
  not, by deriving the missing figure from the one it has:
  - _intensive wanted, only rows recorded_ (151 of 160 crops): re-lay the row
    rectangle as an equal-area square, `side = √(inRow × betweenRow)`.
  - _rows wanted, only a density recorded_ (no shipped crop; reachable via a
    user-defined crop, ADR 0011): `side = √(10000 / perSquareMetre)`.
- The result reports `spacingSource` (`recorded` / `derived-from-row` /
  `derived-from-intensive`) so the UI and Stage 2.3 can flag a derived figure
  **without parsing the summary sentence** — the same split ADR 0012 §6 made
  between `finding` and `reason`. The sentence says it too, in words.

The derivation is deliberately **conservative**: a real intensive figure is
usually denser than the row figure implies (onions are 10 × 30 cm in rows but 9
to a 30 cm square, three times the density), because intensive growing changes
the horticulture and not just the geometry. Deriving that extra density from a
row figure would be making data up; under-promising and labelling it is not.
Worth noting that "intensive is always denser" is not even universally true in
the shipped data — radish's recorded 3 × 15 cm rows are tighter than its 16 per
square, and `dataset.test.ts` pins that counter-example.

When a record carries **both** intensive figures, `perSquareMetre` wins:
`plantsPerSquare` has already been rounded to whole plants inside a 30 cm cell.
In today's data the conversion is what runs, since all nine records quote
plants-per-square only.

### 7. The result explains itself, and includes the positions

`SpacingCalculation` carries the count, `method` and `methodRequested`,
`spacingSource`, `packing`, the effective `grid` (orientation, distances, actual
row pitch, row count, ground per plant), the plot's area, the achieved
plants-per-m², **the positions**, and a `summary` sentence:

> Onion — 60 plants: 3 rows of 20 at 10 × 30 cm, square packing.

Positions are returned rather than only counted. They are computed anyway to do
the containment test; Stage 3.4's canvas has to draw something somewhere; and a
count without positions forces the canvas to invent a layout that then disagrees
with the number printed beside it. The cost — a bigger API surface to keep
stable, and an array that is tens of thousands of entries for a large allotment
at radish spacing — is accepted. `MAX_CANDIDATE_CELLS` (2,000,000) bounds the
worst case and turns a unit slip (metres typed as centimetres) into a
`RegionTooLargeError` with a readable message rather than a frozen tab.

Results are **plain TypeScript interfaces**, not zod schemas, for the reason ADR
0012 §7 gives: nothing ever parses a result from untrusted input. The _inputs_
that cross a trust boundary — the region and the options — are zod-first and are
parsed inside `fitSpacing`/`fitPlant`. The `Spacing` argument is not re-parsed,
because it arrives inside an already-validated `Plant`.

Tunable numbers (the 30 cm square-foot cell, the candidate-cell ceiling, the
geometry epsilon, the rounding helpers) live in `spacing/model.ts`, the way
`suitability/model.ts` holds the scoring model's numbers.

## Alternatives considered

- **A discriminated union of region shapes** (`rectangle | lShape | polygon`).
  Rejected: a `switch` in every geometry routine, and the free-form path — the
  common one — the least tested. See §1.
- **Keeping a shape descriptor on the region** so the UI can re-open a rectangle
  as width × height. Rejected: it goes stale the first time a corner moves. The
  form owns its own state.
- **Counting lattice points inside the polygon** rather than whole cells.
  Simpler, and it is what a naive implementation does — but it counts plants
  whose spacing hangs off the edge of the bed, and it breaks the area upper
  bound outright on comb-like shapes. Rejected in favour of the cell test, which
  costs one extra containment check per candidate.
- **Insetting the polygon by half a spacing** (a true Minkowski erosion) instead
  of testing cells. Correct polygon offsetting on a non-convex ring is hard —
  miter joins, self-intersections in the offset, the region splitting into
  pieces — and would have been the largest and least reliable piece of geometry
  in the module. The inflate-the-tested-rectangle trick gets the same answer for
  `edgeInsetCm` without constructing anything.
- **Anchoring the lattice to a fixed global origin**, which makes "bigger plot,
  never fewer plants" strictly true. Rejected: it makes the count depend on
  where the plot sits in an arbitrary coordinate frame. Translation invariance is
  the more important property; §3 records the cost and a test demonstrates it.
- **Searching over lattice phases (and angles) for the best packing.** Rejected:
  unpredictable, un-hand-checkable results for a marginal gain, and it would
  make every golden test a matter of trusting the optimiser.
- **Applying `√3/2` to the row pitch unconditionally** for offset packing.
  Rejected for anisotropic spacings, where it silently violates the crop's
  between-row clearance. §4.
- **Reporting "method unavailable" when a crop lacks the requested method.**
  Rejected: it is the answer for 151 of 160 crops in intensive mode, which makes
  the toggle useless. Deriving-and-labelling keeps the feature working and keeps
  the user informed.
- **Deriving a _tighter_ intensive density from row spacing** (applying a
  typical rows-to-bed ratio). Rejected as inventing data; the ratio varies from
  1× to 3× across the nine crops that quote both, and one of them goes the other
  way.
- **Returning only a count**, leaving the layout to Stage 3.4. Rejected: the
  canvas would draw a layout that disagrees with the count beside it.
- **Validating the result shape with zod.** Rejected, per ADR 0012 §7.
- **Supporting holes/obstacles in a region** (a shed, a tree, a path). Out of
  scope for this stage and not modelled: a region is a single simple ring. The
  containment test would extend to rings-with-holes without changing the packing
  routine, so this is deferrable rather than foreclosed.

## Consequences

- **Stage 3.2 has a definite contract**: produce `{ vertices }` in centimetres,
  validate with `safeValidatePlotRegion`, and show the message — including
  "the outline crosses itself (the edge from corner 2 meets the edge from corner
  5)", which the Workplan's verification criteria for 3.2 explicitly ask for.
- **Stage 3.4 can draw exactly what was counted**: `positions` (with a row index
  each) and `grid` are the layout, and `summary` is the live count feedback.
- **Stage 2.3 has machine-readable hooks** for overcrowding: `count`,
  `densityPerSquareMetre`, `grid.areaPerPlantCm2` and `spacingSource`, none of
  which requires parsing prose. What it does _not_ yet have is a notion of
  distance between two _placed_ crops — this stage counts one crop into one
  region and never asks what else is nearby. See the Stage 2.3 brief.
- **Counts are conservative by construction.** Whole-cell containment, an
  inscribed circle approximation and a floor-not-round lattice all round
  downwards. A gardener who finds they have room for one more plant is better
  served than one who buys thirty seedlings for twenty-eight spaces.
- **Offset packing is under-served by the shipped data** and pinned by
  fixtures instead. If Stage 1.7 adds crops with real intensive figures, the
  fixtures stay valid and the dataset tests gain coverage.
- **The engine still touches nothing external**: no network, no clock, no DOM.
  The calculator is deterministic — same inputs, same positions, every time —
  which is what lets the golden tests state exact coordinates.
- **The cell model is the expensive thing to unwind**, not the numbers. Weights,
  epsilons and limits are one-line changes in `model.ts`; changing what "fits"
  means would change every count in the app.
