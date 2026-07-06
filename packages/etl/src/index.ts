/**
 * `@garden-planner/etl` — build-time data pipeline (developer tool, NOT shipped).
 *
 * This code runs on a contributor's machine to ingest external plant sources
 * (PFAF, Permapeople, the OpenFarm dump, GBIF, …), normalize them to the plant
 * schema, reconcile duplicates, validate every record, and emit the static
 * dataset committed under `/data`. The **deployed app never runs this code** —
 * that separation is what keeps the app offline-safe (see docs/adr/0003).
 *
 * Source adapters and the merge/validation gate are built in Phase 1
 * (WORKPLAN.md Stages 1.1–1.6). This is the scaffold entry point.
 */

/** Placeholder pipeline entry. Real ingestion arrives in Stages 1.1–1.6. */
export function runPipeline(): string {
  return 'etl scaffold ready — no sources configured yet';
}

// When executed directly (e.g. `npm run start -w @garden-planner/etl`), report
// status. This is developer convenience only; it is never bundled into the app.
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(runPipeline());
}
