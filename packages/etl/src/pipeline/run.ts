/**
 * The pipeline shell (WORKPLAN.md Stage 1.1).
 *
 * Sequences the build-time ETL: gather names to resolve from every registered
 * source adapter (`pipeline/source.ts`) and resolve every one against GBIF
 * (`resolve/gbif-resolver.ts`), logging progress as it goes. Mapping raw
 * records into `Plant`s, reconciling duplicates, and validating the result
 * are later stages (1.2–1.5); this shell only proves the sequencing and the
 * resolution step work end to end. Deliberately agnostic to *which* sources
 * are registered, or whether zero are — see `pipeline/starter-source.ts` and
 * `src/index.ts` for how the demo/starter source is plugged in today.
 */

import type { GbifResolver, ResolveOutcome } from '../resolve/gbif-resolver.ts';
import type { SourceAdapter } from './source.ts';

/** A minimal logger interface so tests can capture output instead of printing it. */
export type PipelineLogger = (message: string) => void;

export interface PipelineOptions {
  /** Registered source adapters. Empty by default (see module doc above). */
  sources?: SourceAdapter[];
  /** The resolver to use for name resolution. Required — see `createGbifResolver`. */
  resolver: GbifResolver;
  /** Where progress is logged. Defaults to `console.log`. */
  log?: PipelineLogger;
}

export interface PipelineResult {
  /** How many source adapters ran. */
  sourceCount: number;
  /** Every name-resolution outcome, in the order they were resolved. */
  outcomes: ResolveOutcome[];
  /** Outcome counts, for a quick end-of-run summary. */
  summary: {
    resolved: number;
    unresolved: number;
    error: number;
    fromCache: number;
  };
}

/** Collect the names to resolve: one per record from every registered source. */
async function gatherNames(sources: SourceAdapter[], log: PipelineLogger): Promise<string[]> {
  const names: string[] = [];
  for (const source of sources) {
    log(`Fetching records from source "${source.id}" (${source.label})…`);
    const records = await source.fetchRecords();
    log(`  ${source.id}: ${records.length} record(s).`);
    names.push(...records.map((record) => record.name));
  }
  return names;
}

/**
 * Tally resolved/unresolved/error/from-cache counts for the end-of-run log
 * line. `fromCache` only makes sense for `resolved`/`unresolved` outcomes —
 * an `error` outcome is, by construction, never a cache entry (see
 * `gbif-resolver.ts`) — so it's excluded from that count rather than treated
 * as `false`.
 */
function summarize(outcomes: ResolveOutcome[]): PipelineResult['summary'] {
  const summary = { resolved: 0, unresolved: 0, error: 0, fromCache: 0 };
  for (const outcome of outcomes) {
    if (outcome.status === 'resolved') summary.resolved++;
    else if (outcome.status === 'unresolved') summary.unresolved++;
    else summary.error++;
    if (outcome.status !== 'error' && outcome.fromCache) summary.fromCache++;
  }
  return summary;
}

/**
 * Run the pipeline once: gather names, resolve them, log progress, and
 * return a summary. Does **not** persist the cache to disk itself — that's
 * the caller's job (see `src/index.ts`), so this function stays a pure,
 * easily-testable step with no file-system side effect of its own.
 */
export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const sources = options.sources ?? [];
  const log = options.log ?? console.log;

  log('garden-planner ETL pipeline starting…');
  if (sources.length === 0) {
    log('No source adapters registered — nothing to resolve.');
  }
  const names = await gatherNames(sources, log);

  log(`Resolving ${names.length} name(s) against GBIF…`);
  const outcomes = await options.resolver.resolveMany(names);
  for (const outcome of outcomes) {
    if (outcome.status === 'resolved') {
      log(
        `  ✓ "${outcome.query}" → gbifId ${outcome.gbifId} (${outcome.scientificName})` +
          (outcome.fromCache ? ' [cache]' : ' [network]'),
      );
    } else if (outcome.status === 'unresolved') {
      log(
        `  ✗ "${outcome.query}" — no confident GBIF match` +
          (outcome.fromCache ? ' [cache]' : ' [network]'),
      );
    } else {
      log(`  ! "${outcome.query}" — resolution failed: ${outcome.message}`);
    }
  }

  const summary = summarize(outcomes);
  log(
    `Done: ${summary.resolved} resolved, ${summary.unresolved} unresolved, ` +
      `${summary.error} error(s), ${summary.fromCache} from cache.`,
  );

  return { sourceCount: sources.length, outcomes, summary };
}
