# `@garden-planner/etl`

The build-time data pipeline. Runs only on a contributor's machine — **the
deployed app never runs this code** (see `docs/adr/0003`). Its job is to pull
plant data from external sources, normalize it into the Stage 0.2 `Plant`
schema (`@garden-planner/engine`), reconcile duplicates, validate everything,
and write the static dataset committed to `/data`. This package is
framework-free (no React/DOM), like `@garden-planner/engine`.

Full design reasoning: [`docs/adr/0005-gbif-name-resolver.md`](../../docs/adr/0005-gbif-name-resolver.md)
(pipeline shell + GBIF resolver) and
[`docs/adr/0006-openfarm-source-adapter.md`](../../docs/adr/0006-openfarm-source-adapter.md)
(the first source adapter).

## Status (Stage 1.5)

What exists today:

- **A runnable pipeline shell** (`src/pipeline/run.ts`) that sequences
  "gather names to resolve → resolve them against GBIF → log progress".
- **A GBIF scientific-name resolver** (`src/resolve/`) that fills the schema's
  nullable `gbifId` — the join key later sources are reconciled by.
- **The "add a source" extension point** (`src/pipeline/source.ts`) — the
  `SourceAdapter` interface every source implements.
- **The first real source adapter: OpenFarm** (`src/sources/openfarm/`), a
  community-rescued dump (see the ADR for why — OpenFarm's own dump never
  existed) mapped into the Stage 0.2 `Plant` schema, GBIF-resolved via the
  resolver above. `src/index.ts` registers it in place of Stage 1.1's demo
  `starterNamesSource` (`src/pipeline/starter-source.ts`, kept as a reference
  implementation of the interface but no longer the default).

- **The hand-verified spacing table: Stage 1.3** (`src/spacing/`), a curated,
  method-aware spacing table for 12 common British edibles, each figure
  cross-checked against ≥2 authoritative sources with the citations recorded
  per growing method. This is **original curation, not a source adapter** — see
  the section below and
  [`docs/adr/0007`](../../docs/adr/0007-hand-verified-spacing.md).
- **Companion-planting data: Stage 1.4** (`src/companions/`), evidence-tagged
  (`well-supported`/`traditional`) companion and antagonist relationships: 8
  hand-curated, cited relationships plus 78 mechanically derived from
  OpenFarm's own `companions` field. Also **not a source adapter** — see the
  section below and
  [`docs/adr/0008`](../../docs/adr/0008-companion-planting-data.md).

- **The merge, validation gate, and artifact emitter: Stage 1.5** (`src/merge/`),
  the ⭐ keystone that reconciles the three inputs above into the committed
  `data/plants.json` — joining spacing and companion slices onto the OpenFarm
  plants, applying the conflict rules (hand-verified spacing wins), remapping
  companion-link ids for referential integrity, and enforcing the **hard-fail
  validation gate**. Run with `npm run build:data`. See the section below and
  [`docs/adr/0009`](../../docs/adr/0009-dataset-merge-and-licensing.md).

**PFAF and Permapeople adapters (the rest of 1.2) are blocked, not skipped.**
PFAF's bulk database is paywalled ($30–150, no free bulk download exists);
Permapeople's API needs a signed-up account's API key. A substitute source
(USDA PLANTS) turned out to be unreachable from this sandbox, and the one
freely-licensed alternative found (`bripatch/plant-variety-database`) has
provenance red flags serious enough not to trust without independent
verification. Full detail, including exactly what would unblock each one, is
in [`docs/adr/0006`](../../docs/adr/0006-openfarm-source-adapter.md)'s
addendum — read that before re-researching this from scratch.

## Running it

```bash
npm run start -w @garden-planner/etl
```

