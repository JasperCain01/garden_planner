/**
 * The pipeline shell (WORKPLAN.md Stage 1.1).
 *
 * Sequences the build-time ETL: gather names to resolve (from registered
 * source adapters, once Stage 1.2 adds them — see `pipeline/source.ts`) and
 * resolve every one against GBIF (`resolve/gbif-resolver.ts`), logging
 * progress as it goes. Mapping raw records into `Plant`s, reconciling
 * duplicates, and validating the result are later stages (1.2–1.5); this
 * shell only proves the sequencing and the resolution step work end to end.
 */

import type { GbifResolver, ResolveOutcome } from '../resolve/gbif-resolver.ts';
import type { SourceAdapter } from './source.ts';

/**
 * A small starter list of common edible names to resolve when no source
 * adapters are registered yet (true until Stage 1.2 lands). This lets
 * `npm run start -w @garden-planner/etl` exercise the real resolve-and-cache
 * step today, rather than the pipeline being a no-op until 1.2 exists. Once
 * adapters are registered, their records supply the names instead — see
 * {@link gatherNames}.
 */
export const STARTER_NAMES: readonly string[] = ['onion', 'lettuce', 'carrot', 'potato', 'tomato'];

/** A minimal logger interface so tests can capture output instead of printing it. */
export type PipelineLogger = (message: string) => void;

export interface PipelineOptions {
  /** Registered source adapters. Empty until Stage 1.2 (see `pipeline/source.ts`). */
  sources?: SourceAdapter[];
  /** The resolver to use for name resolution. Required — see `createGbifResolver`. */
  resolver: GbifResolver;
  /** Where progress is logged. Defaults to `console.log`. */
  log?: PipelineLogger;
}

export interface PipelineResult {
  /** How many source adapters ran (0 until Stage 1.2). */
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

/**
 * Collect the names to resolve: one per record from every registered source,
 * falling back to {@link STARTER_NAMES} when no sources are registered so the
 * pipeline has something real to do before Stage 1.2 exists.
 */
async function gatherNames(sources: SourceAdapter[], log: PipelineLogger): Promise<string[]> {
  if (sources.length === 0) {
    log(
      `No source adapters registered yet (Stage 1.2) — using ${STARTER_NAMES.length} starter names.`,
    );
    return [...STARTER_NAMES];
  }

  const names: string[] = [];
  for (const source of sources) {
    log(`Fetching records from source "${source.id}" (${source.label})…`);
    const records = await source.fetchRecords();
    log(`  ${source.id}: ${records.length} record(s).`);
    names.push(...records.map((record) => record.name));
  }
  return names;
}

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
