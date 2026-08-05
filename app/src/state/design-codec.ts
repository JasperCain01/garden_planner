/**
 * Turning a {@link Design} into something that survives a page reload, and —
 * the harder half — turning whatever comes back out of storage into a design
 * again (UI redesign Phase 5, ADR 0034 §1–§2, §4).
 *
 * ## Restored state is untrusted input, and the engine already says so
 *
 * `localStorage` is a plain string keyed by origin. Anything with script access
 * to the page can write it, a half-finished write can leave it truncated, and
 * a design saved by an older build can carry a shape this one has never seen.
 * The engine anticipated exactly this — `climate/schema.ts` names "a malformed
 * `lat`/`lng` from, say, a corrupted `localStorage`" as a reason its schema
 * exists — so this module never casts. Every value that comes back goes through
 * the engine's own boundary functions:
 *
 * | value               | gate                                    |
 * | ------------------- | --------------------------------------- |
 * | `region`            | `safeValidatePlotRegion`                |
 * | `conditionsInput`   | `PlotConditionsInputSchema.safeParse`   |
 * | a user crop         | `createUserPlant` (via the store)       |
 * | a placement's plant | resolved against the live plant list    |
 *
 * A design that fails a gate is **skipped, not repaired and not fatal**: the
 * rest of the library still loads and {@link parseLibrary} reports what went.
 * Silently mending a corrupt outline would put a shape on screen the user never
 * drew; throwing would lose every other design to one bad one.
 *
 * ## What a placement stores, and why not the plant
 *
 * `placements-store.ts` deliberately holds a whole `Plant` per placement, and
 * its reasons are good — for memory. Written down, one is up to 4.6 KB (potato
 * is 3,223 bytes, 89% of it `provenance` and `antagonists`), so twenty
 * placements would be ~63 KB of a ~5 MB origin quota for data the app already
 * ships in its bundle. A stored placement is `{ id, plantId, x, y }` — about
 * 60 bytes — and the plant is resolved back on load.
 *
 * ## Which raises the question this module actually exists to answer
 *
 * A `plantId` can dangle, and not hypothetically. ADR 0025 **deleted 24 crops**
 * from the shipped dataset on purpose, and that dataset is a build artifact
 * that changes between deploys; user-defined crops are session-scoped by
 * explicit design in three places, so a design mentioning one would dangle the
 * moment the tab closed. Two different problems, two different answers:
 *
 * - **A user crop travels *with* the design**, as the `UserPlantInput` the
 *   add-crop form produced (`user-crops/plant-to-input.ts` is the projection,
 *   and it already existed for editing). Restoring runs it back through
 *   `createUserPlant`, the same trust boundary the form uses, so no new
 *   validator appears anywhere. This is narrower than persisting
 *   `user-plants-store`: the store is still session-scoped, and a crop outlives
 *   the session only for as long as a design that uses it does.
 * - **A shipped crop that is gone is gone.** Its placement is dropped and
 *   {@link parseLibrary} says so by name. A tombstone was considered and
 *   rejected in ADR 0034 §2: a marker's size *is* the crop's footprint and its
 *   colour is its category, so a placement whose record no longer exists is one
 *   the canvas cannot draw honestly.
 */

import {
  createUserPlant,
  isUserPlant,
  PlotConditionsInputSchema,
  safeValidatePlotRegion,
  type Plant,
  type UserPlantInput,
} from '@garden-planner/engine';
import { plantToUserPlantInput } from '../user-crops/plant-to-input.ts';
import type { PlacedPlant } from './placements-store.ts';
import type { Design } from './design.ts';

/** The `localStorage` key the whole library lives under. Namespaced, because an origin is shared with anything else ever served from it. */
export const DESIGNS_STORAGE_KEY = 'garden-planner:designs';

/**
 * The stored format's version.
 *
 * Bumped when the shape changes incompatibly. {@link parseLibrary} rejects
 * anything it does not recognise rather than guessing, which is the same call
 * the rest of this module makes about malformed input: an unreadable library is
 * a fresh start, not a repair job.
 */
