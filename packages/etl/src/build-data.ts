/**
 * CLI entry point for the Stage 1.5 dataset build (run via
 * `npm run build:data -w @garden-planner/etl`). This is the one side-effecting
 * layer: it reads the committed caches, decides which GBIF resolver to use based
 * on **live reachability**, drives `buildDataset`, and writes the artifact to
 * `/data`. All the reconciliation logic lives in `merge/`; this file only wires
 * real inputs to it and handles I/O.
 *
 * ── GBIF reachability, decided at run time (not assumed) ──
 * The join-key policy (ADR 0009) is designed to degrade gracefully when GBIF is
 * unreachable, but the build should still *use* GBIF when it can. So it probes
 * once: a single real `species/match` call. If that succeeds, the real
 * fetch-backed transport is used and any newly-learned resolutions are persisted
 * to the committed name cache. If it fails (the reality in this sandbox class —
 * `api.gbif.org` returns a 403 policy denial at the egress proxy), an offline
 * transport is used that fails every lookup *immediately*, so the 161 records
 * resolve to `gbifId: null` fast instead of incurring 161 network timeouts. Either
 * way the merge produces the same set of plants; only their `gbifId` fill differs.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { CACHE_PATH } from './index.ts';
import { loadCache, saveCache } from './resolve/gbif-cache.ts';
import { createGbifResolver } from './resolve/gbif-resolver.ts';
import {
  createFetchGbifTransport,
  type GbifMatchResponse,
  type GbifTransport,
} from './resolve/gbif-transport.ts';
import { loadOpenFarmCache } from './sources/openfarm/cache.ts';
import { OPENFARM_CACHE_PATH } from './sources/openfarm/source.ts';
import { buildDataset } from './merge/build-dataset.ts';
import { writeArtifact } from './merge/artifact.ts';

/** Where the committed artifact lives: `/data/plants.json` at the repo root. */
export const DATA_ARTIFACT_PATH = fileURLToPath(
  new URL('../../../data/plants.json', import.meta.url),
);

/** A binomial GBIF certainly knows — used only to probe reachability. */
const PROBE_NAME = 'Daucus carota';

/** A transport that fails instantly, so an offline build doesn't wait on 161 timeouts. */
const OFFLINE_TRANSPORT: GbifTransport = {
  matchName(): Promise<GbifMatchResponse> {
    return Promise.reject(new Error('GBIF is unreachable (reachability probe failed)'));
  },
};

/** Probe GBIF once; return the real transport if reachable, else the offline one. */
async function chooseTransport(log: (m: string) => void): Promise<GbifTransport> {
  const fetchTransport = createFetchGbifTransport();
  try {
    await fetchTransport.matchName(PROBE_NAME);
    log('GBIF reachability probe: reachable — using the live resolver (gbifIds will be filled).');
    return fetchTransport;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(
      `GBIF reachability probe: unreachable (${message}) — building with gbifId: null (ADR 0009 fallback).`,
    );
    return OFFLINE_TRANSPORT;
  }
}

/**
 * Run the build against the real committed data and write the artifact. Returns
 * nothing; throws on validation failure (the hard-fail gate) so the process exits
 * non-zero and CI fails loudly.
 */
export async function main(): Promise<void> {
  const log = (message: string): void => console.log(message);

  const rawOpenFarm = loadOpenFarmCache(OPENFARM_CACHE_PATH);
  const gbifCache = loadCache(CACHE_PATH);
  const transport = await chooseTransport(log);
  const resolver = createGbifResolver({ cache: gbifCache, transport });

  const generatedAt = new Date().toISOString().slice(0, 10);
  const { artifact, mergeReport } = await buildDataset({
    rawOpenFarm,
    resolver,
    generatedAt,
    log,
  });

  writeArtifact(DATA_ARTIFACT_PATH, artifact);
  log(`Wrote ${artifact.plantCount} plant(s) to ${DATA_ARTIFACT_PATH}.`);
  log(
    `Merge summary: ${mergeReport.spacingAttached.length} spacing attach(es), ` +
      `${mergeReport.companionLinksKept} link(s) kept, ` +
      `${mergeReport.companionLinksDropped.length} link(s) dropped.`,
  );

  // Persist any newly-learned GBIF resolutions (only possible when reachable).
  const updatedCache = resolver.getCache();
  if (Object.keys(updatedCache).length !== Object.keys(gbifCache).length) {
    saveCache(CACHE_PATH, updatedCache);
    log('Updated the committed GBIF name cache with newly-learned resolutions.');
  }
}

// Run when invoked directly (`npm run build:data`). Compared as file:// URLs so
// it also works on Windows — mirrors `src/index.ts`.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error('Stage 1.5 dataset build failed:', error);
    process.exitCode = 1;
  });
}
