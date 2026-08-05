/**
 * The add-crop form (Workplan Stage 3.6): everything a seed-packet form can
 * supply — `commonName`, `category`, `light`, `spacing` (required), plus
 * `seasons`/`hardiness`/`soil` (optional) — validated on submit via
 * `safeValidateUserPlantInput` (`@garden-planner/engine`), the same schema
 * `UserCropsSection.tsx` hands straight to `useUserPlantsStore().addUserPlant`.
 *
 * **No icon picker.** As of this stage, Phase 4 (the bundled SVG icon set,
 * Stage 4.1) has not started — see `docs/architecture.md`'s Stage 3.6 note
 * and `WORKPLAN.md`'s Progress table. `UserPlantInputSchema.icon` is simply
 * left unset, so every user crop falls back to the palette/canvas's existing
 * generic per-category rendering; adding a real picker is Stage 4.1+4.2's
 * job once there is a bundled set to constrain it to.
 *
 * **Spacing.** `SpacingSchema` is method-aware (row vs. intensive, see
 * `packages/engine/src/schema/plant.ts`), so this form offers a toggle
 * between the two rather than trying to collect both at once — a seed
 * packet's grower usually knows one method, not both.
 *
 * **Field-level errors.** `safeValidateUserPlantInput` returns a `ZodError`
 * whose `issues[].path` addresses the offending field; this form buckets
 * those by `path[0]` and renders each bucket's messages next to the
 * fieldset/field it concerns, mirroring `PlotConditionsForm.tsx`'s own
 * inline-validity pattern (Stage 3.2) rather than a single generic banner.
 *
 * **The id-collision check is separate from schema validation** — a
 * `UserPlantInput` can be perfectly schema-valid and still mint an id
 * (`userPlantIdFromName`) that collides with a crop already in the session's
 * overlay (two packets, same name). `existingIds` (the current
 * `useUserPlantsStore().userPlants` keys, passed in by `UserCropsSection.tsx`)
 * is checked after schema validation succeeds; a collision blocks submission
 * with a message rather than silently overwriting the earlier crop, and the
 * user resolves it either by renaming or by filling in the "custom id"
 * escape hatch `UserPlantInputSchema.id` documents.
 *
 * **Styling (UI redesign Phase 0).** Seven nested fieldsets used to render as
 * a maze of etched boxes with every label flush against its control. The
 * fieldsets stay (grouping semantics), the boxes don't (`styles/global.css`),
 * and `AddCropForm.module.css` supplies the rhythm. Moving the whole form into
 * a modal off the palette is Phase 1's job (`docs/ui-aesthetic-review.md`).
 */

import { useMemo, useState, type FormEvent } from 'react';
import {
  EdibleCategorySchema,
  LightRequirementSchema,
  RhsHardinessRatingSchema,
  SoilMoistureSchema,
  SoilPhSchema,
  SoilTextureSchema,
  safeValidateUserPlantInput,
  slugifyName,
  userPlantIdFromName,
  type EdibleCategory,
  type LightRequirement,
  type RhsHardinessRating,
  type SoilMoisture,
  type SoilPh,
  type SoilTexture,
  type UserPlantInput,
} from '@garden-planner/engine';
import styles from './AddCropForm.module.css';

const CATEGORY_OPTIONS = EdibleCategorySchema.options;
const LIGHT_OPTIONS = LightRequirementSchema.options;
const HARDINESS_OPTIONS = RhsHardinessRatingSchema.options;
const SOIL_TEXTURE_OPTIONS = SoilTextureSchema.options;
const SOIL_PH_OPTIONS = SoilPhSchema.options;
const SOIL_MOISTURE_OPTIONS = SoilMoistureSchema.options;

type SpacingMethod = 'row' | 'intensive';

/** The form's own draft shape — plain strings/selections, assembled into a candidate object only on submit. */
interface Draft {
  commonName: string;
  category: EdibleCategory | '';
  light: LightRequirement | '';
  spacingMethod: SpacingMethod;
  inRowCm: string;
  betweenRowCm: string;
  perSquareMetre: string;
  plantsPerSquare: string;
  hardinessRating: RhsHardinessRating | '';
  soilTextures: SoilTexture[];
  soilPh: SoilPh[];
  soilMoisture: SoilMoisture[];
  sowStart: string;
  sowEnd: string;
  harvestStart: string;
  harvestEnd: string;
  idOverride: string;
}

const BLANK_DRAFT: Draft = {
  commonName: '',
  category: '',
  light: '',
  spacingMethod: 'row',
  inRowCm: '',
  betweenRowCm: '',
  perSquareMetre: '',
  plantsPerSquare: '',
  hardinessRating: '',
  soilTextures: [],
  soilPh: [],
  soilMoisture: [],
  sowStart: '',
  sowEnd: '',
  harvestStart: '',
  harvestEnd: '',
  idOverride: '',
};

