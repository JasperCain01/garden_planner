/**
 * The **plot region** — the patch of ground the density calculator counts
 * plants into, and the shape Stage 3.2's plot form produces.
 *
 * ### One type, presets as factories
 *
 * A region is **an arbitrary simple polygon**: an ordered list of vertices, and
 * nothing else. `DESIGN.md` §1 step 1 describes the interaction it has to
 * survive — the user starts from a preset (rectangle, L-shape, …) and then
 * *adjusts the outline freely*, dragging corners and adding or removing them
 * until it matches the real plot. So:
 *
 * - **Non-convex is the normal case.** An L-shaped allotment is a preset, not
 *   an exotic input, which is why the calculator tests real containment rather
 *   than approximating with a bounding box.
 * - **The presets are factory functions** ({@link rectangleRegion},
 *   {@link lShapeRegion}, {@link circleRegion}) that build the *same* polygon
 *   type. A discriminated union of `rectangle | lShape | polygon` would put a
 *   `switch` in every packing routine and leave the free-form branch — the one
 *   the user reaches within seconds — the least-tested path.
 * - **Nothing remembers it was a preset.** A region carries no "I am a 2 m × 3 m
 *   rectangle" descriptor, because one corner-drag would make that descriptor a
 *   lie. Stage 3.2's form keeps its own dimensions as form state; the engine
 *   gets the polygon.
 *
 * ### Units and conventions, stated once
 *
 * - **Centimetres**, matching `SpacingSchema` (ADR 0004 §2), so the calculator
 *   never converts. The UI can present metres.
 * - The origin is **arbitrary** — the region is only ever used relative to its
 *   own bounding box, so translating a plot cannot change its plant count.
 * - The ring is **implicitly closed**: do not repeat the first vertex at the
 *   end. A repeated closing vertex is rejected by the "no two consecutive
 *   vertices may coincide" rule, with a message that says so.
 * - **Winding does not matter.** Clockwise and counter-clockwise describe the
 *   same patch of ground; area is taken absolute and containment is
 *   winding-agnostic. A test pins this.
 *
 * zod is the single source of truth and the types are `z.infer`-derived, as in
 * `schema/plant.ts` and `suitability/conditions.ts`.
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

import { z } from 'zod';
import type { BoundingBox } from './geometry.ts';
import {
  GEOMETRY_EPSILON,
  findSelfIntersection,
  polygonArea,
  polygonBoundingBox,
} from './geometry.ts';
import { SQUARE_CM_PER_SQUARE_METRE } from './model.ts';

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/**
 * Fewest vertices an outline can have. Two points are a line, not a plot.
 */
export const MIN_REGION_VERTICES = 3;

/**
 * Most vertices an outline can have.
 *
 * Not a geometric limit but a practical one: the self-intersection check is
 * O(n²) and runs on every validation, and a hand-drawn allotment outline has
 * tens of corners, not thousands. A polygon this large is far likelier to be a
 * bug (a traced image, a coordinate list pasted from elsewhere) than a plot,
 * and failing loudly beats quietly taking a second to validate.
 */
export const MAX_REGION_VERTICES = 1_000;

// ---------------------------------------------------------------------------
// The schema
// ---------------------------------------------------------------------------

/**
 * One corner of the outline, in centimetres. Coordinates may be negative: the
 * frame's origin is the caller's business (see the module doc).
 */
export const VertexSchema = z
  .object({
    /** Horizontal position, centimetres. */
    x: z.number().finite(),
    /** Vertical position, centimetres. */
    y: z.number().finite(),
  })
  .strict();
export type Vertex = z.infer<typeof VertexSchema>;

/**
 * A plot region: a simple (non-self-intersecting) polygon in centimetres.
 *
 * Wrapped in an object rather than being a bare array so that zod's error
 * paths point at `vertices[3].x` — which is what Stage 3.2 needs to highlight
 * the offending corner — and so a later stage can add a field without changing
 * every call site.
 *
 * The three validation rules, and why each exists:
 *
 * 1. **At least three, at most {@link MAX_REGION_VERTICES}** corners.
 * 2. **No two consecutive corners in the same place.** This is what catches a
 *    caller that closed the ring explicitly (the last vertex repeating the
 *    first), and a corner dragged exactly on top of its neighbour.
 * 3. **The outline must not cross itself**, and must **enclose some area**.
 *    Both are things a free-form editor produces from a single drag, so they
 *    are reported as ordinary, showable validation errors rather than treated
 *    as impossible input. `findSelfIntersection` names the two offending edges
 *    so the UI can point at them.
 */
