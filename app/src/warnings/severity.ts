/**
 * Pure "which severity wins, what colour does it get" logic for the warnings
 * overlay (Workplan Stage 3.5). Kept separate from any component for the same
 * reason `canvas/geometry.ts` and `canvas/feedback.ts` are: plain data in,
 * plain data out, testable without rendering anything — and per ADR 0017's
 * precedent, this is exactly the kind of Konva-adjacent logic ("which colour
 * for this badge") that should live in a tested module of its own rather than
 * inline in `PlotCanvas.tsx`.
 */

import type { Warning, WarningSeverity } from '@garden-planner/engine';

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
 *
 * **Chosen for WCAG 1.4.3 contrast (Workplan Stage 6.2 a11y pass), not just
 * hue.** Every value here reaches at least 4.5:1 against a white background —
 * the bar for normal-weight text, which is exactly how `WarningsPanel.tsx`
 * uses this colour (as the severity label's own text colour, not a filled
 * shape). `warning`'s original `#d97706` measured 3.19:1 against white — well
 * short — so it's darkened one step (a standard "700"-weight amber, same hue)
 * to `#b45309` (5.02:1); `info` (5.17:1) and `severe` (4.83:1) already
 * cleared the bar and are unchanged.
 *
 * **Mirrored in CSS (UI redesign Phase 0).** Konva needs these as literal
 * strings for the canvas badge, so they stay here; `styles/tokens.css` carries
 * the same values as `--severity-*` for the DOM warnings list, and
 * `styles/tokens.test.ts` fails if the two copies drift apart. Exported for
 * that test — `severityColor` below is still how a component asks for one.
 */
export const SEVERITY_COLORS: Readonly<Record<WarningSeverity, string>> = {
  info: '#2563eb',
  warning: '#b45309',
  severe: '#dc2626',
};

/** The badge/ring colour for a given severity. */
export function severityColor(severity: WarningSeverity): string {
  return SEVERITY_COLORS[severity];
}

/**
 * A short glyph per severity, distinct enough to read without colour —
 * `PlotCanvas.tsx`'s marker badge is a small filled circle that, before this
 * stage's a11y pass, drew the same "!" for every severity and so relied on
 * colour alone to distinguish "info" from "severe" (the exact gap
 * `docs/stage-6.2-brief.md` calls out). `WarningsPanel.tsx` doesn't need this
 * — its severity label is already the word itself (`warning.severity.toUpperCase()`)
 * — so this exists only for the canvas badge.
 */
const SEVERITY_GLYPHS: Readonly<Record<WarningSeverity, string>> = {
  info: 'i',
  warning: '!',
  severe: '×',
};

/** The single-character glyph a canvas badge should draw for a given severity, so shape (not just colour) carries the distinction. */
export function severityGlyph(severity: WarningSeverity): string {
  return SEVERITY_GLYPHS[severity];
}

/** One severity and how many warnings currently carry it. */
export interface SeverityCount {
  readonly severity: WarningSeverity;
  readonly count: number;
}

/**
 * How many warnings of each severity there are, **most urgent first**, with
 * empty severities dropped — the warnings dock's count badge ("2 × 1 !", UI
 * redesign Phase 4).
 *
 * Pure and here rather than inline in `WarningsPanel.tsx` for this module's
 * standing reason: it is the one place that knows severities have an order, and
 * a badge row that listed `info` before `severe` would be a bug a rendering
 * test would have to catch by reading the DOM. `severity.test.ts` pins it
 * against plain fixtures instead.
 *
 * Zero-count severities are omitted rather than rendered as "0 severe": the
 * badge row is a summary of what is wrong, and three quarters of it saying
 * "none of this" is not one.
 */
export function severityCounts(warnings: readonly Warning[]): readonly SeverityCount[] {
  const counts = new Map<WarningSeverity, number>();
  for (const warning of warnings) {
    counts.set(warning.severity, (counts.get(warning.severity) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([severity, count]) => ({ severity, count }))
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
}
