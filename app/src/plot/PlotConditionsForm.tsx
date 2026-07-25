/**
 * The light/soil/location/planting-month form (Workplan Stage 3.2): assembles
 * a `PlotConditionsInput` — the shape `resolvePlotConditions`
 * (`@garden-planner/engine`) turns into the `PlotConditions` the suitability
 * engine, spacing calculator, and warnings engine all consume.
 *
 * Fully controlled: the plot store (`state/plot-store.ts`) owns the value,
 * this component only renders it and reports edits via `onChange`. Online
 * geocoding is deferred (ADR 0010), so location is a choice between the UK
 * default and a `CLIMATE_REGIONS` entry — no free-text place search.
 *
 * **Soil stays all-or-nothing per `PlotSoilSchema`'s rule, but each facet is
 * independently optional.** Every soil `<select>` has a "not sure" option
 * that clears just that one facet; when clearing a facet leaves none of the
 * three set, the whole `soil` key is dropped from the value (rather than
 * submitted as `{}`, which the schema rejects) — "unknown" is the absence of
 * the block, not an empty one.
 */

import type {
  PlotConditionsInput,
  PlotSoil,
  SoilMoisture,
  SoilPh,
  SoilTexture,
} from '@garden-planner/engine';
import {
  CLIMATE_REGIONS,
  LIGHT_REQUIREMENTS,
  resolvePlotConditions,
  SoilMoistureSchema,
  SoilPhSchema,
  SoilTextureSchema,
} from '@garden-planner/engine';

const SOIL_TEXTURES = SoilTextureSchema.options;
const SOIL_PHS = SoilPhSchema.options;
const SOIL_MOISTURES = SoilMoistureSchema.options;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface PlotConditionsFormProps {
  readonly value: PlotConditionsInput;
  readonly onChange: (value: PlotConditionsInput) => void;
}

export function PlotConditionsForm({ value, onChange }: PlotConditionsFormProps) {
  function updateSoilFacet<K extends keyof PlotSoil>(
    facet: K,
    next: PlotSoil[K] | undefined,
  ): void {
    const soil: PlotSoil = { ...value.soil, [facet]: next };
    const hasAnyFacet =
      soil.texture !== undefined || soil.ph !== undefined || soil.moisture !== undefined;
    onChange({ ...value, soil: hasAnyFacet ? soil : undefined });
  }

  const locationKind = value.location?.kind ?? 'default';
  const selectedRegionId =
    value.location?.kind === 'region' ? value.location.regionId : CLIMATE_REGIONS[0].id;

  let resolution: { ok: true } | { ok: false; message: string };
  try {
    resolvePlotConditions(value);
    resolution = { ok: true };
  } catch (thrown) {
    resolution = {
      ok: false,
      message: thrown instanceof Error ? thrown.message : 'invalid plot conditions',
    };
  }

  return (
    <fieldset>
      <legend>Growing conditions</legend>

      <div>
        <label htmlFor="plot-light">Light level</label>
        <select
          id="plot-light"
          value={value.light}
          onChange={(event) =>
            onChange({ ...value, light: event.target.value as PlotConditionsInput['light'] })
          }
        >
          {LIGHT_REQUIREMENTS.map((option) => (
            <option key={option} value={option}>
              {option.replace('-', ' ')}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend>Soil (optional — leave a facet as "not sure" if unknown)</legend>
        <div>
          <label htmlFor="plot-soil-texture">Soil texture</label>
          <select
            id="plot-soil-texture"
            value={value.soil?.texture ?? ''}
            onChange={(event) =>
              updateSoilFacet(
                'texture',
                event.target.value === '' ? undefined : (event.target.value as SoilTexture),
              )
            }
          >
            <option value="">Not sure</option>
            {SOIL_TEXTURES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="plot-soil-ph">Soil pH</label>
          <select
            id="plot-soil-ph"
            value={value.soil?.ph ?? ''}
            onChange={(event) =>
              updateSoilFacet(
                'ph',
                event.target.value === '' ? undefined : (event.target.value as SoilPh),
              )
            }
          >
            <option value="">Not sure</option>
            {SOIL_PHS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="plot-soil-moisture">Soil moisture</label>
          <select
            id="plot-soil-moisture"
            value={value.soil?.moisture ?? ''}
            onChange={(event) =>
              updateSoilFacet(
                'moisture',
                event.target.value === '' ? undefined : (event.target.value as SoilMoisture),
              )
            }
          >
            <option value="">Not sure</option>
            {SOIL_MOISTURES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset>
        <legend>Location</legend>
        <label>
          <input
            type="radio"
            name="plot-location-kind"
            value="default"
            checked={locationKind === 'default'}
            onChange={() => onChange({ ...value, location: undefined })}
          />
          Use the UK default
        </label>
        <label>
          <input
            type="radio"
            name="plot-location-kind"
            value="region"
            checked={locationKind === 'region'}
            onChange={() =>
              onChange({ ...value, location: { kind: 'region', regionId: selectedRegionId } })
            }
          />
          Pick a region
        </label>
        {locationKind === 'region' && (
          <div>
            <label htmlFor="plot-region">Region</label>
            <select
              id="plot-region"
              value={selectedRegionId}
              onChange={(event) =>
                onChange({ ...value, location: { kind: 'region', regionId: event.target.value } })
              }
            >
              {CLIMATE_REGIONS.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor="plot-planting-month">Planting month (optional)</label>
        <select
          id="plot-planting-month"
          value={value.plantingMonth ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              plantingMonth:
                event.target.value === ''
                  ? undefined
                  : (Number(event.target.value) as PlotConditionsInput['plantingMonth']),
            })
          }
        >
          <option value="">Not set</option>
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {!resolution.ok && <p role="alert">{resolution.message}</p>}
    </fieldset>
  );
}
