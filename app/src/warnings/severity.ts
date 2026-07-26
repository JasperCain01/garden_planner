/**
 * Pure "which severity wins, what colour does it get" logic for the warnings
 * overlay (Workplan Stage 3.5). Kept separate from any component for the same
 * reason `canvas/geometry.ts` and `canvas/feedback.ts` are: plain data in,
 * plain data out, testable without rendering anything — and per ADR 0017's
 * precedent, this is exactly the kind of Konva-adjacent logic ("which colour
 * for this badge") that should live in a tested module of its own rather than
 * inline in `PlotCanvas.tsx`.
 */

import type { WarningSeverity } from '@garden-planner/engine';

/** Urgency order, low to high — the engine's own vocabulary carries no numeric rank, so this module supplies one. */
const SEVERITY_RANK: Readonly<Record<WarningSeverity, number>> = {
  info: 0,
  warning: 1,
  severe: 2,
};

/** The more urgent of two severities — `severe` beats `warning` beats `info`. */
export function worseSeverity(a: WarningSeverity, b: WarningSeverity): WarningSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/**
 * One colour per severity, distinct from `PlotCanvas.tsx`'s
 * `CATEGORY_COLORS` (which colours a marker by edible category, not by
 * warning state) and from `PlantPalette.tsx`'s `BAND_COLORS` (a suitability
 * *band*, a different closed vocabulary). Amber/red follow the conventional
 * warning/error pairing; `info` gets a quiet blue even though none of the five
 * shipped rules currently produce it (see `WarningSeverity`'s own doc
 * comment) — a future rule that does shouldn't need this map revisited.
 */
const SEVERITY_COLORS: Readonly<Record<WarningSeverity, string>> = {
  info: '#2563eb',
  warning: '#d97706',
  severe: '#dc2626',
};

/** The badge/ring colour for a given severity. */
export function severityColor(severity: WarningSeverity): string {
  return SEVERITY_COLORS[severity];
}
