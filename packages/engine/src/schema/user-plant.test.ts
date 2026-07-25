import { describe, it, expect } from 'vitest';
import { validatePlant, safeValidatePlant, type Plant } from './plant';
import {
  createUserPlant,
  isUserPlant,
  isUserPlantId,
  safeValidateUserPlantInput,
  slugifyName,
  USER_ENTERED_SOURCE,
  USER_PLANT_ID_PREFIX,
  userPlantIdFromName,
  userPlantInputToPlant,
  validateUserPlantInput,
  UserPlantIdSchema,
  type UserPlantInput,
} from './user-plant';

/**
 * Stage 0.3's guarantee, in test form: **the user path is permissive, the shipped
 * path stays strict, and the boundary between them is explicit.** The suites below
 * are organised around exactly that — what a packet can produce, what the upcast
 * synthesises, what the `user-` namespace guarantees, and (the point of the whole
 * stage) that none of it loosened `validatePlant`.
 */

/**
 * The floor the workplan's verification bar names: common name + spacing + light +
 * category. **No** scientific name, **no** source — because a seed packet has
 * neither. This doubles as the worked example of what the Stage 3.6 form collects.
 */
const cherryBelle: UserPlantInput = {
  commonName: 'Cherry Belle',
  category: 'vegetable',
  light: 'full-sun',
  // Radishes off a packet: "sow 2.5 cm apart in rows 15 cm apart".
  spacing: { row: { inRowCm: 2.5, betweenRowCm: 15 } },
};

/** A richer packet: everything the form optionally offers. */
const fullPacket: UserPlantInput = {
  commonName: "Runner Bean 'Scarlet Emperor'",
  category: 'vegetable',
  light: 'full-sun',
  spacing: {
    row: { inRowCm: 15, betweenRowCm: 60 },
    intensive: { plantsPerSquare: 4 },
  },
  seasons: { sow: [{ start: 5, end: 6 }], harvest: [{ start: 7, end: 10 }] },
  hardiness: { rhsRating: 'H2' },
  soil: { textures: ['loam'], moisture: ['moist'] },
  icon: 'bean',
};

/**
 * A fully-sourced *shipped* record, the shape the ETL produces. Used below to
 * prove the shipped bar did not move — this is the regression the whole stage is
 * designed around.
 */
const shippedRadish: Plant = {
  id: 'radish',
  commonName: 'Radish',
  scientificName: 'Raphanus sativus',
  gbifId: null,
  category: 'vegetable',
  light: 'full-sun',
  spacing: { intensive: { plantsPerSquare: 16 } },
  provenance: { sources: [{ source: 'hand-verified' }] },
};

describe('UserPlantInputSchema — what a seed packet can produce', () => {
  it('accepts the minimal packet: name + category + light + spacing, no science, no source', () => {
    expect(() => validateUserPlantInput(cherryBelle)).not.toThrow();
  });

  it('accepts a packet with every optional field filled in', () => {
    expect(() => validateUserPlantInput(fullPacket)).not.toThrow();
  });

  it.each([
    ['commonName', { ...cherryBelle, commonName: undefined }],
    ['category', { ...cherryBelle, category: undefined }],
    ['light', { ...cherryBelle, light: undefined }],
    ['spacing', { ...cherryBelle, spacing: undefined }],
  ])('still requires %s — the fields the engine cannot work without', (_field, input) => {
    expect(() => validateUserPlantInput(input)).toThrow();
  });

  it('holds user input to the same *value* bounds as shipped data', () => {
    // The relaxation is about which fields are required, never about what counts
    // as a valid value: months, spacing and enums are the Stage 0.2 rules verbatim.
    expect(() =>
      validateUserPlantInput({ ...cherryBelle, seasons: { sow: [{ start: 3, end: 13 }] } }),
    ).toThrow();
    expect(() =>
      validateUserPlantInput({
        ...cherryBelle,
        spacing: { row: { inRowCm: -1, betweenRowCm: 15 } },
      }),
    ).toThrow();
    expect(() => validateUserPlantInput({ ...cherryBelle, light: 'dappled' })).toThrow();
    expect(() => validateUserPlantInput({ ...cherryBelle, spacing: {} })).toThrow();
  });

  it('rejects a name with nothing slug-able in it, so an id can always be derived', () => {
    const result = safeValidateUserPlantInput({ ...cherryBelle, commonName: '!!!' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('commonName'))).toBe(true);
    }
  });

  it('rejects provenance and scientificName outright rather than quietly ignoring them', () => {
    // `.strict()`: these are *absent* from the input shape, not optional. A caller
    // trying to hand-supply provenance is making a mistake we want to see.
    expect(() =>
      validateUserPlantInput({ ...cherryBelle, scientificName: 'Raphanus sativus' }),
    ).toThrow();
    expect(() =>
      validateUserPlantInput({
        ...cherryBelle,
        provenance: { sources: [{ source: 'RHS' }] },
      }),
    ).toThrow();
    expect(() =>
      validateUserPlantInput({
        ...cherryBelle,
        companions: [{ plantId: 'carrot', evidence: 'traditional' }],
      }),
    ).toThrow();
  });

  it('returns field-addressable errors for the form (safe parse)', () => {
    const result = safeValidateUserPlantInput({ ...cherryBelle, category: 'mushroom' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('category'))).toBe(true);
    }
  });
});

