/**
 * Plane geometry for the spacing calculator: the small set of primitives the
 * plot-region schema validates with and the packing routine counts with.
 *
 * Everything here is **pure, exact-ish 2-D arithmetic on centimetre
 * coordinates** — no zod, no domain vocabulary, no I/O. The domain layer
 * (`region.ts`) builds the validated {@link PlotRegion} on top of it, and
 * `packing.ts` uses the containment tests to decide which candidate plant
 * positions actually land inside the plot.
 *
 * ### The one convention worth stating up front
 *
 * A polygon is an **ordered list of vertices with the closing edge implied** —
 * the ring runs `v[0] → v[1] → … → v[n-1] → v[0]`, and the first vertex is
 * never repeated at the end. Every function here assumes that, and
 * {@link PlotRegionSchema} enforces it.
 *
 * ### Why an epsilon, and why this one
 *
 * Coordinates come from a user dragging corners around a canvas, so they are
 * arbitrary floats, and the cross products below scale with the *square* of the
 * coordinates. At garden scale (a plot is tens to thousands of centimetres
 * across) a coordinate of 10⁴ cm gives cross-product dust of roughly
 * 10⁸ × 2⁻⁵² ≈ 2 × 10⁻⁸ cm². {@link GEOMETRY_EPSILON} sits comfortably above
 * that and comfortably below any distance a gardener could mean — a hundredth
 * of a micron.
 *
 * Framework-free: no React, no DOM (WORKPLAN §0.2).
 */

/**
 * Tolerance for "is this zero?" tests on cross products and areas, in cm²
 * (see the module doc). Also used as a length slack in the lattice generator so
 * a cell that fits *exactly* isn't lost to floating-point dust.
 */
export const GEOMETRY_EPSILON = 1e-6;

/**
 * A point in the plot's own centimetre coordinate frame.
 *
 * The frame's origin is arbitrary — it is whatever the UI chose — so every
 * calculation here is **translation-invariant**: the same plot drawn at a
 * different offset must produce the same answer. Axis directions are likewise
 * the caller's business; only {@link polygonWinding} depends on them, and it
 * says so.
 *
 * This is the structural shape the geometry works on. The validated,
 * zod-derived version a caller passes around is `Vertex` in `region.ts`, which
 * is this shape with a runtime validator attached.
 */
export interface Point {
  /** Horizontal position, centimetres. */
  readonly x: number;
  /** Vertical position, centimetres. */
  readonly y: number;
}

/** An axis-aligned rectangle in the same centimetre frame. */
export interface Rect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** An axis-aligned bounding box, with its span pre-computed for convenience. */
export interface BoundingBox extends Rect {
  /** `maxX - minX`, centimetres. */
  readonly widthCm: number;
  /** `maxY - minY`, centimetres. */
  readonly heightCm: number;
}

/** Which way round a ring is wound. See {@link polygonWinding}. */
export type Winding = 'clockwise' | 'counter-clockwise' | 'degenerate';

// ---------------------------------------------------------------------------
// Area, bounds and winding
// ---------------------------------------------------------------------------

/**
 * Twice the signed area of the ring, by the **shoelace formula**:
 * `Σ (xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)` over the closed ring.
 *
 * Kept as *twice* the area and un-absoluted because that is the form the other
 * helpers want: the sign carries the winding, and doubling keeps the arithmetic
 * exact for integer coordinates (the common case — presets and grid-snapped
 * drags), which is worth having in a function used for validation.
 */
export function polygonDoubleSignedArea(vertices: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    total += current.x * next.y - next.x * current.y;
  }
  return total;
}

/**
 * Signed area of the ring in cm² — positive for counter-clockwise, negative for
 * clockwise (in a y-up frame). Half of {@link polygonDoubleSignedArea}.
 */
export function polygonSignedArea(vertices: readonly Point[]): number {
  return polygonDoubleSignedArea(vertices) / 2;
}

/**
 * Area of the ring in cm², always positive.
 *
 * This is the honest denominator the area upper-bound property test compares
 * counts against, and the figure the result's plants-per-m² is computed from.
 * Winding-independent by construction, because a plot outline drawn clockwise
 * and one drawn counter-clockwise describe the same patch of ground.
 */
export function polygonArea(vertices: readonly Point[]): number {
  return Math.abs(polygonSignedArea(vertices));
}

/**
 * Which way round the ring is wound.
 *
 * The calculator never needs this — containment and area are both
 * winding-agnostic — but the canvas (Stage 3.4) may want a consistent
 * orientation before it strokes or fills an outline, so it is exposed rather
 * than hidden.
 *
 * **Caveat worth knowing:** the sign convention assumes a mathematical, y-up
 * frame. Screen coordinates usually run y-down, which flips the two labels. The
 * distinction only matters to a caller that cares about the *name*; nothing in
 * this module does.
 */
export function polygonWinding(vertices: readonly Point[]): Winding {
  const doubleArea = polygonDoubleSignedArea(vertices);
  if (Math.abs(doubleArea) <= GEOMETRY_EPSILON) return 'degenerate';
  return doubleArea > 0 ? 'counter-clockwise' : 'clockwise';
}

