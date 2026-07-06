# Garden / Allotment Planner — Design Overview

An open-source app for planning a garden or allotment. Given a plot size, a
light/shade level, and a geographic location (default: Britain), it helps you
work out which plants will thrive, how many will fit at proper spacing, and how
to arrange them — via a graphical, drag-and-drop interface with seasonal plant
imagery and live warnings. It targets both ornamental and vegetable gardens.

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
   e.g. "plants that thrive in a shady, damp British plot." Vegetables and
   ornamentals are both first-class.
3. **Plan the layout.** The user drags plants onto a canvas representation of
   the plot. As they place a plant, the app shows how much space it needs and
   computes how many fit (the "how many onions can I fit?" question).
4. **Validate continuously.** The app raises warnings when something won't
   thrive: wrong light level, too closely spaced, wrong season to sow, a known
   antagonist planted nearby, or an incompatible climate. It also *suggests*
   companion plants for what's already placed.
5. **Show it in season.** Each plant carries imagery of how it looks at its
   seasonal peak, so the plan reads as a picture of the finished garden rather
   than an abstract grid.

### The two calculations that make it useful

- **Spacing / density.** Given a plant's recommended spacing (in-row and
  between-row, or a "plants per m²" figure) and the available area, compute a
  realistic count. This needs to respect the *shape* of the placed region, not
  just total area, and ideally offer square vs. offset (hexagonal) packing.
- **Suitability scoring.** A per-plant score combining light match, hardiness
  vs. the location's climate, soil match, and season. This is what powers both
  the ranked palette (step 2) and the warnings (step 4).

---

## 2. Is there sufficient plant data? (Yes — but assembled, not bought)

This is the make-or-break question, so it's worth being precise. **No single
open source has everything.** The viable path is to merge a few complementary
sources into one curated, normalized database, and to hand-fill the specific
gaps that matter for this app. Here's the landscape as it stands.

### Growing-requirement data (light, soil, hardiness, uses)

| Source | Strengths | Watch-outs |
|---|---|---|
| **Plants For A Future (PFAF)** | ~7,400 **temperate plants that grow in the UK** — ideal for the "default Britain" focus. Habitat, shade tolerance, soil, edibility/uses. Downloadable as CSV / Excel / SQLite. | Licensed CC BY-NC-SA — **non-commercial + share-alike + attribution**. Edible/useful-plant bias (lighter on pure ornamentals). |
| **Permapeople** | Active, maintained REST API. Light requirement (sun/part/shade), water needs, growth characteristics. | Permaculture/food focus; check current API terms and rate limits. |
| **OpenFarm** | Open growing guides: seed spacing & depth, watering, sun/shade, companions. Data is CC BY-SA and the dump is still on GitHub. | The **live service has shut down** — treat it as a static seed dataset, not a live API. |
| **Trefle** | Open botanical REST API: min temperature, root depth, fertility. | Historically **unreliable / has gone offline**; there's a self-hostable dump. Don't build on the hosted API as a hard dependency. |
| **USDA PLANTS** | Public domain. Growth habit, native ranges. | US-centric — useful for taxonomy/growth habit, less so for UK season timing. |
| **GBIF taxonomic backbone** | Not requirements data, but the **canonical name resolver** — the key to merging all the above without duplicating "onion" three ways. | Use it as the join key, not a content source. |

**Verdict:** growing-requirement data is *sufficient*. PFAF alone covers the
British default well; Permapeople + the OpenFarm dump round out vegetables and
spacing; GBIF ties them together by scientific name.

### Companion planting data

- A scraped Wikipedia companion-planting dataset exists
  (`GenevieveMilliken/companion_plants`), and OpenFarm guides list companions.
- **Caveat:** companion planting is a mix of solid science (e.g. legumes fixing
  nitrogen, scent-masking pest deterrence) and folklore. The open data reflects
  that. Plan to store companion/antagonist relationships **with an evidence tag**
  (e.g. "well-supported" vs. "traditional") and let the UI signal the
  difference, rather than presenting all pairings as equally authoritative.

### Imagery — the real gap

- **Openly-licensed plant photos exist in volume**: the iNaturalist Open Dataset
  (on AWS S3, CC0 / CC-BY / CC-BY-NC) and Wikimedia Commons, keyed by scientific
  name.
- **But "what it looks like in season" is not a solved dataset.** Photos are
  rarely tagged by growth stage or month. Delivering the seasonal-appearance
  feature means **curating** a representative image per plant (and ideally per
  season/stage) rather than pulling one automatically. This is the single
  biggest content effort in the project.
- **Licensing matters for imagery too:** much iNaturalist content is CC-BY-**NC**
  (non-commercial). Combined with PFAF's NC license, this pushes the whole
  project toward a **non-commercial, share-alike posture** unless you
  deliberately restrict yourself to CC0/CC-BY sources.

### Climate / location data