This loads the committed GBIF cache (`cache/gbif-name-cache.json`), resolves
every name it doesn't already have a cached answer for (the OpenFarm
adapter's ~160 mappable crops — see `src/sources/openfarm/categories.ts` —
via the committed `cache/openfarm-crops.json`, no network needed to read the
source data itself), logs each outcome, and writes any newly-learned
resolutions back to the GBIF cache file — but only if something new was
actually learned, so a run where every name was already cached leaves the
file untouched. Commit the file if it changed.

`npm run typecheck -w @garden-planner/etl` and `npm run test -w
@garden-planner/etl` work the same as any other workspace; `npm run build -w
@garden-planner/etl` type-checks (this package ships no compiled output — the
`start` script runs the TypeScript source directly).

## Building the dataset (`src/merge/`, Stage 1.5)

```bash
npm run build:data -w @garden-planner/etl
```

This is the step that writes the app's shipped data. It:

1. **Probes GBIF reachability** once. If reachable, it resolves names live and
   fills each plant's `gbifId`; if not (the current reality — `api.gbif.org` is
   blocked), it builds with `gbifId: null` fast, without waiting on ~160 doomed
   network calls.
2. **Gathers** the mappable OpenFarm plants (keeping a record even when GBIF
   can't place it — the join key falls back to scientific name / slug), skipping
   any with absurd spacing with a stated reason.
3. **Merges** the hand-verified spacing (which _wins_ over OpenFarm's scraped row
   spacing) and the companion/antagonist links onto the right plants, joining by
   GBIF id → unambiguous scientific name → shared slug / a small curated alias
   table (`beetroot`→`beet`, `french-bean`→`green-bean`), and remapping
   companion-link ids through the same unification so nothing dangles.
4. Runs the **hard-fail validation gate** (schema + referential integrity +
   sanity bounds) over the whole set — the build fails loudly, listing every
   problem, if any record is malformed, dangling-referenced, or absurd.
5. Writes `data/plants.json` and reports what it attached, remapped, and dropped.

The reconciliation policy, the licensing decision, and the known `broad-bean` gap
are documented in [`docs/adr/0009`](../../docs/adr/0009-dataset-merge-and-licensing.md).
The merge logic is pure and injectable, so `src/merge/*.test.ts` exercises it
(including the gate failing on an intentionally-broken record) without any
network access.

## Offline-first: the cache

`cache/gbif-name-cache.json` is a **committed file**, not a build artifact you
regenerate from nothing each time. It's keyed by a normalized query name; each
entry is either a confident GBIF match or a confident "no match" — see the ADR
for why transport failures are deliberately never cached. Once a name is in
the cache, resolving it again never touches the network, which is what makes
CI, a fresh clone, and an offline contributor all work without GBIF access.

The committed cache currently ships **empty**: this development environment's
network egress policy blocks `api.gbif.org` (confirmed via the environment's
proxy status endpoint), so the resolver's live network path couldn't be
exercised in this session — only its offline/cached path (which is what the
unit tests cover). A contributor with GBIF access can run `npm run start -w
@garden-planner/etl` to populate it for real.

## Offline-first: the OpenFarm source cache

`cache/openfarm-crops.json` is a different kind of cache: a **committed
snapshot of the whole source** (340 records, community-rescued — see
[`docs/adr/0006`](../../docs/adr/0006-openfarm-source-adapter.md)), not a
per-query index like the GBIF cache above. `src/sources/openfarm/cache.ts#loadOpenFarmCache`
reads it directly; nothing in the normal pipeline run re-fetches it. A
maintainer can refresh it from the network with
`cache.ts#refreshOpenFarmCache`, backed by the injectable transport in
`src/sources/openfarm/transport.ts` (unit tests inject a stub, exactly like
`resolve/gbif-transport.ts`).

## Hand-verified spacing table (`src/spacing/`)

The one part of the pipeline that is **original curation, not ingestion**
(Stage 1.3 ⭐ — full design in
[`docs/adr/0007`](../../docs/adr/0007-hand-verified-spacing.md)). It is
deliberately **not** a `SourceAdapter`: there is no external source to fetch:
these are spacing figures hand-verified against authoritative charts.

- **The data** lives in `src/spacing/table.ts` as `HAND_VERIFIED_SPACING`, a
  typed `SpacingRecord[]`. A `.ts` module (not JSON) so every figure can carry
  an inline comment explaining the value and its sources. It covers 12 common
  British edibles (the Stage 1.1 demo five plus overlap with the OpenFarm crop
  list, to maximise Stage 1.5 merge overlap).
- **The shape** (`src/spacing/schema.ts`) reuses the engine's `SpacingSchema`
  verbatim (row and/or intensive) and adds **per-method provenance**:
  `provenance.row` / `provenance.intensive`, each requiring **≥2 source
  citations**, and each coupled to its figure so an intensive density can never
  be back-filled from row-only citations. Sanity bounds
  (`spacingSanityIssues`, `SPACING_SANITY_BOUNDS`) reject implausible values on
  top of the schema's positivity floor.
- **Sourcing.** Each figure is cross-checked against ≥2 sources (RHS + Old
  Farmer's Almanac for row figures; two square-foot-gardening charts for
  intensive figures), recorded per row. Genuine source disagreements (e.g.
  onion 9-vs-16 per square) are recorded in each row's `note`, not smoothed
  over. See the ADR for the retrieval-honesty caveat (the source sites were
  network-blocked in the authoring sandbox; figures came from search snippets
  of the real pages and are reviewer-re-verifiable).

### Adding a crop to the spacing table

1. Add a `SpacingRecord` to `HAND_VERIFIED_SPACING` in `src/spacing/table.ts`.
2. Give it `id`/`commonName`/`scientificName`/`category`, and a `spacing` block
   with `row` and/or `intensive` — **only the methods you can actually cite**.
3. For each method present, add **≥2 `provenance` citations** that state _that
   method's_ figure. Don't derive an intensive density from a row figure — leave
   the block absent if you can't cite it (the schema allows row-only or
   intensive-only).
