/**
 * Optional online geocoding — **deferred** in Stage 1.6 (see the "build vs.
 * defer" decision in `docs/adr/0010-location-climate-static-data.md`).
 *
 * `WORKPLAN.md` §0.1 and the Stage 1.6 brief both call this a *progressive
 * enhancement*: turning a free-text place name into coordinates so a user can
 * type "Leeds" instead of picking a region from a list. It is explicitly
 * optional, and the brief permits deferring it as long as the resolver
 * interface is ready for it. It is deferred here because:
 *
 * - The offline core (a UK default plus a small region set, resolved via
 *   {@link resolveClimate}) is the mandatory deliverable, and must not depend
 *   on a network call — building a half-verified geocoder alongside it adds
 *   risk to that guarantee for no required benefit this stage.
 * - Any real geocoding API (Nominatim, an OS Places API, etc.) is unreachable
 *   from this sandbox (the same egress block documented in `regions.ts`), so
 *   its response shape could not be verified against a live call here — unlike
 *   the GBIF resolver (`packages/etl/src/resolve/gbif-transport.ts`), which at
 *   least had prior-session network access to shape its parser against.
 *
 * **What's ready for the future.** {@link resolveClimate} in `resolve.ts`
 * already accepts a `{ kind: 'coordinates', lat, lng }` location — a
 * geocoder's *entire* job is producing that pair from a place name. So a
 * future stage can add a real `GeocodeTransport` implementation and a thin
 * `geocodeLocation()` wrapper without changing `resolveClimate`'s signature or
 * any existing caller: geocode the text, feed the result into the same
 * offline coordinate-resolution path already built and tested here. The
 * `GbifTransport` pattern (injectable transport, stub in tests, real `fetch`
 * implementation in production) is the template to follow, so unit tests
 * still never touch the network.
 */

/** A geographic coordinate pair, WGS84 degrees. */
export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

/**
 * The network boundary a future geocoder implementation would sit behind,
 * mirroring `GbifTransport`'s injectable-transport shape so tests can stub it
 * instead of hitting a real network. **Not implemented in Stage 1.6** — this
 * interface exists so the extension point is typed and documented ahead of
 * time, per the brief's "define the resolver interface so geocoding can slot
 * in later" instruction.
 */
export interface GeocodeTransport {
  /** Resolve a free-text place name to coordinates, or `null` if none was found. */
  geocode(query: string): Promise<Coordinates | null>;
}
