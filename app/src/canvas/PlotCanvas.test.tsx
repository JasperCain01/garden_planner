import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { rectangleRegion, type Plant } from '@garden-planner/engine';
import { usePlacementsStore } from '../state/placements-store.ts';
import { PlotCanvas } from './PlotCanvas.tsx';

/**
 * A shipped crop with an icon that resolves (e.g. onion).
 * Stage 4.2 tests focus on icon rendering, verified by E2E tests since Konva
 * renders to canvas which jsdom can't inspect. Component tests here just verify
 * the component renders without error when placements are present.
 */
const ONION: Plant = {
  id: 'onion',
  commonName: 'Onion',
  scientificName: 'Allium cepa',
  gbifId: 4346,
  category: 'vegetable',
  light: 'full-sun',
  spacing: { row: { inRowCm: 10, betweenRowCm: 20 } },
  hardiness: { rhsRating: 'H3' },
  icon: undefined, // Falls back to id
  provenance: {
    sources: [{ source: 'test-fixture' }],
  },
};

/**
 * A user-defined crop with no icon, which should render the generic fallback.
 */
const USER_CROP: Plant = {
  id: 'user-mystery-squash',
  commonName: 'Mystery Squash',
  scientificName: 'Cucurbita sp.',
  gbifId: null,
  category: 'vegetable',
  light: 'full-sun',
  spacing: { row: { inRowCm: 30, betweenRowCm: 60 } },
  hardiness: { rhsRating: 'H2' },
  icon: undefined, // No icon set, no matching id
  provenance: {
    sources: [{ source: 'user-entered' }],
  },
};

describe('PlotCanvas icon rendering (Stage 4.2)', () => {
  beforeEach(() => {
    usePlacementsStore.setState({ placements: [], selectedId: null });
  });

  it('renders when a placed crop icon is present', () => {
    // Add a placed onion to the store.
    usePlacementsStore.setState({
      placements: [
        {
          id: '1',
          plant: ONION,
          x: 100,
          y: 100,
        },
      ],
    });

    // Render should not throw; the icon is loaded async via useIconImage hook.
    const { container } = render(
      <PlotCanvas region={rectangleRegion(300, 300)} severityByPlacementId={new Map()} />,
    );

    // The drop-target container (which wraps react-konva's own div) should be
    // present. Queried by its id rather than its styling: since UI redesign
    // Phase 0 the border lives in `PlotCanvas.module.css`, not an inline style.
    expect(container.querySelector('#plot-canvas')).toBeTruthy();
  });

  it('renders when a placed user-defined crop with generic fallback icon is present', () => {
    usePlacementsStore.setState({
      placements: [
        {
          id: '2',
          plant: USER_CROP,
          x: 150,
          y: 150,
        },
      ],
    });

    // Should render without error even for a user crop with no shipped icon.
    const { container } = render(
      <PlotCanvas region={rectangleRegion(300, 300)} severityByPlacementId={new Map()} />,
    );

    expect(container.querySelector('#plot-canvas')).toBeTruthy();
  });
});

describe('PlotCanvas keyboard nudge (Workplan Stage 6.2)', () => {
  beforeEach(() => {
    usePlacementsStore.setState({
      placements: [{ id: 'placement-1', plant: ONION, x: 100, y: 100 }],
      selectedId: 'placement-1',
    });
  });

  function pressKey(key: string, options?: { shiftKey?: boolean }): void {
    const canvas = screen.getByLabelText(/plot canvas/i);
    fireEvent.keyDown(canvas, { key, ...options });
  }

  it('nudges the selected placement by 10cm per arrow-key press', () => {
    render(<PlotCanvas region={rectangleRegion(300, 300)} severityByPlacementId={new Map()} />);

    pressKey('ArrowRight');
    expect(usePlacementsStore.getState().placements[0]).toMatchObject({ x: 110, y: 100 });

    pressKey('ArrowDown');
    expect(usePlacementsStore.getState().placements[0]).toMatchObject({ x: 110, y: 110 });
  });

  it('nudges by 50cm when Shift is held, for crossing a large plot without dozens of presses', () => {
    render(<PlotCanvas region={rectangleRegion(300, 300)} severityByPlacementId={new Map()} />);

    pressKey('ArrowRight', { shiftKey: true });
    expect(usePlacementsStore.getState().placements[0]).toMatchObject({ x: 150, y: 100 });
  });

  it('clamps a nudge to the region bounding box rather than moving the placement outside it', () => {
    usePlacementsStore.setState({
      placements: [{ id: 'placement-1', plant: ONION, x: 295, y: 100 }],
      selectedId: 'placement-1',
    });
    render(<PlotCanvas region={rectangleRegion(300, 300)} severityByPlacementId={new Map()} />);

    pressKey('ArrowRight');
    expect(usePlacementsStore.getState().placements[0]).toMatchObject({ x: 300, y: 100 });
  });

  it('does nothing on an arrow key when nothing is selected', () => {
    usePlacementsStore.setState({
      placements: [{ id: 'placement-1', plant: ONION, x: 100, y: 100 }],
      selectedId: null,
    });
    render(<PlotCanvas region={rectangleRegion(300, 300)} severityByPlacementId={new Map()} />);

    pressKey('ArrowRight');
    expect(usePlacementsStore.getState().placements[0]).toMatchObject({ x: 100, y: 100 });
  });
});