4. `npm run test -w @garden-planner/etl` re-runs `table.test.ts`, which
   validates every row, enforces the ≥2-source and unique-id rules, and checks
   each intensive figure has a real SFG citation.

## Companion-planting data (`src/companions/`)

Evidence-tagged companion/antagonist relationships (Stage 1.4 — full design
in [`docs/adr/0008`](../../docs/adr/0008-companion-planting-data.md)). Also
deliberately **not** a `SourceAdapter`: it produces relationships _between_
two plants, not a name to resolve, which is not what that interface is for.

- **The data** is split across two files by how it was produced:
  - `src/companions/curated.ts` — `CURATED_COMPANION_RELATIONSHIPS`, 8
    hand-picked relationships among the Stage 1.3 spacing crops, each backed
    by a real citation (a study, an extension plant-pathology page, an
    agronomy review) and individually evidence-tagged by weighing that
    citation's actual strength.
  - `src/companions/openfarm-derived.ts` — `OPENFARM_DERIVED_COMPANION_RELATIONSHIPS`,
    mechanically extracted from OpenFarm's own scraped `companions` field
    (already cached, `cache/openfarm-crops.json`, no new fetch). Always
    tagged `traditional`: a scraped wiki field has no citation of its own to
    elevate it. 78 relationships as of this stage.
  - `src/companions/relationships.ts` combines both into
    `ALL_COMPANION_RELATIONSHIPS`, and exposes `toPlantLinksById` — the
    bridge Stage 1.5 uses to attach real, `PlantLinkSchema`-validated
    `PlantLink`s onto merged `Plant` records by id.
- **The shape** (`src/companions/schema.ts`) reuses the engine's
  `EvidenceLevelSchema`/`SlugSchema`/`SourceRefSchema` verbatim and adds the
  directed-edge framing curation needs: `from`/`to`, `kind`
  (`companion`/`antagonist`), and a `symmetric` flag recording whether the
  claim holds in both directions.