export const PlotRegionSchema = z
  .object({
    /**
     * The corners of the outline in order, with the closing edge implied
     * (`v[n-1] → v[0]`). Either winding is accepted.
     */
    vertices: z
      .array(VertexSchema)
      .min(MIN_REGION_VERTICES, {
        message: `a plot outline needs at least ${MIN_REGION_VERTICES} corners`,
      })
      .max(MAX_REGION_VERTICES, {
        message: `a plot outline may have at most ${MAX_REGION_VERTICES} corners`,
      }),
  })
  .strict()
  .superRefine((region, ctx) => {
    const { vertices } = region;

    // (2) Consecutive duplicates, including the wrap-around pair — which is how
    // an explicitly-closed ring shows up.
    for (let i = 0; i < vertices.length; i += 1) {
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];
      if (current.x === next.x && current.y === next.y) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['vertices', (i + 1) % vertices.length],
          message:
            'two corners in a row are in the same place — the outline is closed automatically, so the first corner must not be repeated at the end',
        });
        return;
      }
    }

    // (3a) Self-intersection. Checked before the area test because a folded
    // outline often also has zero signed area, and "it crosses itself" is the
    // more useful thing to tell the user.
    const crossing = findSelfIntersection(vertices);
    if (crossing !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vertices'],
        message: `the outline crosses itself (the edge from corner ${crossing.edgeA} meets the edge from corner ${crossing.edgeB}) — plot outlines must be simple loops`,
      });
      return;
    }

    // (3b) Zero area: three collinear corners enclose no ground.
    if (polygonArea(vertices) <= GEOMETRY_EPSILON) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vertices'],
        message: 'the outline encloses no area — its corners all lie on one line',
      });
    }
  });

/** A validated plot region. See {@link PlotRegionSchema}. */
export type PlotRegion = z.infer<typeof PlotRegionSchema>;

// ---------------------------------------------------------------------------
// Boundary functions
// ---------------------------------------------------------------------------

/**
 * Validate an untrusted region, **throwing** on the first problem. Mirrors
 * `validatePlant` / `validatePlotConditions`: this is the trust boundary, so
 * everything downstream of it takes a known-good polygon.
 *
 * @throws {z.ZodError} if the outline is not a valid simple polygon.
 */
export function validatePlotRegion(input: unknown): PlotRegion {
  return PlotRegionSchema.parse(input);
}

/**
 * Non-throwing counterpart to {@link validatePlotRegion}, returning zod's
 * `{ success, data | error }` result.
 *
 * This is the one Stage 3.2 wants: a corner dragged across an edge is a normal
 * thing for a user to do, and the form should show "the outline crosses
 * itself" beside the shape rather than throwing.
 */
export function safeValidatePlotRegion(input: unknown): z.SafeParseReturnType<unknown, PlotRegion> {
  return PlotRegionSchema.safeParse(input);
}

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

/** The region's area in cm², by the shoelace formula. Winding-independent. */
export function regionAreaCm2(region: PlotRegion): number {
  return polygonArea(region.vertices);
}

/** The region's area in m² — the unit the UI and the density figures speak. */
export function regionAreaSquareMetres(region: PlotRegion): number {
  return polygonArea(region.vertices) / SQUARE_CM_PER_SQUARE_METRE;
}

/**
 * The region's axis-aligned bounding box. The packing routine lays its lattice
 * over this and then discards the positions that fall outside the outline,
 * which is precisely the difference between an area-aware and a shape-aware
 * count.
 */
export function regionBoundingBox(region: PlotRegion): BoundingBox {
  return polygonBoundingBox(region.vertices);
}

// ---------------------------------------------------------------------------
// Presets — factories for the one polygon type
// ---------------------------------------------------------------------------

/**
 * Guard a preset's dimension. Presets are the *friendly* entry point, so a
 * nonsensical dimension should fail here with a sentence about that dimension
 * rather than downstream with a geometry error about collinear corners.
 */
