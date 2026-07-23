# 0009 — Dataset merge: join-key policy, conflict resolution, and licensing finalization

- **Status:** Accepted
- **Date:** 2026-07-23
- **Workplan stage:** 1.5 (⭐ keystone) — dataset build, merge & validation

## Context

Stage 1.5 is the keystone that reconciles everything Stages 1.2–1.4 produced into
the single static `/data` artifact the app ships:

- **OpenFarm plants** — up to 161 schema-valid `Plant` records from the community
  rescue dump (`sources/openfarm/build-plants.ts`), each keyed by an OpenFarm
  slug, each with `gbifId: null` until the GBIF resolver fills it.
- **The hand-verified spacing table** — 12 thin `SpacingRecord` slices
  (`spacing/table.ts`), each carrying the authoritative, cross-checked spacing
  figures the density calculator depends on.
- **Companion/antagonist relationships** — 86 directed, evidence-tagged edges
  (`companions/`), expanded to `PlantLink`s keyed by the _pre-merge_ id universe
  (the union of spacing ids and OpenFarm-mapped ids, 164 ids).

`WORKPLAN.md` and every prior ADR (0005–0007) describe reconciling records **"by
GBIF id"**. That plan rests on GBIF being reachable to fill `gbifId`. It is not.

### GBIF is unreachable, verified this session

Per ADR 0005's method, reachability was checked directly before assuming
anything: a `curl` to `https://api.gbif.org/v1/species/match` returns **HTTP 403
— a policy denial at the egress proxy** (`connect_rejected` for
`api.gbif.org:443`), and the build's own reachability probe confirms it at run
time. The committed name cache (`cache/gbif-name-cache.json`) is `{}`. So **every
OpenFarm record currently resolves to `gbifId: null`** — there is no GBIF id to
join on for any record, and there is (yet) only one full `Plant` source anyway,
so there is no second overlapping source to reconcile _by_ GBIF id.

This reframes the urgent problem. It is not cross-source species de-duplication;
it is **attaching the Stage 1.3/1.4 slices onto the right OpenFarm plants without
a working GBIF key**, and doing so in a way that _upgrades_ to GBIF-id joins for
free once the block lifts.

### Two facts about the real data that shape the policy

Inspecting the actual records (not assuming) surfaced two things a naive
"join by scientific name" plan would get subtly, expensively wrong:

1. **A scientific name is not unique in OpenFarm.** One binomial routinely covers
   several _distinct crops the app must keep separate_: _Cucurbita pepo_ is
   courgette, acorn squash, spaghetti squash and pattypan; _Beta vulgaris_ is
   beet, golden beet and two chards; _Phaseolus vulgaris_ is green bean and wax
   bean. An unguarded name join would silently collapse crops a user needs to
   place independently.
2. **A scientific name is not consistent across sources.** OpenFarm calls leek
   _Allium porrum_; the spacing table uses the synonym _Allium ampeloprasum_. A
   name join would _miss_ leek, which a slug join catches.

## Decision

### 1. Join-key policy

Records find each other by this priority, encoded in `merge/join.ts`:

1. **GBIF id**, when both sides carry one — the exact, canonical key. Currently
   inert (all `gbifId` are `null`) but kept first so the design **degrades
   gracefully today and upgrades automatically** the moment a contributor runs
   the ETL with GBIF reachable. No code changes then — only a repopulated cache.
2. **Normalized scientific name, uniqueness-guarded** — used to attach a thin
   slice only when exactly one plant bears that binomial. Ambiguous names never
   auto-match (see fact 1); they fall through to a curated alias.
3. **Shared slug id** — the key that does the work today. The spacing table and
   companion data were deliberately authored to share OpenFarm's slug namespace
   (ADR 0007/0008), so 9 of the 12 spacing crops line up by id alone, and the
   leek synonym case (fact 2) resolves correctly.
4. **Curated alias**, verified by scientific name — a tiny explicit table
   (`merge/aliases.ts`: `beetroot`→`beet`, `french-bean`→`green-bean`) for the
   British-name divergences, each checked so a mistyped target fails loudly
   rather than mis-attaching.

