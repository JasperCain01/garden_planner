# 0003 — Static, client-side architecture

## Status

Accepted (Stage 0.1).

## Context

Two hard requirements shape everything: the app must be **hostable for free on
GitHub Pages** (static files only — no server, no runtime database) and it must
**work offline**. The original design sketch (see `DESIGN.md`) drew a "Backend
API + Postgres", which cannot run on Pages.

## Decision

Collapse the design into a **fully static, client-side** architecture with a
clean build-time / run-time split:

- **Build time** (developer machine, online): `packages/etl` ingests external
  plant sources, normalizes and validates them, and writes a **static dataset
  artifact** to `/data`, which is committed to the repo.
- **Run time** (browser, offline-capable): `app` loads that artifact directly,
  runs the `packages/engine` logic client-side, and caches everything via a
  service worker (Stage 5.1). The deployed app makes **no calls** to PFAF, GBIF,
  or any external service.

The location/climate "service" from the design likewise ships as static data
(UK default), with optional online geocoding as a graceful enhancement.

## Alternatives considered

- **A hosted backend + database** (the original sketch) — impossible on GitHub
  Pages and unnecessary: the dataset is read-only at runtime and small enough to
  bundle.
- **Fetching plant data from third-party APIs at runtime** — would break offline
  use and couple the app to sources that are known to go down (Trefle, OpenFarm).

## Consequences

- The app is trivially hostable and genuinely offline-capable.
- It is insulated from upstream data sources disappearing.
- The dataset is a build artifact: updating plant data means re-running the ETL
  and committing the result, not editing a live database. This is the right
  trade-off for read-only reference data that changes rarely.
- The build-time/run-time boundary is enforced by the `etl` vs `app`/`engine`
  package split, not just by convention.
