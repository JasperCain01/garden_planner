# 0023 — Relicense the dataset to CC0-1.0

- **Status:** Accepted
- **Date:** 2026-07-26
- **Supersedes:** the licensing section of
  [ADR 0009](./0009-dataset-merge-and-licensing.md) (its join-key and
  conflict-resolution decisions stand unchanged)
- **Workplan stage:** follows Stage 6.0's rescoping

## Context

The shipped dataset (`data/plants.json`) has been licensed **CC BY-NC-SA 4.0**
since Stage 1.5. ADR 0009 was explicit that this was **not** compelled by the
content — it was chosen to absorb Plants For A Future, whose CC BY-NC-SA terms
would have propagated, without a later licence flip-flop. `NOTICE` said the
same in plain terms:

> The sources actually shipped in the current artifact do NOT by themselves
> compel NonCommercial … So today's content alone could ship under a more
> permissive licence.

Two things have since changed.

**PFAF is no longer planned.** Stage 6.0 was rewritten to fill the dataset's
gaps by curation rather than by ingesting another source, after measuring what
a PFAF adapter would actually cost: only 95 of 162 records join uniquely by
scientific name, 67 sit in ambiguous species groups (_Brassica oleracea_ alone
covers 11 crops), and PFAF's species-level rows could not honestly supply
cultivar-level season data. The ingest that CC BY-NC-SA was reserving space for
is not going to happen.

**The project's scope was stated plainly.** It is a personal, non-commercial
hobby planner for a residential garden or allotment, not a commercial product
or an authority. A restrictive licence protects nothing here; it only makes the
work less useful to anyone who finds it.

So the anticipatory restriction had nothing left to anticipate, and the reason
ADR 0009 gave for keeping it — avoiding a flip-flop — now argues the other way.

## Decision

**The dataset is dedicated to the public domain under
[CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/).**

`DATASET_LICENSE` / `DATASET_LICENSE_URL` in
`packages/etl/src/merge/artifact.ts` are the single source of truth; the
artifact carries them in its header, and a test pins the literal value rather
than comparing the constant to itself.

### Why CC0 is available, input by input

| Input                                   | Status                                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenFarm crops rescue                   | **CC0-1.0.** ADR 0006 verified this against the rescue repository and corrected `DESIGN.md`'s earlier CC BY-SA guess, which predated the check. |
| Hand-verified spacing table (Stage 1.3) | Individual growing facts, which are not copyrightable; the selection and arrangement are this project's own.                                    |
| Companion/antagonist links (Stage 1.4)  | Hand-curated by this project, plus OpenFarm-derived edges (CC0 as above).                                                                       |
| Curated plants (Stage 1.7)              | Hand-authored by this project.                                                                                                                  |
| Curated moisture table                  | Hand-authored by this project.                                                                                                                  |

Nothing in the artifact carries an obligation the project would be waiving on
someone else's behalf.

### Attribution survives the licence change

CC0 removes attribution as a _condition_. It does not remove it from the data:

- every record keeps its `provenance.sources`, per-field where it matters;
- `NOTICE` still credits every source by name and URL;
- the hand-verified spacing table still cites RHS, the Old Farmer's Almanac and
  the Square Foot Gardening charts per figure.

That record exists so a reader can check where a number came from and a
maintainer can re-verify it. Its value was never that a licence compelled it.

### Code stays MIT

Deliberately unchanged. MIT is already about as permissive as a code licence
sensibly gets, and unlike CC0 it carries an explicit warranty disclaimer — which
matters more for software that runs than for facts that sit in a file. "As open
as possible" is a reason to relax the _dataset_, not a reason to drop a
disclaimer from the code.

## Alternatives considered

- **CC BY 4.0** — open, but keeps attribution as a legal condition. Rejected:
  attribution is already recorded richly in the data itself, and making it a
  condition adds a compliance burden for a reuser without adding anything for
  this project. CC0 with thorough provenance is more useful than CC BY with the
  same provenance.
- **ODbL / CC BY-SA** — share-alike. Rejected for the same reason the
  NonCommercial clause is being dropped: nothing in the inputs compels it, and
  copyleft on a hobby dataset protects nothing anyone is trying to take.
- **Keep CC BY-NC-SA in case PFAF is ever ingested.** Rejected: that is the
  argument ADR 0009 made, and it has expired. If a future stage does ingest a
  share-alike source, the honest move then is to relicense the affected build —
  not to restrict every user in the meantime against a possibility that has
  since been ruled out.

## Consequences

- `data/plants.json`'s `license` / `licenseUrl` fields change to `CC0-1.0` and
  its URL. Anyone reading the artifact programmatically sees the new terms.
- `NOTICE`'s DATASET section is rewritten: sources are now credited as
  provenance rather than as licence compliance, and the "planned but not yet
  ingested" PFAF entry is removed, since it is no longer planned.
- `README.md`, `data/README.md`, `WORKPLAN.md` §0.5 and `DESIGN.md`'s licensing
  note are updated to match. `DESIGN.md`'s open question "commercial vs
  non-commercial licensing of the dataset" is now answered.
- Two code comments referencing the CC BY-NC-SA obligation
  (`schema/plant.ts`'s `SourceRef`, `schema/user-plant.ts`) are corrected —
  provenance is still required of shipped data, but for traceability rather
  than licence compliance.
- **The `provenance` requirement on shipped records does not relax.** It was
  never only a licence mechanism: it is what makes a horticultural claim
  checkable, and ADR 0011's guarantee that user-entered crops can't launder
  themselves into the shipped dataset still rests on it.
