# Stage 1.4 brief — companion-planting data (evidence-tagged)

A tight starting point for a fresh session. Read [`DESIGN.md`](../DESIGN.md)
(especially §"Companion planting data") and [`WORKPLAN.md`](../WORKPLAN.md)
(§0 ground rules and the Stage 1.4 entry) first; this brief concentrates the
requirements so you don't have to reconstruct them. Stages 0.2 (the plant-record
schema), 1.1 (ETL shell + GBIF resolver), and 1.3 (hand-verified spacing table)
are done and on this branch — build on them, don't redefine them. Stage 1.2
(source adapters) is **partially** done: one real adapter (OpenFarm) exists;
PFAF/Permapeople are documented, credential/paywall-blocked follow-up (see
`docs/adr/0006`'s addendum) — **not this stage's problem**. Stage 1.4 depends on
0.2, plus the plant set from 1.2/1.3 for referential integrity.

## Goal

Produce the **companion and antagonist relationships** between crops, each
carrying an **honest evidence tag**. This is the third data-content stage feeding
the Stage 1.5 merge (alongside the source adapters and the spacing table), and it
powers the "suggest companions / warn about antagonists" half of the app
(`DESIGN.md` §1, and Stage 2.3's warnings engine).

## Why the evidence tag is the whole point

`DESIGN.md` is blunt about it: companion planting is "a mix of solid science
(e.g. legumes fixing nitrogen, scent-masking pest deterrence) and folklore. The
open data reflects that." So the schema **already forces** an honesty tag on
every relationship — `EvidenceLevelSchema` is `'well-supported' | 'traditional'`
(`packages/engine/src/schema/plant.ts`), and `PlantLinkSchema` requires it. Your
job is to assign that tag **per pairing, honestly**, not to blanket-label
everything `traditional` (which Stage 1.2's OpenFarm adapter explicitly refused to
do — see `docs/adr/0006`'s rejected-alternatives entry, which deferred exactly
this judgement to Stage 1.4) nor to overstate folklore as `well-supported`.
Record the _reason_ for the call in the link's optional `note` — the same
"reviewable fact, not an assertion" discipline Stage 1.3 applied to spacing
provenance.

## What the schema already gives you (don't redefine it)

- `PlantLinkSchema` — a directed link: `plantId` (a slug), `evidence`, optional
  `note`. Import it and the inferred `PlantLink` type from
  `@garden-planner/engine`; don't restate the shape.
- `Plant.companions` / `Plant.antagonists` — `PlantLink[]` (nonempty, optional).
- **Referential integrity is deliberately _not_ enforced in the schema** (a
  single record can't see the whole dataset) — it is checked at dataset-build
  time (Stage 1.5). See `PlantLinkSchema`'s own doc comment.

## What to build

1. **A curated, provenance-tagged relationship dataset.** Where it lives and its
   exact shape are your call (as with Stage 1.3, there's no single mandated
   pattern) — but keep it consistent with the repo's conventions and document the
   decision in the ADR. A directed edge list (`{ from, to, kind:
companion|antagonist, evidence, note, provenance }`) is a natural fit.
2. **Honest evidence tags with recorded provenance**, matching
   `ProvenanceSchema`/`SourceRefSchema`. A `well-supported` tag should be able to
   point at _why_ (a mechanism, a study, an extension guide); a `traditional` tag
   should say so plainly.
3. **A decided, documented plant-id universe.** Referential integrity is 1.5's
   gate, but don't author dangling links by construction: the natural id universe
   is the **union of the Stage 1.3 spacing-table ids** (12 crops,
   `packages/etl/src/spacing/table.ts`) **and OpenFarm's mapped crops** (~161,
   `packages/etl/src/sources/openfarm/categories.ts`). Every link's `plantId`
   should resolve within that set; make it a tested invariant.

## Candidate sources & the SourceAdapter question

- **OpenFarm's `companions` field** is **already cached** in
  `packages/etl/cache/openfarm-crops.json` (present on ~134 records) and was
  deliberately left unmapped by Stage 1.2 for you (`docs/adr/0006` §2). No new
  fetch needed to use it. But it's a scraped wiki field with no citation, so it
  informs `traditional`-tagged links at best — not `well-supported` on its own.
- **`GenevieveMilliken/companion_plants`** (named in `DESIGN.md`) — a
  Wikipedia-scraped companion dataset on GitHub. **Check reachability early:** this
  sandbox blocks most external hosts but `raw.githubusercontent.com` worked in
  Stages 1.1/1.2/1.3. If fetchable there, cache it in-repo fetch-once/offline-first
  (mirror `sources/openfarm/`'s `transport.ts`/`cache.ts` split); if blocked,
  document it honestly rather than fabricating relationships.
- **Is this a `SourceAdapter` or curation?** An _ingested external dataset_
  (Wikipedia/OpenFarm companions) fits `packages/etl/src/pipeline/source.ts`'s
  adapter pattern — but that interface resolves _plant names_, not _relationships_,
  so a companion dataset doesn't map onto it cleanly. The evidence-tagging on top
  is curation, like Stage 1.3. Decide the split, document it in the ADR, and don't
  force relationship curation through the name-resolving adapter interface.

## Constraints & gotchas

- **Network access is not guaranteed.** Check reachability before committing to an
  approach; if the Wikipedia dataset is blocked, say so the way `docs/adr/0005`/
  `0006`/`0007` documented their blockers — don't invent a citation you never
  fetched.
- **Don't overstate evidence.** The single most important judgement here is not
  tagging folklore as science. When in doubt, `traditional` with a note is the
  honest call. A human contributor may want to own/spot-check the evidence tags.
- **Toolchain quirks already solved (don't re-discover):** single pinned Vite 6 /
  Vitest 3; Node ≥ 20; ESM (`"type": "module"`); strict TS with
  `verbatimModuleSyntax` (`import type` for type-only imports); the etl `start`
  script runs TS directly via `node --experimental-strip-types`, which needs
  explicit `.ts` extensions on relative imports (`allowImportingTsExtensions` is
  set repo-wide in `tsconfig.base.json`).

## Deliverables

1. The evidence-tagged relationship dataset + per-relationship provenance,
   schema-valid against `PlantLinkSchema`/`ProvenanceSchema`.
2. **Unit tests (Vitest):** every relationship validates; every relationship
   carries an evidence tag; referential integrity holds against the chosen id
   universe (a link to a non-existent id is rejected in a test, not just in code
   you eyeballed); directedness/duplication handled sensibly.
3. **ADR** `docs/adr/0008-*.md`: the dataset shape, the source(s) used and how
   evidence was assigned, the SourceAdapter-vs-curation decision, and the id
   universe chosen. Add it to `docs/adr/README.md`'s index.
4. Update `packages/etl/README.md` and/or `docs/architecture.md` to reflect where
   the companion data lives and how to extend it.

## Definition of done (WORKPLAN §0.3)

`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all green
from the repo root; new code clearly commented (WORKPLAN §0.2); ADR written; docs
updated. Run `/code-review` and `/verify` before finishing. Commit and push.

## Model

**Sonnet** (per WORKPLAN §4) — well-scoped data curation against a settled schema.
The part that rewards care is the evidence calls (science vs folklore); a human
contributor may prefer to own or spot-check those, with the model assisting and
structuring. Escalate to Opus only if you want extra rigour on the evidence
judgements.

## After 1.4

With 1.2 (OpenFarm), 1.3 (spacing), and 1.4 (companions) all producing
schema-shaped data, the next keystone is **Stage 1.5 — dataset build, merge &
validation** (Opus): reconcile everything by GBIF id into the single `/data`
artifact, with the hard-fail validation gate and the conflict-resolution policy
(hand-verified spacing wins over scraped; referential integrity enforced here).