/** Project an existing `UserPlantInput` (edit mode) into this form's draft shape. */
function draftFromInput(input: UserPlantInput): Draft {
  return {
    commonName: input.commonName,
    category: input.category,
    light: input.light,
    spacingMethod: input.spacing.intensive && !input.spacing.row ? 'intensive' : 'row',
    inRowCm: input.spacing.row ? String(input.spacing.row.inRowCm) : '',
    betweenRowCm: input.spacing.row ? String(input.spacing.row.betweenRowCm) : '',
    perSquareMetre: input.spacing.intensive?.perSquareMetre?.toString() ?? '',
    plantsPerSquare: input.spacing.intensive?.plantsPerSquare?.toString() ?? '',
    hardinessRating: input.hardiness?.rhsRating ?? '',
    soilTextures: input.soil?.textures ? [...input.soil.textures] : [],
    soilPh: input.soil?.ph ? [...input.soil.ph] : [],
    soilMoisture: input.soil?.moisture ? [...input.soil.moisture] : [],
    sowStart: input.seasons?.sow?.[0] ? String(input.seasons.sow[0].start) : '',
    sowEnd: input.seasons?.sow?.[0] ? String(input.seasons.sow[0].end) : '',
    harvestStart: input.seasons?.harvest?.[0] ? String(input.seasons.harvest[0].start) : '',
    harvestEnd: input.seasons?.harvest?.[0] ? String(input.seasons.harvest[0].end) : '',
    idOverride: input.id ?? '',
  };
}

/** `''` → `undefined`, else the parsed number — left as `NaN` if unparsable so zod's own bounds check reports it. */
function toNumberOrUndefined(text: string): number | undefined {
  return text.trim() === '' ? undefined : Number(text);
}

function toMonthOrUndefined(text: string): number | undefined {
  return text.trim() === '' ? undefined : Number(text);
}

/** Build the raw candidate `safeValidateUserPlantInput` checks, omitting anything left blank. */
function buildCandidate(draft: Draft): Record<string, unknown> {
  const spacing: Record<string, unknown> =
    draft.spacingMethod === 'row'
      ? {
          row: {
            ...(toNumberOrUndefined(draft.inRowCm) !== undefined
              ? { inRowCm: toNumberOrUndefined(draft.inRowCm) }
              : {}),
            ...(toNumberOrUndefined(draft.betweenRowCm) !== undefined
              ? { betweenRowCm: toNumberOrUndefined(draft.betweenRowCm) }
              : {}),
          },
        }
      : {
          intensive: {
            ...(toNumberOrUndefined(draft.perSquareMetre) !== undefined
              ? { perSquareMetre: toNumberOrUndefined(draft.perSquareMetre) }
              : {}),
            ...(toNumberOrUndefined(draft.plantsPerSquare) !== undefined
              ? { plantsPerSquare: toNumberOrUndefined(draft.plantsPerSquare) }
              : {}),
          },
        };

  const hardiness = draft.hardinessRating !== '' ? { rhsRating: draft.hardinessRating } : undefined;

  const soil =
    draft.soilTextures.length > 0 || draft.soilPh.length > 0 || draft.soilMoisture.length > 0
      ? {
          ...(draft.soilTextures.length > 0 ? { textures: draft.soilTextures } : {}),
          ...(draft.soilPh.length > 0 ? { ph: draft.soilPh } : {}),
          ...(draft.soilMoisture.length > 0 ? { moisture: draft.soilMoisture } : {}),
        }
      : undefined;

  const sowStart = toMonthOrUndefined(draft.sowStart);
  const sowEnd = toMonthOrUndefined(draft.sowEnd);
  const harvestStart = toMonthOrUndefined(draft.harvestStart);
  const harvestEnd = toMonthOrUndefined(draft.harvestEnd);
  const seasons: Record<string, unknown> = {};
  if (sowStart !== undefined || sowEnd !== undefined) {
    seasons.sow = [{ start: sowStart, end: sowEnd }];
  }
  if (harvestStart !== undefined || harvestEnd !== undefined) {
    seasons.harvest = [{ start: harvestStart, end: harvestEnd }];
  }

  return {
    commonName: draft.commonName.trim(),
    ...(draft.category !== '' ? { category: draft.category } : {}),
    ...(draft.light !== '' ? { light: draft.light } : {}),
    spacing,
    ...(hardiness ? { hardiness } : {}),
    ...(soil ? { soil } : {}),
    ...(Object.keys(seasons).length > 0 ? { seasons } : {}),
    ...(draft.idOverride.trim() !== '' ? { id: draft.idOverride.trim() } : {}),
  };
}

