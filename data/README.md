# `/data` — the committed dataset artifact

This directory holds the **static plant dataset** the app loads at runtime. It is
a _build output_ of the `packages/etl` pipeline, committed to the repo so that:

- the deployed app (GitHub Pages) can load it as a plain static file, and
- the app works fully offline with no calls to external data sources.

## Status

**Populated.** `plants.json` is the merged, validated dataset produced by Workplan
**Stage 1.5** (see [`/docs/adr/0009-dataset-merge-and-licensing.md`](../docs/adr/0009-dataset-merge-and-licensing.md)).
It currently holds **160 plants**: the OpenFarm crops the adapter can map,
enriched with the hand-verified spacing table (Stage 1.3, spacing wins over
scraped figures on conflict) and the evidence-tagged companion/antagonist links
(Stage 1.4). Every record conforms to the Stage 0.2 schema
(`packages/engine/src/schema/`; zod is the source of truth, see
[`/docs/adr/0004-plant-schema.md`](../docs/adr/0004-plant-schema.md)).

Known caveats for this build, all a consequence of the build environment (not the
pipeline):

- **`gbifId` is `null` on every record.** GBIF's API is blocked by the build
  sandbox's egress policy, so the name resolver can't fill it. The merge joins by
  scientific name / slug instead and upgrades to GBIF-id joins automatically once
  the block lifts (ADR 0009). Nothing pretends to a GBIF id it doesn't have.
- **`broad-bean` is not included.** Its hand-verified spacing has no mappable
  OpenFarm counterpart (_Vicia faba_), so it and its two companion links are left
  out this round — logged by the build, and recorded in ADR 0009's Consequences.

## The artifact shape

`plants.json` is a plain JSON object: a metadata header (`schemaVersion`,
`generatedAt`, `license`, `plantCount`, and a de-duplicated `sources` roll-up)
followed by `plants` — the validated records, sorted by `id`. Plain JSON is the
right default for a static site: the browser loads it directly, no WASM/SQLite
runtime needed at this size.

## How to regenerate it

1. A contributor runs the ETL: `npm run build:data -w @garden-planner/etl`.
2. The build gathers the OpenFarm plants, merges the spacing and companion data,
   runs the **hard-fail validation gate** (schema + referential integrity +
   sanity bounds — the build fails loudly on any invalid, dangling, or absurd
   record), and writes `plants.json` here.
3. The contributor commits the regenerated artifact.

## Licensing

The dataset is licensed **CC BY-NC-SA 4.0** (not MIT like the code). Note that the
sources shipped _today_ — OpenFarm (CC0) plus original curation — do not by
themselves require NonCommercial; the dataset is held at CC BY-NC-SA deliberately,
to match the project's non-commercial stance and to absorb Plants For A Future
(CC BY-NC-SA) seamlessly once it is ingested. The full reasoning is in
[`/docs/adr/0009-dataset-merge-and-licensing.md`](../docs/adr/0009-dataset-merge-and-licensing.md).
Per-record provenance is stored in the artifact itself; see [`/NOTICE`](../NOTICE)
for the source/attribution roll-up.
