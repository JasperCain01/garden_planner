/**
 * A warning's severity as an icon rather than a shouted word (UI redesign
 * Phase 4, ADR 0033 §5).
 *
 * Until this phase every DOM surface showing a severity rendered
 * `warning.severity.toUpperCase()` — "SEVERE", "WARNING", "INFO" — which is
 * eight to seven characters of a 300px column spent restating what the
 * sentence beside it already says, on the item where space is tightest.
 *
 * **The glyph is `severity.ts`'s `severityGlyph`, not a new one.** Stage 6.2
 * added `i`/`!`/`×` so the canvas marker's badge carried severity in *shape*
 * and not only colour (WCAG 1.4.1). Reusing it here means a marker badged `×`
 * and the dock card that explains it are marked the same way — the connection
 * between the two is the whole reason the badges and the list both exist. A
 * second, prettier icon set would have broken that for decoration.
 *
 * **The word did not disappear, it moved into the accessible name.** The icon
 * is `role="img"` with an `aria-label` of the severity, so a screen reader
 * announces "severe" exactly where it used to read "SEVERE" — and a `title`
 * puts the same word under a sighted user's pointer, which the uppercase text
 * never needed but the glyph does.
 *
 * Colour comes from the `--severity-*` tokens (the CSS mirror of
 * `severity.ts`'s `SEVERITY_COLORS`, guarded by `styles/tokens.test.ts`), whose
 * 4.5:1 figures were measured against **white** — `--severity-severe` manages
 * only 4.35:1 on the page cream — so this only ever renders on a card
 * (`docs/accessibility.md` §2). Why the mark is outlined rather than filled is
 * a legibility argument and not a contrast one; it is in the stylesheet beside
 * the rule that draws it.
 */

import type { WarningSeverity } from '@garden-planner/engine';
import { severityGlyph } from './severity.ts';
import styles from './SeverityIcon.module.css';

export interface SeverityIconProps {
  readonly severity: WarningSeverity;
}

export function SeverityIcon({ severity }: SeverityIconProps) {
  return (
    // `role="img"` makes the subtree presentational, so the glyph is never read
    // out as a character ("times", "exclamation mark") — the `aria-label` is.
    <span
      className={styles.icon}
      data-severity={severity}
      role="img"
      aria-label={severity}
      title={severity}
    >
      {severityGlyph(severity)}
    </span>
  );
}