- **The plant-id universe** (`src/companions/plant-id-universe.ts`) — every
  relationship's `from`/`to` is checked against the union of the Stage 1.3
  spacing ids and every OpenFarm crop Stage 1.2's mapper actually produces a
  `Plant` for (164 ids total). Full referential integrity against the final
  merged dataset is Stage 1.5's job, but this stops a dangling link from
  being authored in the first place.
- **Sourcing and evidence calls.** See the ADR for the full per-relationship
  reasoning and the retrieval-honesty caveat (several cited sites are
  network-blocked in the authoring sandbox; citations came from search
  snippets of the real pages and are reviewer-re-verifiable, the same
  discipline `docs/adr/0007` used for spacing). It also records why the named
  Wikipedia companion-planting dataset (`GenevieveMilliken/companion_plants`)
  was investigated but not used: the host is reachable but its data file's
  path is undiscoverable without GitHub API/git access, which this sandbox
  blocks.

### Adding a companion/antagonist relationship

1. **Hand-curated, cited relationship:** add a `CompanionRelationship` to
   `CURATED_COMPANION_RELATIONSHIPS` in `src/companions/curated.ts`. Give it
   `from`/`to` (plant ids), `kind`, an honestly-chosen `evidence` tag, a
   `note` explaining _why_ that tag, `symmetric`, and **at least one real
   citation** in `sources` (two, if you want it held to the `well-supported`
   bar `curated.test.ts` checks). Both `from` and `to` must resolve in
   `PLANT_ID_UNIVERSE` — a test will fail otherwise. **For a `symmetric:
false` entry, `from` must be the plant that benefits/is harmed, not the
   plant that causes the effect** — see `schema.ts`'s doc comment on
   `CompanionRelationshipSchema` for the direction convention (getting this
   backwards passes every existing check silently, since both directions are
   valid slugs).
2. **OpenFarm-derived relationships** need no manual addition — extending
   `sources/openfarm/categories.ts`'s allow-list automatically grows
   `OPENFARM_DERIVED_COMPANION_RELATIONSHIPS` on the next run.
3. `npm run test -w @garden-planner/etl` re-runs the `src/companions/*.test.ts`
   suite: schema validity, evidence-tag presence, referential integrity
   against the plant-id universe, and no exact-duplicate edges.

## Toolchain notes

- The `start` script runs source directly via `node --experimental-strip-types`
  (no separate build step). Unlike a bundler, Node's ESM resolver requires
  **explicit `.ts` extensions on relative imports** — that's why files in this
  package write `import { x } from './y.ts'` rather than `'./y'`. See
  `tsconfig.base.json` (repo root) for the shared `allowImportingTsExtensions`
  flag this — and `@garden-planner/engine`'s own internal imports — relies on.
- Everything else (strict TS, `verbatimModuleSyntax`, pinned Vite/Vitest,
  Node ≥ 20, ESM) follows the repo-wide conventions in `WORKPLAN.md` §0.5.

## Adding a source (PFAF, Permapeople, and beyond)

`src/sources/openfarm/` is the reference implementation — see
[`docs/adr/0006`](../../docs/adr/0006-openfarm-source-adapter.md) for the
full reasoning behind its shape. The pattern it establishes:

1. **A raw type + shape guard** (`types.ts`) for the source's own data shape,
   validated before trusting it — the same discipline `resolve/gbif-transport.ts`
   applies to GBIF responses.
2. **An offline-first cache** (`cache.ts` + `transport.ts`): read the
   committed snapshot by default; isolate the one place that would re-fetch
   it over the network behind an injectable interface, so tests never touch
   the network.
3. **A pure mapper** (`map.ts`) from the raw shape into the Stage 0.2 `Plant`
   schema — populate only fields the source actually provides, and **skip
   with a stated reason** (never guess, never silently drop) any record
   missing something the schema requires. Leave `gbifId: null`; that's the
   resolver's job.