- To turn "location" into real advice you need frost dates, a hardiness rating,
  and season timing. For Britain, RHS hardiness ratings are the natural
  vocabulary; globally, USDA zones. These can be derived from latitude/longitude
  plus an open climate source (e.g. an open weather/climate API or a Köppen
  classification dataset), with a geocoder mapping place names to coordinates.

### The gaps you will have to fill by hand

1. **Consistent spacing figures** for every plant (cm in-row / between-row, or
   plants per m²). This exists but is patchy and inconsistent across sources —
   and it's exactly the number the density calculator depends on. Expect to
   compile and normalize a spacing table.
2. **Seasonal imagery** (above).
3. **Curation of companion data** into an evidence-tagged form.

Everything else can be ingested. The work is *integration and curation*, not
*data acquisition from scratch*.

---

## 3. Architecture (broad strokes)

Five layers, kept deliberately loose at this stage.

```
                 ┌───────────────────────────────────────────┐
                 │            Frontend (web app)               │
                 │  Plot canvas · drag-drop · plant palette ·  │
                 │  seasonal images · live warnings overlay    │
                 └───────────────────────────────────────────┘
                                    │  (REST/GraphQL)
                 ┌───────────────────────────────────────────┐
                 │                Backend API                  │
                 │  serves plant data · runs the engine        │
                 └───────────────────────────────────────────┘
                    │                │                │
      ┌─────────────┘     ┌──────────┘      ┌─────────┘
┌───────────────┐  ┌────────────────┐  ┌───────────────────┐
│ Suitability & │  │  Location /     │  │  Image service    │
│ spacing engine│  │  climate service│  │ (CDN + attribution)│
└───────────────┘  └────────────────┘  └───────────────────┘
                                    │
                 ┌───────────────────────────────────────────┐
                 │      Curated plant database (Postgres)      │
                 └───────────────────────────────────────────┘
                                    ▲
                 ┌───────────────────────────────────────────┐
                 │  Offline ETL / ingestion pipeline           │
                 │  PFAF · Permapeople · OpenFarm dump · GBIF  │
                 │  → normalize → reconcile by scientific name │
                 └───────────────────────────────────────────┘
```

- **Curated plant database.** The heart of the project. One normalized schema
  (light, spacing, hardiness, soil, season, edible/ornamental type,
  companion/antagonist links, image references) populated from the sources
  above. Scientific name (via GBIF) is the join key. This is a *build-time*
  asset — it doesn't need to hit third-party APIs at runtime.
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
- **Image service.** Serves curated seasonal imagery from a CDN, carrying the
  attribution/license metadata each open source requires.
- **Frontend.** A canvas-based plot designer (drag-and-drop, per-area light
  zones, live warnings), backed by the API. A good candidate for a PWA so it
  works offline in a garden with no signal.

### Suggested build order

1. **Data first.** Stand up the schema + ETL and get a clean merged dataset for
   a starter set of common British vegetables and ornamentals. Nothing else
   works without this.
2. **Engine.** Suitability scoring + spacing math, tested against that dataset,
   exposed through a minimal API.
3. **Frontend MVP.** Define-plot → ranked palette → drag-drop → warnings, with
   placeholder images.
4. **Seasonal imagery + companions.** The curation-heavy content layers, added
   once the mechanics work.
5. **Location depth.** Move from a single British default to full geocoding and
   climate-driven season timing.

### Licensing note (decide early)

Because PFAF (CC BY-NC-SA) and much iNaturalist imagery (CC-BY-NC) are
**non-commercial + share-alike**, the simplest path is to license the app and
its dataset as **non-commercial, share-alike, with attribution**. If commercial
use is ever a goal, you'd need to restrict sources to CC0/CC-BY and rebuild the
spacing/imagery layers accordingly. This choice shapes what data you're allowed
to ingest, so it's worth settling before the ETL work begins.

---

## Open questions to resolve next

- Commercial vs. non-commercial licensing (drives everything above).
- Depth of the "light level" model: one value per plot, or per-area shade
  mapping (the latter is much more powerful but more UI work).
- How opinionated to be about companion planting given the mixed evidence base.
- Web-only, or PWA/native for offline use in the garden.

---

### Sources consulted

- [Plants For A Future (PFAF)](https://pfaf.org/) and its
  [database downloads](https://pfaf.org/user/cmspage.aspx?pageid=126)
- [Permapeople API](https://permapeople.org/knowledgebase/api-docs/)
- [OpenFarm](https://github.com/openfarmcc/OpenFarm)
- [Trefle plants API](https://trefle.io/)
- [USDA PLANTS Database](https://data.nal.usda.gov/dataset/usda-plants-database-api-r)
- [Companion planting dataset](https://github.com/GenevieveMilliken/companion_plants)
- [iNaturalist Open Dataset](https://registry.opendata.aws/inaturalist-open-data/)
  and [Wikimedia Commons / iNaturalist](https://commons.wikimedia.org/wiki/Commons:INaturalist)
