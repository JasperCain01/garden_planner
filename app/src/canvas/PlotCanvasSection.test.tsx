import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rectangleRegion, validatePlant, type Plant } from '@garden-planner/engine';
import { usePlotStore } from '../state/plot-store.ts';
import { usePlacementsStore } from '../state/placements-store.ts';
import { exportPlotImage } from './export.ts';
import { PlotCanvasSection } from './PlotCanvasSection.tsx';

// The Konva scene itself is untested here (ADR 0017) — this only verifies the
// Export button wires up to `export.ts`'s pipeline. Its own logic (the legend
// builder) is covered directly in `export.test.ts`; the full rasterise-and-
// download flow needs a real browser and is covered by the E2E export spec.
vi.mock('./export.ts', () => ({
  exportPlotImage: vi.fn().mockResolvedValue(undefined),
}));

const ONION: Plant = validatePlant({
  id: 'onion',
  commonName: 'Onion',
  scientificName: 'Allium cepa',
  gbifId: null,
  category: 'vegetable',
  light: 'full-sun',
  spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
  provenance: { sources: [{ source: 'hand-written test fixture' }] },
});

describe('PlotCanvasSection export button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlotStore.setState({
      region: rectangleRegion(300, 200),
      conditionsInput: { light: 'full-sun' },
    });
    usePlacementsStore.setState({ placements: [], selectedId: null });
  });

  it('renders an export button', () => {
    render(<PlotCanvasSection canvasWarnings={null} />);

    expect(screen.getByRole('button', { name: /export image/i })).toBeTruthy();
  });

  it("clicking it triggers export.ts's pipeline with the current placements and resolved conditions", async () => {
    usePlacementsStore.setState({
      placements: [{ id: 'placement-1', plant: ONION, x: 10, y: 10 }],
      selectedId: null,
    });

    render(<PlotCanvasSection canvasWarnings={null} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export image/i }));
    });

    expect(exportPlotImage).toHaveBeenCalledTimes(1);
    const [, placements, conditions] = vi.mocked(exportPlotImage).mock.calls[0];
    expect(placements).toEqual([{ id: 'placement-1', plant: ONION, x: 10, y: 10 }]);
    expect(conditions?.light).toBe('full-sun');
  });

  it('selects placements in order with the Previous/Next placement buttons, wrapping around (Workplan Stage 6.2)', () => {
    const OTHER: Plant = validatePlant({
      id: 'lettuce',
      commonName: 'Lettuce',
      scientificName: 'Lactuca sativa',
      gbifId: null,
      category: 'vegetable',
      light: 'full-sun',
      spacing: { row: { inRowCm: 10, betweenRowCm: 30 } },
      provenance: { sources: [{ source: 'hand-written test fixture' }] },
    });
    usePlacementsStore.setState({
      placements: [
        { id: 'placement-1', plant: ONION, x: 10, y: 10 },
        { id: 'placement-2', plant: OTHER, x: 20, y: 20 },
      ],
      selectedId: null,
    });

    render(<PlotCanvasSection canvasWarnings={null} />);

    // Nothing selected yet: "Next" starts at the first placement.
    fireEvent.click(screen.getByRole('button', { name: /next placement/i }));
    expect(usePlacementsStore.getState().selectedId).toBe('placement-1');

    fireEvent.click(screen.getByRole('button', { name: /next placement/i }));
    expect(usePlacementsStore.getState().selectedId).toBe('placement-2');

    // Wraps back around to the first.
    fireEvent.click(screen.getByRole('button', { name: /next placement/i }));
    expect(usePlacementsStore.getState().selectedId).toBe('placement-1');

    // Previous wraps the other way.
    fireEvent.click(screen.getByRole('button', { name: /previous placement/i }));
    expect(usePlacementsStore.getState().selectedId).toBe('placement-2');
  });

  it('does not render the Previous/Next placement buttons when nothing is placed', () => {
    render(<PlotCanvasSection canvasWarnings={null} />);
    expect(screen.queryByRole('button', { name: /next placement/i })).toBeNull();
  });

  it('reports conditions as null to the pipeline when they fail to resolve', async () => {
    // A soil block with every facet cleared fails `PlotSoilSchema`'s refine rule.
    usePlotStore.setState({
      region: rectangleRegion(300, 200),
      conditionsInput: { light: 'full-sun', soil: {} },
    });

    render(<PlotCanvasSection canvasWarnings={null} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export image/i }));
    });

    const [, , conditions] = vi.mocked(exportPlotImage).mock.calls[0];
    expect(conditions).toBeNull();
  });
});
