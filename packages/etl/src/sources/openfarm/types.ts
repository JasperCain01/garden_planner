/**
 * The raw shape of one record in `cache/openfarm-crops.json` (Workplan Stage
 * 1.2 — see `docs/adr/0006-openfarm-source-adapter.md`).
 *
 * This is **not** the OpenFarm API's own JSON shape — OpenFarm's live API was
 * shut down before this project could use it (see the ADR). It's the shape
 * produced by `thefullnacho/openfarm-crops-rescue`, a community project that
 * rebuilt structured records from Wayback Machine captures of
 * `openfarm.cc/en/crops/*` after the shutdown. Every record carries a
 * `source` block recording exactly which archived page it came from.
 */

/** Where one rescued record was recovered from, for per-record provenance. */
export interface OpenFarmCropSource {
  readonly origin: string;
  readonly license: string;
  readonly waybackUrl: string;
  /** Wayback capture date as `YYYYMMDD` (the rescue project's own format). */
  readonly captured: string;
}

/**
 * One crop record as rescued. Field coverage is patchy — not every archived
 * page had every field (see the rescue project's README) — so everything but
 * `slug`/`name`/`source` is optional here, exactly mirroring the source data
 * rather than pretending it's more complete than it is.
 */
export interface OpenFarmCropRaw {
  readonly slug: string;
  readonly name: string;
  readonly binomialName?: string;
  readonly taxon?: string;
  readonly description?: string;
  readonly sun?: string;
  readonly sowingMethod?: string;
  readonly spreadCm?: number;
  readonly rowSpacingCm?: number;
  readonly heightCm?: number;
  readonly companions?: readonly string[];
  readonly tags?: readonly string[];
  readonly growingDegreeDays?: number;
  readonly source: OpenFarmCropSource;
}

/**
 * Check that a parsed JSON value actually looks like an `OpenFarmCropRaw[]`
 * before trusting it, the same discipline `gbif-transport.ts`'s
 * `assertGbifMatchResponse` applies to GBIF responses. This data is external
 * (fetched over the network, or read from a committed file someone could hand-
 * edit), so a shape surprise should throw — a loud, retryable failure — rather
 * than silently propagate a malformed record into the mapper.
 */
export function assertOpenFarmCropArray(value: unknown): OpenFarmCropRaw[] {
  if (!Array.isArray(value)) {
    throw new Error('OpenFarm crop dump: expected a JSON array at the top level');
  }
  return value.map((entry, index) => assertOpenFarmCrop(entry, index));
}

function assertOpenFarmCrop(value: unknown, index: number): OpenFarmCropRaw {
  const isStringOrUndefined = (v: unknown): v is string | undefined =>
    v === undefined || typeof v === 'string';
  const isNumberOrUndefined = (v: unknown): v is number | undefined =>
    v === undefined || typeof v === 'number';
  const isStringArrayOrUndefined = (v: unknown): v is string[] | undefined =>
    v === undefined || (Array.isArray(v) && v.every((item) => typeof item === 'string'));

  if (typeof value !== 'object' || value === null) {
    throw new Error(`OpenFarm crop dump: entry ${index} is not an object`);
  }
  const record = value as Record<string, unknown>;
  const source = record.source;
  const sourceIsValid =
    typeof source === 'object' &&
    source !== null &&
    typeof (source as Record<string, unknown>).origin === 'string' &&
    typeof (source as Record<string, unknown>).license === 'string' &&
    typeof (source as Record<string, unknown>).waybackUrl === 'string' &&
    typeof (source as Record<string, unknown>).captured === 'string';

  const shapeIsValid =
    typeof record.slug === 'string' &&
    typeof record.name === 'string' &&
    isStringOrUndefined(record.binomialName) &&
    isStringOrUndefined(record.taxon) &&
    isStringOrUndefined(record.description) &&
    isStringOrUndefined(record.sun) &&
    isStringOrUndefined(record.sowingMethod) &&
    isNumberOrUndefined(record.spreadCm) &&
    isNumberOrUndefined(record.rowSpacingCm) &&
    isNumberOrUndefined(record.heightCm) &&
    isStringArrayOrUndefined(record.companions) &&
    isStringArrayOrUndefined(record.tags) &&
    isNumberOrUndefined(record.growingDegreeDays) &&
    sourceIsValid;

  if (!shapeIsValid) {
    throw new Error(`OpenFarm crop dump: entry ${index} has an unexpected shape`);
  }
  return record as unknown as OpenFarmCropRaw;
}
