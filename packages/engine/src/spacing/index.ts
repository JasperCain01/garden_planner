/**
 * Public surface of the spacing / density calculator (Workplan Stage 2.2 —
 * ⭐ algorithmic). Design and rationale:
 * `docs/adr/0013-spacing-density-calculator.md`.
 *
 * Answers `DESIGN.md`'s "how many onions can I fit?" — **shape-aware** (the
 * plot is an arbitrary simple polygon, and a plant is counted only if it really
 * lands inside it) and **method-aware** (row growing and intensive beds are
 * different densities for the same crop, ADR 0004 §2).
 *
 * Re-exports every sibling file so consumers write
 * `import { fitPlant, rectangleRegion } from '@garden-planner/engine'` without
 * reaching into file paths — mirrors `suitability/index.ts`.
 *
 * The shape of the module:
 * - `geometry.ts` — plane-geometry primitives: shoelace area, bounding box,
 *   point-in-polygon, "is this rectangle inside the outline", and the
 *   self-intersection test the schema rejects on.
 * - `region.ts` — the plot-region schema (zod-first, centimetres, one polygon
 *   type) with the preset shapes as factory functions.
 * - `model.ts` — the vocabularies, the tunable numbers and the result shape;
 *   the one place the model's constants live.
 * - `method.ts` — turning a crop's method-aware spacing into lattice distances,
 *   including what to do when it has no figure for the method asked for.
 * - `packing.ts` — the packing routine itself: square and offset lattices over
 *   the bounding box, filtered by real containment.
 * - `fit.ts` — `fitPlant` / `fitSpacing`, the entry points, and the
 *   self-explaining result they return.
 *
 * **Not to be confused with `packages/etl/src/spacing/`**, which is the
 * build-time hand-verified spacing *table* (ADR 0007). Different package,
 * different job: that one curates the numbers, this one plants with them.
 */

export * from './geometry.ts';
export * from './model.ts';
export * from './region.ts';
export * from './method.ts';
export * from './packing.ts';
export * from './fit.ts';
