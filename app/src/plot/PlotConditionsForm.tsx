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
 * independently optional.** Every soil control has a "not sure" choice that
 * clears just that one facet; when clearing a facet leaves none of the three
 * set, the whole `soil` key is dropped from the value (rather than submitted as
 * `{}`, which the schema rejects) — "unknown" is the absence of the block, not
 * an empty one.
 *
 * ## What UI redesign Phase 4 changed, and why (ADR 0033 §4)
 *
 * The form was **635px of an 844px column** — the single biggest spender in the
 * settings panel, and the reason the warnings it produces were 263px below the
 * fold. Three changes, each with a reason beyond "smaller":
 *
 * 1. **Short vocabularies became segmented controls.** Light, pH and moisture
 *    are three options each; a `<select>` hides two of the three behind a click
 *    for no benefit, and "what are my options?" is the actual question a
 *    gardener has here. `ui/SegmentedControl.tsx` shows all of them and costs
 *    the same one tab stop a `<select>` did. Soil **texture** keeps its
 *    `<select>`: five options don't fit a 300px row, and the review's rule is
 *    ≤4.
 * 2. **Soil moved behind a "Describe your soil (optional)" disclosure.** Three
 *    facets of a block most users leave as "not sure" (the engine scores fine
 *    without it) were the largest thing on screen. Closed, they cost one line.
 *    This is the change with a real cost — see the note on tests below.
 * 3. **Location became one `<select>`.** Two radios plus a conditional region
 *    `<select>` expressed a choice with exactly one interesting branch: the
 *    UK default is simply the first option now, and picking any other region
 *    *is* choosing a region. One control instead of three, and one fewer state
 *    to be in.
 *
 * **The fieldsets: three nested became four flat, and that is the flattening.**
 * The review says "flatten the fieldset nesting to labelled groups on one
 * card", which is what happened — not "delete the fieldsets", which would drop
 * grouping a screen reader announces:
 *
 * - The old **Soil** and **Location** fieldsets are gone, each for its own
 *   reason. Soil's group name was recoverable from its own members ("Soil
 *   texture", "Soil pH", "Soil moisture" each say it), and the disclosure's
 *   summary now carries the visual grouping; Location collapsed to a single
 *   control, and one control is not a group. This is the same test Phase 1
 *   applied when it deleted the outermost fieldset: keep the group only where
 *   its name is not already being said.
 * - Each **segmented control is a new flat fieldset** whose visible `<legend>`
 *   is the field's label — a radio group carries its name there the way a
 *   `<select>` carries it in a `<label>`. Three of those, plus the shape
 *   picker's, so the page's fieldset count went 3 → 4 while its *nesting* went
 *   to zero.
 *
 * **A closed `<details>` is not a hidden field to jsdom.** `getByLabelText`
 * finds the soil controls whether the disclosure is open or shut, so a
 * component test can drive a control no browser user can reach.
 * `PlotConditionsForm.test.tsx` and `PlotDefinitionPage.test.tsx` therefore
 * open the disclosure first, and `e2e/plot-settings.spec.ts` asserts in a real
 * browser that the control is *not* visible until they do.
 */

import type { PlotConditionsInput, PlotSoil, SoilTexture } from '@garden-planner/engine';
import {
  CLIMATE_REGIONS,
  LIGHT_REQUIREMENTS,
  resolvePlotConditions,
  SoilMoistureSchema,
  SoilPhSchema,
  SoilTextureSchema,
} from '@garden-planner/engine';
import { SegmentedControl, type SegmentedOption } from '../ui/SegmentedControl.tsx';
import styles from './PlotConditionsForm.module.css';

const SOIL_TEXTURES = SoilTextureSchema.options;

/** The engine's vocabularies are hyphenated slugs; a segment shows words. `''` is the "not sure" choice each optional soil facet keeps. */
function optionsWithNotSure<T extends string>(
  values: readonly T[],
): readonly SegmentedOption<T | ''>[] {
  return [
    { value: '' as const, label: 'Not sure' },
    ...values.map((value) => ({ value, label: humanise(value) })),
  ];
}

