/**
 * The "add a source" extension point (WORKPLAN.md Stage 1.1).
 *
 * Stage 1.2 implements one `SourceAdapter` per external source (PFAF, the
 * OpenFarm dump, Permapeople). This file defines the shape those adapters
 * implement, so the pipeline in `pipeline/run.ts` never has to change shape as
 * sources are added — it just iterates a registry of `SourceAdapter`s.
 *
 * Deliberately minimal: an adapter's only job is "produce raw records, each
 * carrying the name to resolve against GBIF". Mapping a raw record into the
 * Stage 0.2 `Plant` shape, and any source-specific network/caching concerns,
 * are the adapter's own problem — the pipeline only orchestrates and resolves
 * names, it never has to know PFAF's CSV columns or Permapeople's JSON shape.
 */

/**
 * One raw record from a source, not yet mapped to the `Plant` schema.
 *
 * `name` is whatever the source calls the plant (a common name, a scientific
 * name, or both) — it's the string the pipeline hands to the GBIF resolver to
 * obtain `gbifId`. `raw` is the untouched source payload; only the adapter
 * that produced it knows its shape, so it's typed `unknown` here on purpose
 * and narrowed by that adapter's own mapping code (arriving in Stage 1.2).
 */
export interface SourceRecord {
  /** The name to resolve against GBIF (common or scientific). */
  readonly name: string;
  /** The untouched payload from the source, for the adapter's own mapper to use. */
  readonly raw: unknown;
}

/**
 * The contract every source adapter implements. To add a source: write a
 * module implementing this interface and add it to the `sources` array passed
 * to `runPipeline` (see `pipeline/run.ts`) — nothing else in the pipeline
 * needs to change.
 */
export interface SourceAdapter {
  /** Short, stable id used in logs and provenance, e.g. `"pfaf"`. */
  readonly id: string;
  /** Human-readable name for logs and provenance, e.g. `"Plants For A Future"`. */
  readonly label: string;
  /**
   * Fetch this source's raw records. Adapters own their own network I/O and
   * any source-specific caching (mirroring the resolver's own offline-first
   * cache) — the pipeline only calls this once per run and resolves the
   * names it returns.
   */
  fetchRecords(): Promise<SourceRecord[]>;
}
