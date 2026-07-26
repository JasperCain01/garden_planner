# `/data` — the committed dataset artifact

This directory holds the **static plant dataset** the app loads at runtime. It is
a _build output_ of the `packages/etl` pipeline, committed to the repo so that:

- the deployed app (GitHub Pages) can load it as a plain static file, and
- the app works fully offline with no calls to external data sources.

## Status

**Populated.** `plants.json` is the merged, validated dataset produced by Workplan
**Stage 1.5** (see [`/docs/adr/0009-dataset-merge-and-licensing.md`](../docs/adr/0009-dataset-merge-and-licensing.md))
and extended by **Stage 1.7**'s curated input (see
[`/docs/adr/0021-curated-plant-input.md`](../docs/adr/0021-curated-plant-input.md)).
It currently holds **162 plants**: 160 OpenFarm crops the adapter can map, plus
**2 maintainer-curated crops** (`broad-bean`, `jerusalem-artichoke` — full
identity and provenance, held to the same bar as every other record), enriched
with the hand-verified spacing table (Stage 1.3, spacing wins over scraped
figures on conflict) and the evidence-tagged companion/antagonist links
(Stage 1.4). Every record conforms to the Stage 0.2 schema
(`packages/engine/src/schema/`; zod is the source of truth, see
[`/docs/adr/0004-plant-schema.md`](../docs/adr/0004-plant-schema.md)).

The Stage 0.3 amendment for user-defined crops
([`/docs/adr/0011-user-defined-crop-schema.md`](../docs/adr/0011-user-defined-crop-schema.md))
**did not relax the bar this artifact has to clear.** Every shipped record still
needs full identity and provenance; the permissive path is a separate input schema
used only by the in-browser add-crop form, whose crops live in session memory and
are never written here. Two things follow for this file: the build gate now also
rejects any shipped id in the reserved **`user-` namespace** (which belongs to
session-scoped user crops), and nothing in `plants.json` carries `user-entered`
provenance.

Known caveats for this build, all a consequence of the build environment (not the
pipeline):

- **`gbifId` is `null` on every record.** GBIF's API is blocked by the build
  sandbox's egress policy, so the name resolver can't fill it. The merge joins by
  scientific name / slug instead and upgrades to GBIF-id joins automatically once
  the block lifts (ADR 0009). Nothing pretends to a GBIF id it doesn't have.
- **`broad-bean` is no longer a gap.** It was previously excluded — ADR 0009's
  Consequences recorded that OpenFarm has no mappable _Vicia faba_, so its
  hand-verified spacing and its `leek` antagonist link had nothing to attach
  to. Stage 1.7 closes this: it now ships as a curated crop (ADR 0021), and
  both the spacing row and the companion link attach to it as normal.

## The dataset's four inputs

1. **OpenFarm** — the community-rescued crop dump (Stage 1.2).
2. **The hand-verified spacing table** (Stage 1.3) — spacing wins on conflict.
3. **Companion/antagonist relationships** (Stage 1.4).
4. **Maintainer-curated plants** (Stage 1.7, `packages/etl/src/curated/plants.ts`)
   — full, hand-authored `Plant` records for crops OpenFarm's dump doesn't have,
   or a maintainer wants to correct. A curated crop colliding with an OpenFarm
   one **replaces it outright** (curated wins, ADR 0021); everything else about
   it — spacing attach, companion links, the hard-fail gate — works exactly
   like any other plant, with no relaxation. Distinct from the in-app
   add-crop form (Stage 3.6, ADR 0011): that path is session-only and
   relaxed-schema; this one is permanent and held to the full shipped bar.

## The artifact shape

`plants.json` is a plain JSON object: a metadata header (`schemaVersion`,
`generatedAt`, `license`, `plantCount`, and a de-duplicated `sources` roll-up)
followed by `plants` — the validated records, sorted by `id`. Plain JSON is the
right default for a static site: the browser loads it directly, no WASM/SQLite
runtime needed at this size.

## How to regenerate it

1. A contributor runs the ETL: `npm run build:data -w @garden-planner/etl`.
2. The build gathers the OpenFarm plants, folds in the curated plants
   (replacing an OpenFarm-sourced record outright on an id collision), merges
   the spacing and companion data, runs the **hard-fail validation gate**
   (schema + referential integrity + sanity bounds — the build fails loudly on
   any invalid, dangling, or absurd record), and writes `plants.json` here.
3. The contributor commits the regenerated artifact.

To add a maintainer-curated crop permanently, see
`packages/etl/README.md`'s "Maintainer-curated plants" section.

## Licensing

The dataset is licensed **CC BY-NC-SA 4.0** (not MIT like the code). Note that the
sources shipped _today_ — OpenFarm (CC0) plus original curation — do not by
themselves require NonCommercial; the dataset is held at CC BY-NC-SA deliberately,
to match the project's non-commercial stance and to absorb Plants For A Future
(CC BY-NC-SA) seamlessly once it is ingested. The full reasoning is in
[`/docs/adr/0009-dataset-merge-and-licensing.md`](../docs/adr/0009-dataset-merge-and-licensing.md).
Per-record provenance is stored in the artifact itself; see [`/NOTICE`](../NOTICE)
for the source/attribution roll-up.