**Cross-source unification of two _full_ `Plant` records uses `gbifId` only**
(`unifyPlantsByIdentity`). Scientific name is _not_ a fallback for merging full
records — that is exactly where fact 1 bites hardest (merging PFAF's one
_Cucurbita pepo_ into _which_ of OpenFarm's four?). Name's only safe role is the
uniqueness-guarded slice attach above.

### 2. Conflict resolution: hand-verified spacing wins

Where a spacing row attaches to a plant, its figures **replace** OpenFarm's
scraped row spacing (ADR 0007's Consequences), and its per-method citations
become the plant's `spacing` provenance. Companion/antagonist links are attached
from the Stage 1.4 data; each carries its own evidence tag.

### 3. Referential integrity by construction

Companion links are remapped through the **same** id-unification as spacing
(`canonicalPlantId`): a link authored against `french-bean` is rewritten to
`green-bean` exactly as french-bean's spacing is. A link whose owner or target no
longer resolves to a real plant — or that becomes a self-link after unification —
is **dropped with a stated reason in the merge report**, never left dangling.

### 4. The hard-fail validation gate

`merge/validate.ts` runs three layers over the whole merged set and fails the
build loudly (listing _every_ issue) on any violation: **schema**
(`validatePlant`), **referential integrity** (every link resolves; no self-links),
and **sanity bounds**. It is proven to fail on an intentionally-broken record in
`merge/validate.test.ts` — WORKPLAN.md's verification bar for this stage.

### 5. Dataset-level sanity bounds, recalibrated

The Stage 1.3 sanity check (`spacing/schema.ts`) was tuned for 12 curated
vegetables: a 300 cm ceiling and a "between-row ≥ in-row or it's transposed"
heuristic. Both are wrong for the _shipped_ multi-source set, which includes
fruit trees (star fruit, guava, chestnut at 8–12 m) and OpenFarm's `spread`
figures that legitimately exceed its row spacing for 71 of 161 crops. So the gate
uses a separate, **tree-tolerant, absurdity-only** check (`merge/sanity.ts`, 20 m
ceiling, no transposition heuristic). A record that trips even these loose bounds
(the dump's lone 60 m outlier) is **skipped with a stated reason at collection
time**, never shipped. The strict curation check stays where it belongs.

### 6. Artifact shape

Plain JSON at `/data/plants.json` (`merge/artifact.ts`): a small metadata header
(schema version, generation date, licence, a source roll-up de-duplicated to
`source` + `licence`) followed by the validated, id-sorted plants. Plain JSON is
the right default for a static site — the browser loads it directly, no
WASM/SQLite runtime needed at this size.

### 7. Licensing: hold at CC BY-NC-SA

The dataset ships under **CC BY-NC-SA 4.0**, and `NOTICE` is finalized to list
only the sources actually shipped today, with PFAF/Permapeople/USDA moved to a
"planned, not yet ingested" note.

The honest wrinkle: **nothing currently shipped compels NonCommercial.** The
content is OpenFarm (CC0-1.0) plus original curation (hand-verified spacing facts,
which are not themselves copyrightable; companion links). PFAF — the CC BY-NC-SA
source WORKPLAN.md §0.5 anticipated — is _not_ in the artifact, because it is
still blocked. Today's content alone would permit a more permissive release.

We hold at CC BY-NC-SA anyway, deliberately, because:

- It is the project's already-ratified stance (§0.5), and the project is
  non-commercial by design (`NOTICE`).
- PFAF is the intended primary requirements source (`DESIGN.md` §2); the moment
  its block lifts and it lands, the dataset _must_ be CC BY-NC-SA. Shipping a
  more permissive licence now and tightening later would mean a licence
  flip-flop on already-released data — messier and more confusing than holding
  the eventual target from the start.
- CC BY-NC-SA is a valid, more-restrictive licence for a compilation of CC0
  content (CC0 imposes no downstream terms), so there is no compatibility problem.

## Alternatives considered

- **Auto-join everything by scientific name** (the literal reading of the prior
  plan). Rejected: fact 1 (many crops per binomial) means it silently over-merges
  distinct crops, and fact 2 (synonyms) means it under-merges leek. A wrong join
  here is exactly the expensive-to-unwind keystone error §0.5 warns about.
- **Slug-only join, no scientific-name step at all.** Simpler, and it handles all
  12 crops today. Rejected: it throws away the graceful path for a future
  uniquely-named crop and, more importantly, discards the gbifId upgrade story —
  the policy would have nothing to say when GBIF returns.
- **Ship `broad-bean` by inventing a light value / special-casing OpenFarm's
  unmappable `fava-bean` record.** Rejected: OpenFarm's `fava-bean` has no curated
  category _and_ no in-row spread, so it can't produce a valid `Plant` through the
  normal mapper; forcing one through with a guessed `light` is exactly the
  "never forced through with a guess" discipline every prior stage held. Broad
  bean is left out this round, logged, its spacing preserved in the source table
  for when a real _Vicia faba_ requirements record exists.
- **Relax the gate to warn instead of fail on sanity issues.** Rejected: the gate
  is a hard-fail contract ("no malformed data ever ships"). The right fix for the
  miscalibration was better-calibrated _bounds_, not a softer gate.
- **Ship under a permissive licence now (CC0/CC BY-SA), tighten when PFAF lands.**
  A legitimate reading of "reflect only what's actually shipped". Rejected for the
  flip-flop-on-released-data reason above; recorded here because it is the
  strongest counter-argument and a future maintainer may revisit it if PFAF is
  abandoned.

## Consequences

- **The artifact builds and ships today**, GBIF-blocked, with 160 plants — the
  161 mappable OpenFarm crops minus one 60 m-spacing data error, enriched with 11
  of the 12 hand-verified spacing slices and 91 companion/antagonist links. It
  will gain GBIF ids automatically when the block lifts, with no code change.
- **Known gap: `broad-bean`.** Its hand-verified spacing and its two companion
  links (the `leek`↔`broad-bean` antagonist pair) are not in this artifact,
  because OpenFarm has no mappable _Vicia faba_. This is logged by the build and
  recorded here; it resolves for free when any source supplies broad-bean
  requirement data.
- **`french-bean` unifies into `green-bean`.** The spacing slice and the
  `garlic`↔`french-bean` antagonist both remap; there is no `french-bean` id in
  the final dataset. `beetroot`→`beet` likewise (no companion link referenced
  `beetroot`, so that remap is a no-op for links but still applies to spacing).
- **The build is honest about GBIF.** Every OpenFarm plant carries `gbifId: null`
  and OpenFarm provenance; nothing pretends to a GBIF id it doesn't have.
- **Two sanity checks now exist** (strict curation vs. tree-tolerant dataset).
  A contributor adding a crop must know which applies where; the module docs and
  this ADR say so.
- **Licence is conservative on purpose.** A commercial reuser of _today's_
  artifact is more restricted than the raw sources strictly require. That cost is
  accepted for stability and PFAF-readiness; the reasoning is recorded so the call
  can be revisited deliberately, not by accident.