function requirePositive(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive number of centimetres (got ${value})`);
  }
}

/**
 * A plain rectangular bed, `widthCm` × `heightCm`, with its bottom-left corner
 * at the origin.
 *
 * The commonest starting point, and the shape every hand-worked example in the
 * tests is checked against. A test asserts that this and an equivalent
 * hand-built four-vertex polygon produce *identical* counts — the presets are
 * genuinely the same code path, not a parallel one.
 */
export function rectangleRegion(widthCm: number, heightCm: number): PlotRegion {
  requirePositive('width', widthCm);
  requirePositive('height', heightCm);
  return validatePlotRegion({
    vertices: [
      { x: 0, y: 0 },
      { x: widthCm, y: 0 },
      { x: widthCm, y: heightCm },
      { x: 0, y: heightCm },
    ],
  });
}

/** The dimensions of an {@link lShapeRegion}. */
export interface LShapeDimensions {
  /** Overall width of the enclosing rectangle, centimetres. */
  readonly widthCm: number;
  /** Overall height of the enclosing rectangle, centimetres. */
  readonly heightCm: number;
  /** Width of the rectangular bite taken out of the top-right corner. */
  readonly notchWidthCm: number;
  /** Height of that bite. */
  readonly notchHeightCm: number;
}

/**
 * An L-shaped plot: the `widthCm` × `heightCm` rectangle with a rectangular
 * notch removed from its **top-right** corner.
 *
 * This is the preset that makes the calculator earn its keep. Its area is
 * `widthCm × heightCm − notchWidthCm × notchHeightCm`, but its *shape* costs
 * more than that: rows can only run the full width below the notch, so a count
 * derived from area alone overstates what fits. A test asserts an L-shape
 * counts strictly fewer plants than its own bounding box.
 *
 * Only one orientation of the L is offered. Every other orientation is the same
 * polygon reflected or rotated, which is the UI's job (or four corner-drags),
 * and four near-identical factories would be four things to keep in step.
 */
export function lShapeRegion(dimensions: LShapeDimensions): PlotRegion {
  const { widthCm, heightCm, notchWidthCm, notchHeightCm } = dimensions;
  requirePositive('width', widthCm);
  requirePositive('height', heightCm);
  requirePositive('notch width', notchWidthCm);
  requirePositive('notch height', notchHeightCm);
  if (notchWidthCm >= widthCm) {
    throw new RangeError(`notch width (${notchWidthCm}) must be less than the width (${widthCm})`);
  }
  if (notchHeightCm >= heightCm) {
    throw new RangeError(
      `notch height (${notchHeightCm}) must be less than the height (${heightCm})`,
    );
  }
  return validatePlotRegion({
    vertices: [
      { x: 0, y: 0 },
      { x: widthCm, y: 0 },
      { x: widthCm, y: heightCm - notchHeightCm },
      { x: widthCm - notchWidthCm, y: heightCm - notchHeightCm },
      { x: widthCm - notchWidthCm, y: heightCm },
      { x: 0, y: heightCm },
    ],
  });
}

/** Default number of sides used to approximate a circular bed. */
export const CIRCLE_REGION_SEGMENTS = 32;

/**
 * A round bed, approximated by an inscribed regular n-gon.
 *
 * There is no exact circle in the model, and deliberately so: an exact circle
 * would be a second region *type*, and every containment test, every preset and
 * every future obstacle would grow a branch for it (see the module doc). An
 * inscribed 32-gon is within 0.5% of a circle's area, which is far inside the
 * error bar on "how big is your bed, roughly?".
 *
 * Inscribed rather than circumscribed on purpose: it under-states the bed
 * slightly, so the count is conservative rather than optimistic.
 */
export function circleRegion(
  diameterCm: number,
  segments: number = CIRCLE_REGION_SEGMENTS,
): PlotRegion {
  requirePositive('diameter', diameterCm);
  if (!Number.isInteger(segments) || segments < MIN_REGION_VERTICES) {
    throw new RangeError(
      `a circular bed needs at least ${MIN_REGION_VERTICES} segments (got ${segments})`,
    );
  }
  const radius = diameterCm / 2;
  const vertices = Array.from({ length: segments }, (_unused, index) => {
    const angle = (2 * Math.PI * index) / segments;
    return { x: radius + radius * Math.cos(angle), y: radius + radius * Math.sin(angle) };
  });
  return validatePlotRegion({ vertices });
}