describe('userPlantInputToPlant — the upcast to a full Plant', () => {
  it('upcasts a minimal packet into a validatePlant-clean Plant', () => {
    const plant = userPlantInputToPlant(cherryBelle);
    // The whole point of the stage: past this boundary it is just a `Plant`, and
    // the strict, unchanged ETL-grade validator accepts it.
    expect(() => validatePlant(plant)).not.toThrow();
    expect(validatePlant(plant)).toEqual(plant);
  });

  it('synthesises exactly the fields a packet cannot supply', () => {
    const plant = userPlantInputToPlant(cherryBelle);
    expect(plant).toEqual<Plant>({
      id: 'user-cherry-belle',
      commonName: 'Cherry Belle',
      // Defaults to the common name — valid (the schema wants min(1), not a
      // binomial) and honest, but see the ADR: nothing may assume it is botanical.
      scientificName: 'Cherry Belle',
      gbifId: null,
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 2.5, betweenRowCm: 15 } },
      provenance: { sources: [{ source: USER_ENTERED_SOURCE }] },
    });
  });

  it('labels the provenance honestly as user-entered', () => {
    const plant = userPlantInputToPlant(cherryBelle);
    expect(plant.provenance.sources).toEqual([{ source: 'user-entered' }]);
    // No borrowed citation: nothing here pretends to a licence or a URL.
    expect(plant.provenance.sources[0].url).toBeUndefined();
    expect(plant.provenance.sources[0].license).toBeUndefined();
  });

  it('carries every optional packet field through unchanged', () => {
    const plant = userPlantInputToPlant(fullPacket);
    expect(() => validatePlant(plant)).not.toThrow();
    expect(plant.seasons).toEqual(fullPacket.seasons);
    expect(plant.hardiness).toEqual(fullPacket.hardiness);
    expect(plant.soil).toEqual(fullPacket.soil);
    expect(plant.icon).toBe('bean');
    expect(plant.spacing).toEqual(fullPacket.spacing);
  });

  it('omits absent optionals rather than setting them to undefined', () => {
    const plant = userPlantInputToPlant(cherryBelle);
    // Matters for the JSON round-trip and for `.strict()`-adjacent surprises.
    expect(Object.keys(plant)).not.toContain('seasons');
    expect(Object.keys(plant)).not.toContain('icon');
  });

  it('gives a user crop no companion or antagonist links at all', () => {
    // Deliverable 4 of the Stage 0.3 brief, asserted so Stage 3.6 need not
    // re-litigate it: a packet supplies no relationships, so a user crop has none
    // — and a plant with no links cannot dangle in Stage 3.1's `shipped ∪ user`
    // runtime list. Referential integrity is a non-issue for user crops.
    const plant = userPlantInputToPlant(fullPacket);
    expect(plant.companions).toBeUndefined();
    expect(plant.antagonists).toBeUndefined();
  });

  it('createUserPlant validates and upcasts in one step for the Stage 3.6 form', () => {
    const plant = createUserPlant({ ...cherryBelle });
    expect(plant.id).toBe('user-cherry-belle');
    expect(() => validatePlant(plant)).not.toThrow();
    // ...and still refuses invalid form values.
    expect(() => createUserPlant({ ...cherryBelle, light: 'dappled' })).toThrow();
  });
});

