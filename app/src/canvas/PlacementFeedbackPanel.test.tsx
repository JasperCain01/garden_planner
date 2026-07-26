import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  rectangleRegion,
  validatePlant,
  type Plant,
  type PlotRegion,
} from '@garden-planner/engine';
import type { PlacedPlant } from '../state/placements-store.ts';
import { PlacementFeedbackPanel } from './PlacementFeedbackPanel.tsx';

// Same golden onion figure `fit.test.ts` and `feedback.test.ts` use: a
// 200 x 100 cm bed at 10 (in-row) x 30 (between-row) cm holds 60 onions.
const REGION: PlotRegion = rectangleRegion(200, 100);

function plantWith(id: string, commonName: string): Plant {
  return validatePlant({
    id,
    commonName,
    scientificName: 'Allium cepa',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

const ONION = plantWith('onion', 'Onion');
const KALE = plantWith('kale', 'Kale');

function placed(plant: Plant, x: number, y: number): PlacedPlant {
  return { id: `${plant.id}-${x}-${y}`, plant, x, y };
}

describe('PlacementFeedbackPanel', () => {
  it('shows a prompt to place something when the canvas is empty', () => {
    render(<PlacementFeedbackPanel placements={[]} region={REGION} activePlant={null} />);

    expect(screen.getByText(/drag a plant from the palette/i)).toBeTruthy();
  });

  it("shows the active plant's fitPlant summary verbatim", () => {
    render(
      <PlacementFeedbackPanel
        placements={[placed(ONION, 10, 10)]}
        region={REGION}
        activePlant={ONION}
      />,
    );

    // The exact sentence fit.ts's summarise() produces for this fixture — see fit.test.ts's golden case.
    expect(
      screen.getByText(/Onion — 60 plants: 3 rows of 20 at 10 × 30 cm, square packing\./),
    ).toBeTruthy();
  });

  it('falls back to the most recently placed plant when nothing is actively selected', () => {
    render(
      <PlacementFeedbackPanel
        placements={[placed(KALE, 0, 0), placed(ONION, 50, 50)]}
        region={REGION}
        activePlant={null}
      />,
    );

    expect(screen.getByText(/^Onion —/)).toBeTruthy();
  });

  it('tallies placed-versus-fits per distinct crop', () => {
    render(
      <PlacementFeedbackPanel
        placements={[placed(ONION, 0, 0), placed(ONION, 10, 10), placed(KALE, 50, 50)]}
        region={REGION}
        activePlant={null}
      />,
    );

    expect(screen.getByText(/Onion:/).closest('li')?.textContent).toContain(
      'Onion: 2 placed of 60 the plot can hold',
    );
    expect(screen.getByText(/Kale:/).closest('li')?.textContent).toMatch(
      /Kale: 1 placed of \d+ the plot can hold/,
    );
  });
});
