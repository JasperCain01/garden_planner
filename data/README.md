# `/data` — the committed dataset artifact

This directory holds the **static plant dataset** the app loads at runtime. It is
a _build output_ of the `packages/etl` pipeline, committed to the repo so that:

- the deployed app (GitHub Pages) can load it as a plain static file, and
- the app works fully offline with no calls to external data sources.

## Status

Empty for now — the dataset is produced starting in Workplan **Phase 1**
(Stages 1.1–1.6). The schema every record here must conform to is defined in
**Stage 0.2** and lives in `packages/engine/src/schema/` (zod is the source of
truth; see [`/docs/adr/0004-plant-schema.md`](../docs/adr/0004-plant-schema.md)).
The ETL will call the schema's `validatePlant()` as its hard-fail gate (Stage
1.5), so no malformed record ever lands here.

## How it will work

1. A contributor runs the ETL (`npm run build -w @garden-planner/etl`, details in
   Phase 1).
2. The ETL ingests external sources, normalizes them to the schema, reconciles
   duplicates, and **validates every record** (the build fails on invalid data).
3. It writes the artifact here, and the contributor commits it.

## Licensing

The dataset is licensed **CC BY-NC-SA 4.0** (not MIT like the code), because it
derives in part from Plants For A Future. Per-record provenance is stored in the
artifact itself. See [`/NOTICE`](../NOTICE) for attribution.
