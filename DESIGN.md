# Garden / Allotment Planner — Design Overview

An open-source app for planning a garden or allotment. Given a plot size, a
light/shade level, and a geographic location (default: Britain), it helps you
work out which plants will thrive, how many will fit at proper spacing, and how
to arrange them — via a graphical, drag-and-drop interface with simple plant
illustrations and live warnings.

**Scope: edible plants only** (vegetables, herbs, fruit). This is a deliberate
choice, not a limitation to apologise for — it makes the app's headline
features *work reliably* rather than approximately. The reasoning is spelled out
in section 2. Ornamentals are a possible later expansion, noted where relevant.

This document covers three things at a broad-strokes level: **what the app does
and how the pieces fit together**, **whether the underlying plant data exists**,
and **what architecture is needed**. No implementation detail yet.

---

## 1. What the app does

The core loop is: *describe your plot → get suitable plants → arrange them → get
validated feedback.*

1. **Define the plot.** The user enters dimensions (or draws a shape), an
   overall light level (full sun / partial shade / full shade, ideally with
   per-area variation), soil type if known, and a location. Location defaults
   to Britain and drives climate: frost dates, hardiness rating, and season
   timing.
2. **Discover suitable plants.** The app scores every plant in its database
   against the plot's conditions and presents a filtered, ranked palette —
   e.g. "edibles that thrive in a shady, damp British plot."
3. **Plan the layout.** The user drags plants onto a canvas representation of
   the plot. As they place a plant, the app shows how much space it needs and
   computes how many fit (the "how many onions can I fit?" question).
4. **Validate continuously.** The app raises warnings when something won't
   thrive: wrong light level, too closely spaced, wrong season to sow, a known
   antagonist planted nearby, or an incompatible climate. It also *suggests*
   companion plants for what's already placed.
5. **Represent each plant clearly.** Each plant is shown as a simple, consistent
   illustration (see the imagery section) so the plot reads at a glance. For a
   vegetable plot, legibility and identification matter more than photographic
   realism.

### The two calculations that make it useful

- **Spacing / density.** Given a plant's recommended spacing (in-row and
  between-row, or a "plants per m²" figure) and the available area, compute a
  realistic count. This needs to respect the *shape* of the placed region, not
  just total area, and ideally offer square vs. offset (hexagonal) packing.
- **Suitability scoring.** A per-plant score combining light match, hardiness
  vs. the location's climate, soil match, and season. This is what powers both
  the ranked palette (step 2) and the warnings (step 4).

---

## 2. Is there sufficient plant data? (Yes — and the edibles-only scope is why)

This is the make-or-break question, so it's worth being precise. **No single
open source has everything**, but merging a few complementary sources gives full
coverage — and narrowing to edibles turns the *weakest* part of the dataset
(spacing) into one of the strongest. Here's the landscape as it stands.

### Why edibles-only is the right scope

The scope decision is driven almost entirely by **spacing data**, which the
density calculator depends on:

- **Edible spacing is one of the most standardized bodies of horticultural data
  that exists.** Commercial yield pressure means exact spacing is printed on
  every seed packet and codified by the RHS and agricultural extension services.
  The square-foot gardening system already normalized ~60+ common vegetables
  into a clean "N plants per square" table — essentially a ready-made density
  dataset in exactly the shape the calculator wants.
- **The set is small and bounded.** The edibles people actually grow number in
  the low hundreds, so every spacing figure can be hand-verified against two or
  three authoritative charts — a manageable, one-time effort.
- **Ornamentals are the opposite on every count:** tens of thousands of species
  and cultivars, spacing driven by soft "mature spread" numbers rather than a
  yield formula, and no square-foot equivalent to normalize them.

Two of the app's other pillars are also inherently edible-gardening concepts:
**companion planting** is overwhelmingly a vegetable practice, and the whole
"how many onions fit, what grows well beside them" framing is a veg-plot idea.
Edibles-first isn't a compromise — it's the scope where every headline feature
has solid data underneath it. It also aligns with the best data source (PFAF is
edible/useful-plant focused).

### Growing-requirement data (light, soil, hardiness, uses)

| Source | Strengths | Watch-outs |
|---|---|---|
| **Plants For A Future (PFAF)** | ~7,400 **temperate plants that grow in the UK**, edible/useful-plant focused — a direct fit for both the "default Britain" and edibles-only scope. Habitat, shade tolerance, soil, edibility/uses. Downloadable as CSV / Excel / SQLite. | Licensed CC BY-NC-SA — **non-commercial + share-alike + attribution**. |
| **Permapeople** | Active, maintained REST API. Light requirement (sun/part/shade), water needs, growth characteristics. | Permaculture/food focus; check current API terms and rate limits. |
| **OpenFarm** | Open growing guides: seed spacing & depth, watering, sun/shade, companions. Data is CC BY-SA and the dump is still on GitHub. | The **live service has shut down** — treat it as a static seed dataset, not a live API. |
| **Trefle** | Open botanical REST API: min temperature, root depth, fertility. | Historically **unreliable / has gone offline**; there's a self-hostable dump. Don't build on the hosted API as a hard dependency. |
| **USDA PLANTS** | Public domain. Growth habit, native ranges. | US-centric — useful for taxonomy/growth habit, less so for UK season timing. |
| **GBIF taxonomic backbone** | Not requirements data, but the **canonical name resolver** — the key to merging all the above without duplicating "onion" three ways. | Use it as the join key, not a content source. |

