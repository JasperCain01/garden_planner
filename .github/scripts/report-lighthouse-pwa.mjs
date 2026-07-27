/**
 * Turn a Lighthouse JSON report into a human-readable line in the GitHub
 * Actions run summary — and, when the PWA score has slipped below the score
 * this repository has recorded since Stage 5.1, a warning annotation.
 *
 * This is deliberately **informational**: it always exits 0, so a Lighthouse
 * regression (or a Lighthouse *outage*) never blocks a merge. ADR 0027 records
 * why — the short version is that the PWA category now only exists in a
 * deprecated Lighthouse major fetched from the network on every run, and the
 * property it really protects (an installable app that works offline) is
 * already gated for real by `app/e2e/offline.spec.ts` inside `npm run verify`.
 *
 * "Informational" must not mean "invisible", though, which is the failure mode
 * a bare `continue-on-error` has: a job that is green whether it measured
 * anything or not tells a reader nothing. So this script distinguishes the
 * three outcomes explicitly and writes all of them to the run summary:
 *
 *   1. audited, at or above baseline  → summary line, no annotation
 *   2. audited, below baseline        → summary line + ::warning:: annotation
 *   3. could not audit at all         → summary line + ::warning:: annotation,
 *                                       naming the reason, so a silently
 *                                       broken audit is never mistaken for a
 *                                       passing one
 *
 * Usage (from `.github/workflows/checks.yml`):
 *   node .github/scripts/report-lighthouse-pwa.mjs <report.json> <exitCode> <baseline>
 */

import { readFileSync, appendFileSync } from 'node:fs';

const [reportPath, rawExitCode, rawBaseline] = process.argv.slice(2);
const lighthouseExitCode = Number(rawExitCode ?? '0');
const baseline = Number(rawBaseline ?? '0.88');

/** Append a block to the Actions run summary, or to stdout when run locally. */
function summarise(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, `${markdown}\n`);
  }
  console.log(markdown);
}

/** Emit a GitHub Actions warning annotation (a no-op noise line locally). */
function warn(title, message) {
  console.log(`::warning title=${title}::${message}`);
}

/**
 * Read the PWA category score out of a Lighthouse JSON report.
 * Returns `null` rather than throwing for any shape we don't recognise — a
 * missing or malformed report is outcome 3 above, not a crash.
 */
function readPwaScore(path) {
  try {
    const report = JSON.parse(readFileSync(path, 'utf8'));
    const score = report?.categories?.pwa?.score;
    return typeof score === 'number' ? score : null;
  } catch {
    return null;
  }
}

/** The audits Lighthouse marked as failing, so the summary says *what* slipped. */
function failingAuditTitles(path) {
  try {
    const report = JSON.parse(readFileSync(path, 'utf8'));
    const refs = report?.categories?.pwa?.auditRefs ?? [];
    return refs
      .map((ref) => report.audits?.[ref.id])
      .filter((audit) => audit && audit.score !== null && audit.score < 1)
      .map((audit) => audit.title);
  } catch {
    return [];
  }
}

const score = readPwaScore(reportPath);

if (score === null) {
  const reason =
    lighthouseExitCode === 0
      ? `no PWA score could be read from ${reportPath}`
      : `lighthouse exited with code ${lighthouseExitCode}`;
  summarise(
    [
      '## Lighthouse PWA audit (informational)',
      '',
      `**The audit did not produce a score** — ${reason}.`,
      '',
      'This does not block the merge (ADR 0027). It does mean nothing was',
      'measured, so treat this run as "unaudited", not as "passed".',
    ].join('\n'),
  );
  warn('Lighthouse PWA audit', `The audit produced no score — ${reason}.`);
  process.exit(0);
}

const failing = failingAuditTitles(reportPath);
const failingList = failing.length
  ? failing.map((title) => `- ❌ ${title}`).join('\n')
  : '- _none_';

summarise(
  [
    '## Lighthouse PWA audit (informational)',
    '',
    `**Score: ${score.toFixed(2)} / 1.00** (recorded baseline: ${baseline.toFixed(2)})`,
    '',
    'Failing audits:',
    failingList,
    '',
    'Informational by design — see ADR 0027. The offline/installability',
    'behaviour this score approximates is gated for real by',
    '`app/e2e/offline.spec.ts`, which runs inside `npm run verify`.',
  ].join('\n'),
);

if (score < baseline) {
  warn(
    'Lighthouse PWA audit',
    `PWA score ${score.toFixed(2)} is below the recorded baseline of ${baseline.toFixed(2)}. ` +
      `Reported, not gated (ADR 0027) — if this is a real regression, fix it and update the ` +
      `figure recorded in README.md and docs/qa-checklist.md.`,
  );
}

process.exit(0);