/** Best-effort id preview: `''` when the name has nothing slug-able yet, never throws. */
function previewId(commonName: string): string {
  return slugifyName(commonName) === '' ? '' : userPlantIdFromName(commonName);
}

export interface AddCropFormProps {
  /** The session's current user-crop ids (`useUserPlantsStore().userPlants` keys), for the collision check. */
  readonly existingIds: readonly string[];
  /** Called with a validated, collision-free `UserPlantInput` on submit. */
  readonly onSubmit: (input: UserPlantInput) => void;
  /**
   * Present in edit mode: the crop being edited, pre-filling the form. Its own
   * `id` is excluded from the collision check (editing and re-submitting the
   * same crop is not a collision with itself).
   */
  readonly initialInput?: UserPlantInput;
  /** Present in edit mode: called when the user cancels without submitting. */
  readonly onCancel?: () => void;
}

export function AddCropForm({ existingIds, onSubmit, initialInput, onCancel }: AddCropFormProps) {
  const isEditing = initialInput !== undefined;
  const [draft, setDraft] = useState<Draft>(() =>
    initialInput ? draftFromInput(initialInput) : BLANK_DRAFT,
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [collisionMessage, setCollisionMessage] = useState<string | null>(null);

  function update<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleMulti<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
  }

  const preview = useMemo(() => previewId(draft.commonName), [draft.commonName]);
  const excludeId = initialInput?.id;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const candidate = buildCandidate(draft);
    const result = safeValidateUserPlantInput(candidate);
    if (!result.success) {
      const buckets: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        (buckets[key] ??= []).push(issue.message);
      }
      setErrors(buckets);
      setCollisionMessage(null);
      return;
    }

    const effectiveId = result.data.id ?? userPlantIdFromName(result.data.commonName);
    if (effectiveId !== excludeId && existingIds.includes(effectiveId)) {
      setErrors({});
      setCollisionMessage(
        `A crop with id "${effectiveId}" already exists in this session. Rename this crop, ` +
          `or set a custom id below (e.g. "${effectiveId}-2").`,
      );
      return;
    }

    setErrors({});
    setCollisionMessage(null);
    onSubmit(result.data);
    if (!isEditing) {
      setDraft(BLANK_DRAFT);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={isEditing ? 'edit crop' : 'add a crop'}
      className={styles.form}
    >
      <div className={styles.field}>
        <label htmlFor="crop-common-name">Name (from the packet)</label>
        <input
          id="crop-common-name"
          type="text"
          value={draft.commonName}
          onChange={(event) => update('commonName', event.target.value)}
        />
        {preview !== '' && (
          <p className={styles.hint}>This will be added as &ldquo;{preview}&rdquo;.</p>
        )}
        {errors.commonName?.map((message) => (
          <p role="alert" className={styles.error} key={message}>
            {message}
          </p>
        ))}
      </div>

      <div className={styles.field}>
        <label htmlFor="crop-category">Category</label>
        <select
          id="crop-category"
          value={draft.category}
          onChange={(event) => update('category', event.target.value as EdibleCategory | '')}
        >
          <option value="">Choose a category</option>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {errors.category?.map((message) => (
          <p role="alert" className={styles.error} key={message}>
            {message}
          </p>
        ))}
      </div>

      <div className={styles.field}>
        <label htmlFor="crop-light">Light requirement</label>
        <select
          id="crop-light"
          value={draft.light}
          onChange={(event) => update('light', event.target.value as LightRequirement | '')}
        >
          <option value="">Choose a light level</option>
          {LIGHT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option.replace('-', ' ')}
            </option>
          ))}
        </select>
        {errors.light?.map((message) => (
          <p role="alert" className={styles.error} key={message}>
            {message}
          </p>
        ))}
      </div>

      <fieldset className={styles.group}>
        <legend>Spacing</legend>
        <div className={styles.choices}>
          <label>
            <input
              type="radio"
              name="crop-spacing-method"
              value="row"
              checked={draft.spacingMethod === 'row'}
              onChange={() => update('spacingMethod', 'row')}
            />
            Row growing
          </label>
          <label>
            <input
              type="radio"
              name="crop-spacing-method"
              value="intensive"
              checked={draft.spacingMethod === 'intensive'}
              onChange={() => update('spacingMethod', 'intensive')}
            />
            Intensive / square-foot bed
          </label>
        </div>

        {draft.spacingMethod === 'row' ? (
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="crop-in-row-cm">In-row spacing (cm)</label>
              <input
                id="crop-in-row-cm"
                type="number"
                min="0"
                value={draft.inRowCm}
                onChange={(event) => update('inRowCm', event.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="crop-between-row-cm">Between-row spacing (cm)</label>
              <input
                id="crop-between-row-cm"
                type="number"
                min="0"
                value={draft.betweenRowCm}
                onChange={(event) => update('betweenRowCm', event.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className={styles.fields}>
            <div className={styles.field}>
              <label htmlFor="crop-per-square-metre">Plants per m²</label>
              <input
                id="crop-per-square-metre"
                type="number"
                min="0"
                value={draft.perSquareMetre}
                onChange={(event) => update('perSquareMetre', event.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="crop-plants-per-square">Plants per square-foot square</label>
              <input
                id="crop-plants-per-square"
                type="number"
                min="0"
                value={draft.plantsPerSquare}
                onChange={(event) => update('plantsPerSquare', event.target.value)}
              />
            </div>
          </div>
        )}
        {errors.spacing?.map((message) => (
          <p role="alert" className={styles.error} key={message}>
            {message}
          </p>
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Hardiness (optional)</legend>
        <div className={styles.field}>
          <label htmlFor="crop-hardiness">RHS rating</label>
          <select
            id="crop-hardiness"
            value={draft.hardinessRating}
            onChange={(event) =>
              update('hardinessRating', event.target.value as RhsHardinessRating | '')
            }
          >
            <option value="">Not sure</option>
            {HARDINESS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        {errors.hardiness?.map((message) => (
          <p role="alert" className={styles.error} key={message}>
            {message}
          </p>
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Soil (optional)</legend>
        <fieldset className={styles.checkboxGroup}>
          <legend>Texture</legend>
          <div className={styles.checkboxOptions}>
            {SOIL_TEXTURE_OPTIONS.map((option) => (
              <label key={option}>
                <input
                  type="checkbox"
                  checked={draft.soilTextures.includes(option)}
                  onChange={() => update('soilTextures', toggleMulti(draft.soilTextures, option))}
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.checkboxGroup}>
          <legend>pH</legend>
          <div className={styles.checkboxOptions}>
            {SOIL_PH_OPTIONS.map((option) => (
              <label key={option}>
                <input
                  type="checkbox"
                  checked={draft.soilPh.includes(option)}
                  onChange={() => update('soilPh', toggleMulti(draft.soilPh, option))}
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.checkboxGroup}>
          <legend>Moisture</legend>
          <div className={styles.checkboxOptions}>
            {SOIL_MOISTURE_OPTIONS.map((option) => (
              <label key={option}>
                <input
                  type="checkbox"
                  checked={draft.soilMoisture.includes(option)}
                  onChange={() => update('soilMoisture', toggleMulti(draft.soilMoisture, option))}
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
        {errors.soil?.map((message) => (
          <p role="alert" className={styles.error} key={message}>
            {message}
          </p>
        ))}
      </fieldset>

      <fieldset className={styles.group}>
        <legend>Seasons (optional, months 1–12)</legend>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="crop-sow-start">Sow start month</label>
            <input
              id="crop-sow-start"
              type="number"
              min="1"
              max="12"
              value={draft.sowStart}
              onChange={(event) => update('sowStart', event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="crop-sow-end">Sow end month</label>
            <input
              id="crop-sow-end"
              type="number"
              min="1"
              max="12"
              value={draft.sowEnd}
              onChange={(event) => update('sowEnd', event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="crop-harvest-start">Harvest start month</label>
            <input
              id="crop-harvest-start"
              type="number"
              min="1"
              max="12"
              value={draft.harvestStart}
              onChange={(event) => update('harvestStart', event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="crop-harvest-end">Harvest end month</label>
            <input
              id="crop-harvest-end"
              type="number"
              min="1"
              max="12"
              value={draft.harvestEnd}
              onChange={(event) => update('harvestEnd', event.target.value)}
            />
          </div>
        </div>
        {errors.seasons?.map((message) => (
          <p role="alert" className={styles.error} key={message}>
            {message}
          </p>
        ))}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor="crop-id-override">Custom id (only if the name above conflicts)</label>
        <input
          id="crop-id-override"
          type="text"
          placeholder="user-cherry-belle-2"
          value={draft.idOverride}
          onChange={(event) => update('idOverride', event.target.value)}
        />
        {errors.id?.map((message) => (
          <p role="alert" className={styles.error} key={message}>
            {message}
          </p>
        ))}
      </div>

      {collisionMessage && (
        <p role="alert" className={styles.error}>
          {collisionMessage}
        </p>
      )}
      {errors.form?.map((message) => (
        <p role="alert" className={styles.error} key={message}>
          {message}
        </p>
      ))}

      <div className={styles.actions}>
        <button type="submit" data-variant="primary">
          {isEditing ? 'Save changes' : 'Add crop'}
        </button>
        {isEditing && onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