**Verdict:** for edibles, growing-requirement data is *comfortably sufficient*.
PFAF covers the British default well; Permapeople + the OpenFarm dump round out
vegetables and give a first pass at spacing; the RHS / square-foot charts supply
authoritative spacing to verify against; GBIF ties them together by scientific
name.

### A note on what "spacing data" actually is

The reason spacing is called out as a gap in general planners is that it isn't a
single number — it depends on the *growing method*:

- **Row growing** gives two numbers: in-row spacing and between-row spacing.
- **Intensive / square-foot / raised-bed** growing ignores rows and gives a
  "plants per square" density, usually much tighter.

Onions are the classic example: ~8 cm on all sides in a bed, but 4 cm in-row ×
30 cm between rows in a traditional plot — same plant, different densities. A
database that stores *one* spacing number is silently choosing a method. The
schema should therefore store spacing **as a method-aware structure** (in-row,
between-row, *and* an intensive per-m²/per-square figure), and the calculator
should let the user pick which growing style they're planning for. For edibles,
all three numbers are well-documented; this is tractable precisely because the
scope is bounded.

### Companion planting data

- A scraped Wikipedia companion-planting dataset exists
  (`GenevieveMilliken/companion_plants`), and OpenFarm guides list companions.
- **Caveat:** companion planting is a mix of solid science (e.g. legumes fixing
  nitrogen, scent-masking pest deterrence) and folklore. The open data reflects
  that. Plan to store companion/antagonist relationships **with an evidence tag**
  (e.g. "well-supported" vs. "traditional") and let the UI signal the
  difference, rather than presenting all pairings as equally authoritative.

### Imagery — solved by using illustrations, not photos

The original plan assumed curated seasonal *photographs*, which is a hard,
open-ended content problem (photos are rarely tagged by growth stage, and much
open imagery is non-commercial-licensed). For a vegetable plot this is
over-engineering: aesthetic realism doesn't matter here — **identification and
legibility do.**

So the approach is **a small library of simple, consistent illustrations / icons**
— one per crop, flat vector art (SVG), a few kilobytes each:

- **Own the assets outright.** Illustrations we create (or commission, or take
  from a permissively-licensed icon set) carry *no* third-party licensing
  strings, which removes the imagery half of the licensing problem entirely and
  keeps the commercial-use door open.
- **Tiny and fast.** SVG icons are a few KB, scale crisply at any zoom on the
  plot canvas, and make an offline PWA trivial — the whole icon set can ship
  with the app rather than streaming from a CDN.
- **Visually coherent.** A single illustration style reads far better on a plan
  than a patchwork of photos shot under different conditions.
- **Bounded effort.** Because the scope is a few hundred edibles, a complete
  icon set is a finite, one-time design task — not the perpetual curation a
  photo library would be.
- **Optional richer detail later.** If seasonal appearance is ever wanted, a
  couple of style variants per crop (seedling / mature / fruiting) is a small
  extension of the same vector approach — still no photo-licensing burden.

This turns "the single biggest content effort" into a bounded, self-owned asset
set, and takes imagery off the licensing-risk list.

### Climate / location data

- To turn "location" into real advice you need frost dates, a hardiness rating,
  and season timing. For Britain, RHS hardiness ratings are the natural
  vocabulary; globally, USDA zones. These can be derived from latitude/longitude
  plus an open climate source (e.g. an open weather/climate API or a Köppen
  classification dataset), with a geocoder mapping place names to coordinates.

### The gaps you will have to fill by hand

Narrowing to edibles and switching to illustrations shrinks this list to two
bounded, one-time tasks:

1. **A normalized, method-aware spacing table** for the few hundred common
   edibles (in-row, between-row, and intensive per-m²). The raw figures are
   well-documented for edibles; the work is verifying and normalizing them into
   one consistent structure — tractable precisely because the set is small.
2. **A simple illustration per crop** (SVG icon set) plus **curation of
   companion data** into an evidence-tagged form.

Everything else can be ingested. The work is *integration and curation*, not
*data acquisition from scratch* — and both remaining tasks are finite because
the scope is bounded.

---

## 3. Architecture (broad strokes)

Five layers, kept deliberately loose at this stage.