export const DESIGNS_STORAGE_VERSION = 1;

/** One placement, written down: a reference and a position. See the module doc for why not the plant. */
export interface StoredPlacement {
  readonly id: string;
  readonly plantId: string;
  readonly x: number;
  readonly y: number;
}

/** A named design as it is stored. `region` and `conditionsInput` are `unknown` on purpose — they are only ever produced by validation, never trusted on the way in. */
export interface StoredDesign {
  readonly id: string;
  readonly name: string;
  /** ISO 8601, for ordering the switcher's list. Display-only: nothing branches on it. */
  readonly updatedAt: string;
  readonly region: unknown;
  readonly conditionsInput: unknown;
  readonly placements: readonly StoredPlacement[];
  /** Only the user-defined crops this design's placements actually reference — see the module doc. */
  readonly customPlants: readonly UserPlantInput[];
}

export interface StoredLibrary {
  readonly version: number;
  readonly activeId: string | null;
  readonly designs: readonly StoredDesign[];
}

/** A design that came back out of storage, resolved against the live plant list. */
export interface RestoredDesign {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
  readonly design: Design;
  /** The user crops this design carried, ready to be re-added to the session's overlay. */
  readonly customPlants: readonly UserPlantInput[];
  /** `plantId`s whose placements were dropped because no such crop exists any more. */
  readonly missingPlantIds: readonly string[];
}

export interface ParsedLibrary {
  readonly designs: readonly RestoredDesign[];
  readonly activeId: string | null;
  /** Human-readable notes about what did not survive, for the switcher to show. Empty on a clean load. */
  readonly problems: readonly string[];
}

/** Serialise the live design into the stored shape. `plants` supplies the user crops the placements reference. */
export function toStoredDesign(
  meta: { readonly id: string; readonly name: string; readonly updatedAt: string },
  design: Design,
): StoredDesign {
  // The custom crops are read off the placements themselves rather than from
  // `user-plants-store`, so a design carries exactly the crops it uses and not
  // whatever else the session happens to have defined. Deduplicated by id: the
  // same crop planted six times is one record.
  const customPlants = new Map<string, UserPlantInput>();
  for (const placement of design.placements) {
    if (isUserPlant(placement.plant) && !customPlants.has(placement.plant.id)) {
      customPlants.set(placement.plant.id, plantToUserPlantInput(placement.plant));
    }
  }

  return {
    id: meta.id,
    name: meta.name,
    updatedAt: meta.updatedAt,
    region: design.region,
    conditionsInput: design.conditionsInput,
    placements: design.placements.map((placement) => ({
      id: placement.id,
      plantId: placement.plant.id,
      x: placement.x,
      y: placement.y,
    })),
    customPlants: [...customPlants.values()],
  };
}

/**
 * Read a library back out of a raw string, validating everything.
 *
 * Never throws: a `null`, a truncated string, a JSON array where an object
 * belonged, a design with a self-intersecting outline — each is a reason to
 * return fewer designs and a note saying which, not a reason to take the app
 * down on load. `plantsById` is the live plant list, which for the shipped half
 * is a bundled constant (`dataset/shipped-plants.ts`), so resolution needs no
 * network and works offline exactly as the rest of the app does.
 */