4. **A `SourceAdapter`** (`source.ts`) implementing `src/pipeline/source.ts`,
   returning only the records step 3 can actually map.
5. **(Optional) a build-plants helper** (`build-plants.ts`) tying the mapper
   to a `GbifResolver` via `resolve/apply-resolution.ts#applyGbifResolution`,
   producing finished, `validatePlant`-passing `Plant`s for Stage 1.5 to
   later consume — proven by tests, not wired into the CLI (see the ADR for
   why the generic pipeline stays agnostic to this).

Register the adapter in `src/index.ts`'s `main()` (joining or replacing the
`sources` passed to `runPipeline`) — or pass it directly:
`runPipeline({ sources: [pfafAdapter], resolver })`. Nothing in
`pipeline/run.ts` needs to change; that's the point of the extension point.

## Module map

```
src/
  index.ts               CLI entry point: loads the cache, runs the pipeline,
                          saves the cache if anything new was learned.
                          Executed by `npm run start`.
  pipeline/
    source.ts             SourceAdapter — the "add a source" extension point.
    run.ts                Orchestration: gather names → resolve → log → summarize.
    starter-source.ts     Demo SourceAdapter from Stage 1.1 (interface reference only).
  resolve/
    gbif-transport.ts      The network boundary (injectable; real fetch impl).
    gbif-cache.ts           Load/save the committed JSON cache.
    gbif-resolver.ts         Offline-first resolve logic (cache → transport).
    apply-resolution.ts      Fills a Plant's gbifId via @garden-planner/engine.
  sources/
    openfarm/               The first real source adapter (Stage 1.2). See
                             docs/adr/0006 and this file's "Adding a source"
                             section above for the module-by-module pattern.
  spacing/                  Hand-verified, method-aware spacing table (Stage 1.3).
    schema.ts                SpacingRecord schema: reuses the engine's SpacingSchema,
                             adds per-method ≥2-source provenance + sanity bounds.
    table.ts                 The curated data (HAND_VERIFIED_SPACING). Not a source
                             adapter — original curation. See docs/adr/0007.
  companions/               Evidence-tagged companion/antagonist data (Stage 1.4).
    schema.ts                CompanionRelationship schema: directed from/to edges
                              reusing the engine's PlantLink/EvidenceLevel/SourceRef.
    plant-id-universe.ts     The pre-merge id universe (spacing ids ∪ OpenFarm
                              mapped ids) relationships are checked against.
    curated.ts                Hand-picked, individually-cited relationships.
    openfarm-derived.ts       Mechanical extraction from OpenFarm's companions field.
    relationships.ts          Combines both; PlantLink-shaped output for Stage 1.5.
                              Not a source adapter — see docs/adr/0008.
  merge/                    The Stage 1.5 merge, validation gate, and emitter.
    aliases.ts               Curated slug aliases (beetroot→beet, french-bean→green-bean).
    join.ts                  Join-key primitives: gbifId → scientific name → slug/alias.
    collect-openfarm.ts      Gathers OpenFarm plants, resilient to GBIF being offline.
    sanity.ts                Dataset-level (tree-tolerant) spacing absurdity bounds.
    merge.ts                 The merge: attach spacing (wins) + remapped links.
    validate.ts              The hard-fail gate: schema + referential integrity + sanity.
    artifact.ts              Builds/writes data/plants.json (header + sorted plants).
    build-dataset.ts         Orchestrates gather → merge → validate → artifact (pure).
  build-data.ts            CLI entry: reads caches, probes GBIF, writes /data.
                            Executed by `npm run build:data`.
cache/
  gbif-name-cache.json    The committed, offline-first name-resolution cache.
  openfarm-crops.json     The committed OpenFarm rescue-dump snapshot (340 records).
```
