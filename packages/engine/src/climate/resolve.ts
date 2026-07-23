/**
 * `resolveClimate` — the interface the suitability engine (Stage 2.1) and the
 * plot-definition UI (Stage 3.2) consume to turn "a location" into a
 * {@link ClimateProfile}. Design in `docs/adr/0010-location-climate-static-data.md`.
 *
 * Three ways to specify a location, all resolved **entirely offline**:
 * - no location (or `{ kind: 'default' }`) → {@link UK_DEFAULT_CLIMATE_PROFILE}.
 * - `{ kind: 'region', regionId }` → an exact, known region (e.g. from a UI picker).
 * - `{ kind: 'coordinates', lat, lng }` → the nearest region by straight-line
 *   distance to a small set of representative region centroids.
 *
 * The coordinates path is what makes optional online geocoding a clean,
 * non-breaking future addition (see `geocode.ts`): a geocoder's whole job is
 * turning free text into `{ lat, lng }`, which this module already turns into
 * a climate profile with no network involved. Nothing here ever calls `fetch`.
 */

import type { ClimateProfile, LocationInput } from './schema.ts';
import { ALL_CLIMATE_PROFILES, UK_DEFAULT_CLIMATE_PROFILE } from './regions.ts';

/**
 * A representative point for a region, used only to find the nearest region to
 * a given coordinate — not part of {@link ClimateProfile} itself, because
 * latitude/longitude isn't something the engine or UI needs once a profile has
 * been resolved. Approximate city coordinates (WGS84 degrees), not a citable
 * horticultural fact, so these carry no `SourceRef`.
 */
interface RegionCentroid {
  readonly regionId: string;
  readonly lat: number;
  readonly lng: number;
}

const REGION_CENTROIDS: readonly RegionCentroid[] = [
  // Birmingham — a representative central-England point for the national default.
  { regionId: 'uk-default', lat: 52.4862, lng: -1.8904 },
  // Truro, Cornwall.
  { regionId: 'south-west-england', lat: 50.2632, lng: -5.051 },
  // Leeds, Yorkshire.
  { regionId: 'northern-england', lat: 53.8008, lng: -1.5491 },
  // Inverness.
  { regionId: 'scotland-highlands', lat: 57.4778, lng: -4.2247 },
];

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two WGS84 points, in kilometres (haversine). */
function haversineDistanceKm(a: RegionCentroid, lat: number, lng: number): number {
  const dLat = toRadians(lat - a.lat);
  const dLng = toRadians(lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(lat)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Look up a region by its exact id. `undefined` if the id isn't one this module ships. */
export function findRegionById(regionId: string): ClimateProfile | undefined {
  return ALL_CLIMATE_PROFILES.find((profile) => profile.id === regionId);
}

/**
 * The region whose centroid is nearest to the given coordinates. Always
 * returns a profile — with only a handful of regions covering the whole of
 * the UK (and the default centroid roughly central), every coordinate has a
 * nearest one, even coordinates well outside the UK. This is a coarse,
 * offline-only approximation deliberately traded for simplicity; a location
 * genuinely outside Britain isn't well served by this table at all (out of
 * scope for Stage 1.6 — see the ADR).
 */
function nearestRegion(lat: number, lng: number): ClimateProfile {
  let closest = REGION_CENTROIDS[0];
  let closestDistanceKm = haversineDistanceKm(closest, lat, lng);
  for (const centroid of REGION_CENTROIDS.slice(1)) {
    const distanceKm = haversineDistanceKm(centroid, lat, lng);
    if (distanceKm < closestDistanceKm) {
      closest = centroid;
      closestDistanceKm = distanceKm;
    }
  }
  // `closest.regionId` is always one of REGION_CENTROIDS' own ids, so this is
  // guaranteed to resolve — the `??` only guards the type, not real fallback.
  return findRegionById(closest.regionId) ?? UK_DEFAULT_CLIMATE_PROFILE;
}

/**
 * Resolve a location to its {@link ClimateProfile}. Fully offline and
 * synchronous — no location (or `undefined`) resolves to the UK default,
 * which is exactly the guarantee the Stage 1.6 brief requires.
 *
 * @throws if `{ kind: 'region', regionId }` names a region this module doesn't
 * ship. Region ids are meant to come from a known picker (backed by
 * {@link ALL_CLIMATE_PROFILES}), so an unknown id is a caller bug, not a
 * "location not found" case to degrade gracefully from.
 */
export function resolveClimate(location?: LocationInput): ClimateProfile {
  if (location === undefined || location.kind === 'default') {
    return UK_DEFAULT_CLIMATE_PROFILE;
  }
  if (location.kind === 'region') {
    const profile = findRegionById(location.regionId);
    if (profile === undefined) {
      throw new Error(`resolveClimate: unknown region id "${location.regionId}"`);
    }
    return profile;
  }
  return nearestRegion(location.lat, location.lng);
}