function humanise(value: string): string {
  const words = value.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const LIGHT_OPTIONS: readonly SegmentedOption<PlotConditionsInput['light']>[] =
  LIGHT_REQUIREMENTS.map((value) => ({ value, label: humanise(value) }));

const SOIL_PH_OPTIONS = optionsWithNotSure(SoilPhSchema.options);
const SOIL_MOISTURE_OPTIONS = optionsWithNotSure(SoilMoistureSchema.options);

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

/**
 * The value of the "no region picked" option in the region `<select>`.
 *
 * Deliberately not `''`: an empty option value and a real region id are both
 * strings, and the one thing this control must never do is quietly resolve to
 * the wrong climate. A named sentinel that cannot collide with a
 * `CLIMATE_REGIONS` id (which are slugs like `south-west-england`) makes the
 * mapping back to `location: undefined` explicit at both ends.
 */
const UK_DEFAULT_REGION = 'uk-default';

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

  const selectedRegion =
    value.location?.kind === 'region' ? value.location.regionId : UK_DEFAULT_REGION;

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
    <div className={styles.form}>
      <SegmentedControl
        legend="Light level"
        name="plot-light"
        options={LIGHT_OPTIONS}
        value={value.light}
        onChange={(light) => onChange({ ...value, light })}
      />

      {/*
       * Soil, behind a disclosure. It is the block most users leave entirely
       * as "not sure" — the engine ranks perfectly well without it and says so
       * in its own confidence figure — and it was 200px of the column that the
       * warnings dock needed. Closed by default for that reason, and *named*
       * "optional" so closing it doesn't read as hiding something required.
       */}
      <details
        className={styles.soil}
        // Opening it has to *show* it. The form panels live in a scrolling box
        // with the warnings dock pinned under them, and this disclosure sits
        // near the bottom of that box — so with a few warnings in the dock,
        // expanding it revealed three fields entirely below the scrollport and
        // the only visible change was the chevron turning. `block: 'nearest'`
        // scrolls the minimum needed, so a disclosure that is already fully in
        // view doesn't move at all.
        onToggle={(event) => {
          if (event.currentTarget.open) {
            event.currentTarget.scrollIntoView({ block: 'nearest' });
          }
        }}
      >
        <summary className={styles.soilSummary}>Describe your soil (optional)</summary>
        <div className={styles.soilBody}>
          <div className={styles.field}>
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
              {/* Five options — past the width a 300px column can segment, so
                  this one stays a `<select>` (see the module doc). */}
              <option value="">Not sure</option>
              {SOIL_TEXTURES.map((option) => (
                <option key={option} value={option}>
                  {humanise(option)}
                </option>
              ))}
            </select>
          </div>

          <SegmentedControl
            legend="Soil pH"
            name="plot-soil-ph"
            options={SOIL_PH_OPTIONS}
            value={value.soil?.ph ?? ''}
            onChange={(ph) => updateSoilFacet('ph', ph === '' ? undefined : ph)}
          />

          <SegmentedControl
            legend="Soil moisture"
            name="plot-soil-moisture"
            options={SOIL_MOISTURE_OPTIONS}
            value={value.soil?.moisture ?? ''}
            onChange={(moisture) =>
              updateSoilFacet('moisture', moisture === '' ? undefined : moisture)
            }
          />
        </div>
      </details>

      {/*
       * Location as one control. The "UK default" is the first option rather
       * than a radio beside a conditional select: `resolvePlotConditions` maps
       * an absent `location` to the UK average, so "no region picked" is a
       * value this field can hold rather than a mode it can be in.
       */}
      <div className={styles.field}>
        <label htmlFor="plot-region">Region</label>
        <select
          id="plot-region"
          value={selectedRegion}
          onChange={(event) =>
            onChange({
              ...value,
              location:
                event.target.value === UK_DEFAULT_REGION
                  ? undefined
                  : { kind: 'region', regionId: event.target.value },
            })
          }
        >
          <option value={UK_DEFAULT_REGION}>United Kingdom (default)</option>
          {CLIMATE_REGIONS.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
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

      {!resolution.ok && (
        <p role="alert" className={styles.error}>
          {resolution.message}
        </p>
      )}
    </div>
  );
}