/** The tightest axis-aligned box containing every vertex. */
export function polygonBoundingBox(vertices: readonly Point[]): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const vertex of vertices) {
    if (vertex.x < minX) minX = vertex.x;
    if (vertex.y < minY) minY = vertex.y;
    if (vertex.x > maxX) maxX = vertex.x;
    if (vertex.y > maxY) maxY = vertex.y;
  }
  return { minX, minY, maxX, maxY, widthCm: maxX - minX, heightCm: maxY - minY };
}

// ---------------------------------------------------------------------------
// Containment
// ---------------------------------------------------------------------------

/**
 * Is `point` inside the polygon? Classic **ray casting**: count how many edges
 * a ray fired in the +x direction crosses; odd means inside.
 *
 * The `(yi > y) !== (yj > y)` test is deliberately *half-open* in y — an edge
 * counts as crossing the ray only if the ray passes its lower endpoint but not
 * its upper one. That is what makes a ray passing exactly through a vertex
 * count once rather than twice or zero times, which is otherwise the classic
 * source of wrong answers on grid-aligned polygons (the L-shape preset has
 * vertices on exactly the horizontal lines a lattice row sits on).
 *
 * Points exactly *on* the boundary are not classified consistently by ray
 * casting, and this function makes no promise about them. That is fine here
 * because the packing routine never relies on it alone: a plant is kept only if
 * its whole cell is inside, and a cell whose centre sits on the boundary always
 * has an edge cutting through its interior, so it is rejected either way.
 */
export function pointInPolygon(point: Point, vertices: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const a = vertices[i];
    const b = vertices[j];
    const straddles = a.y > point.y !== b.y > point.y;
    if (!straddles) continue;
    // x of the edge where it crosses the horizontal line through `point`.
    const crossingX = a.x + ((point.y - a.y) / (b.y - a.y)) * (b.x - a.x);
    if (point.x < crossingX) inside = !inside;
  }
  return inside;
}

/**
 * Does the segment `a → b` pass through the **interior** of `rect`?
 *
 * "Interior" is the load-bearing word. A plant's cell is kept only when no
 * polygon edge cuts through it, and the commonest case in the whole calculator
 * is an edge lying *exactly along* a cell boundary — a 200 cm bed at 10 cm
 * spacing puts the outline precisely on the first and last cells' edges. If
 * touching counted as intersecting, every edge-adjacent cell would be thrown
 * away and a 20-column bed would report 18.
 *
 * Implemented as Liang–Barsky clipping against the rectangle shrunk by
 * {@link GEOMETRY_EPSILON}: a segment running along the boundary misses the
 * shrunken rectangle, while a segment genuinely cutting across it still hits.
 */
export function segmentCrossesRectInterior(a: Point, b: Point, rect: Rect): boolean {
  const minX = rect.minX + GEOMETRY_EPSILON;
  const minY = rect.minY + GEOMETRY_EPSILON;
  const maxX = rect.maxX - GEOMETRY_EPSILON;
  const maxY = rect.maxY - GEOMETRY_EPSILON;
  if (minX >= maxX || minY >= maxY) return false;

  // Cheap bounding-box rejection first: most edges are nowhere near most cells,
  // and this loop runs (cells × edges) times.
  if (Math.max(a.x, b.x) <= minX || Math.min(a.x, b.x) >= maxX) return false;
  if (Math.max(a.y, b.y) <= minY || Math.min(a.y, b.y) >= maxY) return false;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Parametric position along the segment, narrowed by each of the four slabs.
  let enter = 0;
  let exit = 1;

  // One slab of the clip: `direction · t ≤ limit` in the Liang–Barsky sense.
  const clip = (direction: number, limit: number): boolean => {
    if (Math.abs(direction) < Number.EPSILON) {
      // Parallel to this slab: no intersection at all if it starts outside it.
      return limit >= 0;
    }
    const t = limit / direction;
    if (direction < 0) {
      if (t > exit) return false;
      if (t > enter) enter = t;
    } else {
      if (t < enter) return false;
      if (t < exit) exit = t;
    }
    return true;
  };

  if (!clip(-dx, a.x - minX)) return false;
  if (!clip(dx, maxX - a.x)) return false;
  if (!clip(-dy, a.y - minY)) return false;
  if (!clip(dy, maxY - a.y)) return false;
  return enter < exit;
}

/**
 * Is the whole rectangle inside the polygon?
 *
 * Two cheap tests are enough, and their combination is exactly the "a plant
 * that half-fits doesn't" rule the calculator is built on:
 *
 * 1. no polygon edge crosses the rectangle's interior, and
 * 2. one interior point of the rectangle (its centre) is inside the polygon.
 *
 * (1) says the rectangle never straddles the outline, so it lies wholly inside
 * or wholly outside; (2) says which. This is what makes the non-convex case
 * fall out for free — an L-shape's re-entrant corner is just another edge, and
 * a cell poking into the notch fails test (1) like any other straddler.
 */