export function parseLibrary(
  raw: string | null,
  plantsById: ReadonlyMap<string, Plant>,
): ParsedLibrary {
  const empty: ParsedLibrary = { designs: [], activeId: null, problems: [] };
  if (raw === null || raw === '') return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...empty, problems: ['Saved designs could not be read and were left alone.'] };
  }

  if (!isRecord(parsed) || parsed.version !== DESIGNS_STORAGE_VERSION) {
    return {
      ...empty,
      problems: ['Saved designs were written by a different version and were not loaded.'],
    };
  }

  const rawDesigns = Array.isArray(parsed.designs) ? parsed.designs : [];
  const designs: RestoredDesign[] = [];
  const problems: string[] = [];

  for (const candidate of rawDesigns) {
    const restored = parseDesign(candidate, plantsById);
    if (restored === null) {
      problems.push('One saved design was damaged and could not be opened.');
      continue;
    }
    designs.push(restored);
    if (restored.missingPlantIds.length > 0) {
      problems.push(
        `“${restored.name}” lost ${restored.missingPlantIds.length} ` +
          `${restored.missingPlantIds.length === 1 ? 'plant' : 'plants'}: ` +
          `${restored.missingPlantIds.join(', ')} ${
            restored.missingPlantIds.length === 1 ? 'is' : 'are'
          } no longer in the crop list.`,
      );
    }
  }

  const activeId =
    typeof parsed.activeId === 'string' && designs.some((design) => design.id === parsed.activeId)
      ? parsed.activeId
      : (designs[0]?.id ?? null);

  return { designs, activeId, problems };
}

/** One design, validated. `null` if it is not recoverable at all — see the module doc for what "not recoverable" means and what merely loses a placement. */
function parseDesign(
  candidate: unknown,
  plantsById: ReadonlyMap<string, Plant>,
): RestoredDesign | null {
  if (!isRecord(candidate)) return null;
  if (typeof candidate.id !== 'string' || candidate.id === '') return null;
  const name =
    typeof candidate.name === 'string' && candidate.name !== ''
      ? candidate.name
      : 'Untitled design';
  const updatedAt =
    typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date(0).toISOString();

  const region = safeValidatePlotRegion(candidate.region);
  if (!region.success) return null;

  const conditionsInput = PlotConditionsInputSchema.safeParse(candidate.conditionsInput);
  if (!conditionsInput.success) return null;

  // The design's own crops are resolved *before* its placements, and layered
  // over the shipped list rather than under it, so a design that carries a crop
  // is readable even in a session that has never defined one. Invalid records
  // are dropped here and their placements then fail to resolve below, which is
  // the same outcome a deleted shipped crop gets and needs no second path.
  const customPlants: UserPlantInput[] = [];
  const available = new Map(plantsById);
  for (const raw of Array.isArray(candidate.customPlants) ? candidate.customPlants : []) {
    const plant = safeCreateUserPlant(raw);
    if (plant === null) continue;
    customPlants.push(raw as UserPlantInput);
    available.set(plant.id, plant);
  }

  const placements: PlacedPlant[] = [];
  const missingPlantIds: string[] = [];
  // Post-review fix A4: a duplicate `id` is corrupt input the same way a
  // dangling `plantId` is — selection restore (`design-history.ts#restoreSelection`)
  // and undo bookkeeping both key placements by `id`, so two placements
  // sharing one would confuse both. Skipped silently, same precedent as the
  // missing-plant path above: this earns no `missingPlantIds`-style report,
  // since (unlike a deleted crop) there is nothing a user did to cause it and
  // nothing actionable to tell them.
  const seenIds = new Set<string>();
  for (const raw of Array.isArray(candidate.placements) ? candidate.placements : []) {
    if (!isRecord(raw)) continue;
    const { id, plantId, x, y } = raw;
    if (typeof id !== 'string' || typeof plantId !== 'string') continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const plant = available.get(plantId);
    if (plant === undefined) {
      if (!missingPlantIds.includes(plantId)) missingPlantIds.push(plantId);
      continue;
    }
    placements.push({ id, plant, x: x as number, y: y as number });
  }

  return {
    id: candidate.id,
    name,
    updatedAt,
    design: { region: region.data, conditionsInput: conditionsInput.data, placements },
    customPlants,
    missingPlantIds,
  };
}

/**
 * `createUserPlant`, but returning `null` instead of throwing.
 *
 * The engine deliberately exposes a throwing boundary here (`user-plant.ts`:
 * an invalid input "should not normally fail" because the form validates
 * first) and there is no `safeCreateUserPlant` beside it. Storage is the case
 * where it genuinely can fail, so the `try` lives here rather than in the
 * engine — this phase adds no engine code.
 */
function safeCreateUserPlant(raw: unknown): Plant | null {
  try {
    return createUserPlant(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