```
                 ┌───────────────────────────────────────────┐
                 │            Frontend (web app / PWA)          │
                 │  Plot canvas · drag-drop · plant palette ·  │
                 │  bundled SVG icons · live warnings overlay  │
                 └───────────────────────────────────────────┘
                                    │  (REST/GraphQL)
                 ┌───────────────────────────────────────────┐
                 │                Backend API                  │
                 │  serves plant data · runs the engine        │
                 └───────────────────────────────────────────┘
                    │                          │
      ┌─────────────┘               ┌──────────┘
┌───────────────┐          ┌────────────────┐
│ Suitability & │          │  Location /     │   (SVG icon set ships
│ spacing engine│          │  climate service│    with the frontend —
└───────────────┘          └────────────────┘    no image service needed)
                                    │
                 ┌───────────────────────────────────────────┐
                 │      Curated plant database (Postgres)      │
                 └───────────────────────────────────────────┘
                                    ▲
                 ┌───────────────────────────────────────────┐
                 │  Offline ETL / ingestion pipeline           │
                 │  PFAF · Permapeople · OpenFarm dump · GBIF  │
                 │  + hand-verified spacing table              │
                 │  → normalize → reconcile by scientific name │
                 └───────────────────────────────────────────┘
```

Note the imagery layer has dropped out entirely: because plants are represented
by a small bundled SVG icon set, there's **no image service, CDN, or attribution
pipeline** to build — one fewer moving part than the original design.

- **Curated plant database.** The heart of the project. One normalized schema
  (light, method-aware spacing, hardiness, soil, season, edible category,
  companion/antagonist links, icon reference) populated from the sources above.
  Scientific name (via GBIF) is the join key. This is a *build-time* asset — it
  doesn't need to hit third-party APIs at runtime.
- **Offline ETL pipeline.** Separate from the running app: pulls each source,
  maps it into the schema, reconciles duplicates, flags conflicts for review.
  Runs periodically, not per-request — this is what insulates the app from
  Trefle/OpenFarm being unreliable.
- **Backend API.** Serves plant data and hosts the engine. Thin; most
  intelligence is in the engine and the data.
- **Suitability & spacing engine.** Pure logic: score a plant against a plot,
  compute counts from spacing and area/shape, generate warnings, suggest
  companions. Kept as an isolated, well-tested module because it's the app's
  "brain" and the part most worth getting right.
- **Location / climate service.** Geocodes a place, returns frost dates,
  hardiness rating, and season timing. Britain is the default profile.
- **Icon set (not a service).** A small library of SVG crop illustrations
  bundled with the frontend. No runtime service — just static assets, a few KB
  each, that ship with the app and work offline.
- **Frontend.** A canvas-based plot designer (drag-and-drop, per-area light
  zones, live warnings), backed by the API. A good candidate for a PWA so it
  works offline in a garden with no signal — the bundled icon set makes full
  offline use straightforward.

### Suggested build order

1. **Data first.** Stand up the schema + ETL and get a clean merged dataset for
   a starter set of common British edibles, including the hand-verified
   method-aware spacing table. Nothing else works without this.
2. **Engine.** Suitability scoring + spacing math, tested against that dataset,
   exposed through a minimal API.
3. **Frontend MVP.** Define-plot → ranked palette → drag-drop → warnings, using
   simple placeholder icons.
4. **Icon set + companions.** Finalize the SVG crop illustrations and layer in
   evidence-tagged companion data.
5. **Location depth.** Move from a single British default to full geocoding and
   climate-driven season timing.

### Licensing note (decide early)

Switching to self-owned illustrations removes the imagery half of the licensing
question — the icons carry no third-party strings. What remains is the **plant
data**: PFAF is CC BY-NC-SA (**non-commercial + share-alike + attribution**), so
if the shipped dataset includes PFAF-derived content, the dataset inherits those
terms. Two clean options:

- **Non-commercial, share-alike** (simplest): use PFAF freely, license the app
  and dataset to match. Fine for an open, community project.
- **Commercial-friendly**: restrict the ingested *facts* to permissively-licensed
  or public-domain sources (USDA is public domain; individual growing facts like
  spacing numbers generally aren't copyrightable, though a compiled database can
  be) and keep PFAF out of the redistributed data. More work, keeps options open.

Either way, this is now the *only* licensing decision that touches source
selection — worth settling before the ETL work begins.

---

## Open questions to resolve next

- Commercial vs. non-commercial licensing of the *dataset* (the only remaining
  source-selection constraint now imagery is self-owned).
- Depth of the "light level" model: one value per plot, or per-area shade
  mapping (the latter is much more powerful but more UI work).
- Which growing method(s) to support in the spacing calculator — row, intensive,
  or let the user toggle (recommended).
- How opinionated to be about companion planting given the mixed evidence base.
- Web-only, or PWA/native for offline use in the garden.
- Illustration sourcing: commission a custom set, or adapt a permissively-licensed
  icon library as a starting point.

---

### Sources consulted

- [Plants For A Future (PFAF)](https://pfaf.org/) and its
  [database downloads](https://pfaf.org/user/cmspage.aspx?pageid=126)
- [Permapeople API](https://permapeople.org/knowledgebase/api-docs/)
- [OpenFarm](https://github.com/openfarmcc/OpenFarm)
- [Trefle plants API](https://trefle.io/)
- [USDA PLANTS Database](https://data.nal.usda.gov/dataset/usda-plants-database-api-r)
- [Companion planting dataset](https://github.com/GenevieveMilliken/companion_plants)
- Square-foot gardening spacing charts (e.g. the ~60-plant reference tables) and
  RHS / agricultural-extension spacing guides, for the verified spacing table