export function rectInsidePolygon(rect: Rect, vertices: readonly Point[]): boolean {
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    if (segmentCrossesRectInterior(a, b, rect)) return false;
  }
  const centre: Point = { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 };
  return pointInPolygon(centre, vertices);
}

// ---------------------------------------------------------------------------
// Simplicity (the self-intersection test the schema rejects on)
// ---------------------------------------------------------------------------

/** Cross product of `o→a` and `o→b`; sign gives the turn direction at `o`. */
function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Sign of a cross product, with dust below {@link GEOMETRY_EPSILON} read as 0. */
function orientation(o: Point, a: Point, b: Point): -1 | 0 | 1 {
  const value = cross(o, a, b);
  if (value > GEOMETRY_EPSILON) return 1;
  if (value < -GEOMETRY_EPSILON) return -1;
  return 0;
}

/** For three collinear points, does `q` lie within the segment `p→r`? */
function withinCollinearSpan(p: Point, q: Point, r: Point): boolean {
  return (
    q.x <= Math.max(p.x, r.x) + GEOMETRY_EPSILON &&
    q.x >= Math.min(p.x, r.x) - GEOMETRY_EPSILON &&
    q.y <= Math.max(p.y, r.y) + GEOMETRY_EPSILON &&
    q.y >= Math.min(p.y, r.y) - GEOMETRY_EPSILON
  );
}

/**
 * Do the closed segments `p1→q1` and `p2→q2` share any point at all?
 *
 * Inclusive of mere touching, and of collinear overlap — because for a plot
 * outline, an edge that just grazes another edge is as broken as one that
 * crosses it. Only *adjacent* edges are allowed to meet, and the caller
 * ({@link findSelfIntersection}) handles that case separately.
 */
export function segmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point): boolean {
  const d1 = orientation(p1, q1, p2);
  const d2 = orientation(p1, q1, q2);
  const d3 = orientation(p2, q2, p1);
  const d4 = orientation(p2, q2, q1);

  // The general case: each segment straddles the other's line.
  if (d1 !== d2 && d3 !== d4) return true;

  // The collinear/touching cases the general test misses.
  if (d1 === 0 && withinCollinearSpan(p1, p2, q1)) return true;
  if (d2 === 0 && withinCollinearSpan(p1, q2, q1)) return true;
  if (d3 === 0 && withinCollinearSpan(p2, p1, q2)) return true;
  if (d4 === 0 && withinCollinearSpan(p2, q1, q2)) return true;
  return false;
}

/** Where two edges of an outline illegally meet. Indices are edge indices. */
export interface SelfIntersection {
  /** Index of the first edge, i.e. the edge from `vertices[edgeA]` onwards. */
  readonly edgeA: number;
  /** Index of the second edge. */
  readonly edgeB: number;
}

/**
 * Find a place where the outline crosses itself, or `null` if it is a **simple
 * polygon**.
 *
 * A free-form editor *will* produce self-intersections — dragging one corner
 * across an opposite edge is a single mouse gesture — so this is a routine
 * user error to report, not a defensive check against the impossible. It is
 * what {@link PlotRegionSchema} rejects on, and returning *which* two edges
 * conflict lets Stage 3.2 highlight them rather than just refusing.
 *
 * Two kinds of conflict, because adjacent edges legitimately share a vertex:
 *
 * - **Non-adjacent edges** must not meet at all — any shared point is a
 *   crossing or a pinch.
 * - **Adjacent edges** must not double back along each other. Turning through
 *   180° (`(0,0) → (10,0) → (5,0)`) leaves the two edges overlapping, which is
 *   a degenerate spike rather than an outline, even though no vertex repeats.
 *   A *straight-through* collinear vertex is fine — it is merely redundant, and
 *   rejecting it would fight a UI that lets people add corners freely.
 *
 * Cost is O(n²) in the vertex count, which is why the schema caps that count.
 * At the tens of corners a hand-drawn plot has, that is a few hundred
 * comparisons.
 */
export function findSelfIntersection(vertices: readonly Point[]): SelfIntersection | null {
  const n = vertices.length;
  for (let i = 0; i < n; i += 1) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];
    for (let j = i + 1; j < n; j += 1) {
      const b1 = vertices[j];
      const b2 = vertices[(j + 1) % n];
      // Adjacent edges (including the wrap-around pair n-1 and 0) share a
      // vertex by construction; the only illegal way for them to meet is to
      // fold back along one another.
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacent) {
        const shared = j === i + 1 ? a2 : a1;
        const away1 = j === i + 1 ? a1 : a2;
        const away2 = j === i + 1 ? b2 : b1;
        const collinear = orientation(shared, away1, away2) === 0;
        const sameDirection =
          (away1.x - shared.x) * (away2.x - shared.x) +
            (away1.y - shared.y) * (away2.y - shared.y) >
          0;
        if (collinear && sameDirection) return { edgeA: i, edgeB: j };
        continue;
      }
      if (segmentsIntersect(a1, a2, b1, b2)) return { edgeA: i, edgeB: j };
    }
  }
  return null;
}