describe('the `user-` id namespace', () => {
  it('mints ids in the reserved namespace from the packet name', () => {
    expect(userPlantIdFromName('Cherry Belle')).toBe('user-cherry-belle');
    expect(userPlantIdFromName("Radish 'Cherry Belle'")).toBe('user-radish-cherry-belle');
    // Accents fold rather than vanish; punctuation collapses to single hyphens.
    expect(userPlantIdFromName('Mâche  (corn salad)!')).toBe('user-mache-corn-salad');
  });

  it('produces ids that satisfy both the slug rule and the namespace rule', () => {
    for (const name of ['Cherry Belle', "Runner Bean 'Scarlet Emperor'", '99 Cauliflower']) {
      const id = userPlantIdFromName(name);
      expect(() => UserPlantIdSchema.parse(id)).not.toThrow();
      expect(isUserPlantId(id)).toBe(true);
    }
  });

  it('refuses to derive an id from a name with no letters or numbers', () => {
    expect(() => userPlantIdFromName('!!!')).toThrow();
    expect(slugifyName('!!!')).toBe('');
  });

  it('rejects an explicit id that is not in the user namespace', () => {
    // The rule that makes the collision guarantee real on the user side.
    expect(() => validateUserPlantInput({ ...cherryBelle, id: 'cherry-belle' })).toThrow();
    expect(() => validateUserPlantInput({ ...cherryBelle, id: 'user-' })).toThrow();
    expect(() => validateUserPlantInput({ ...cherryBelle, id: 'user' })).toThrow();
    expect(() => validateUserPlantInput({ ...cherryBelle, id: 'User-Cherry-Belle' })).toThrow();
  });

  it('honours an explicit namespaced id (Stage 3.6 de-duplicating two same-named packets)', () => {
    const plant = userPlantInputToPlant({ ...cherryBelle, id: 'user-cherry-belle-2' });
    expect(plant.id).toBe('user-cherry-belle-2');
    expect(() => validatePlant(plant)).not.toThrow();
  });

  it('classifies ids and plants by namespace', () => {
    expect(USER_PLANT_ID_PREFIX).toBe('user-');
    expect(isUserPlantId('user-cherry-belle')).toBe(true);
    expect(isUserPlantId('onion')).toBe(false);
    // A shipped id that merely *contains* "user" is not in the namespace.
    expect(isUserPlantId('cucumber')).toBe(false);
    expect(isUserPlantId('user')).toBe(false);
    expect(isUserPlantId('user-')).toBe(false);

    expect(isUserPlant(userPlantInputToPlant(cherryBelle))).toBe(true);
    expect(isUserPlant(shippedRadish)).toBe(false);
  });
});

describe('the shipped bar is unchanged by this stage', () => {
  it('still accepts a fully-sourced shipped record, unchanged', () => {
    expect(validatePlant(shippedRadish)).toEqual(shippedRadish);
  });

  it('still rejects a shipped record with no provenance', () => {
    const bad: Record<string, unknown> = { ...shippedRadish };
    delete bad.provenance;
    expect(() => validatePlant(bad)).toThrow();
    expect(safeValidatePlant(bad).success).toBe(false);
  });

  it('still rejects a shipped record with no scientific name', () => {
    const bad: Record<string, unknown> = { ...shippedRadish };
    delete bad.scientificName;
    expect(() => validatePlant(bad)).toThrow();
  });

  it('still rejects empty provenance sources', () => {
    expect(() => validatePlant({ ...shippedRadish, provenance: { sources: [] } })).toThrow();
  });

  it('does not accept a user *input* as a Plant — the boundary is the upcast', () => {
    // If this ever passed, the relaxation would have leaked into the shipped gate.
    expect(() => validatePlant(cherryBelle)).toThrow();
  });
});
