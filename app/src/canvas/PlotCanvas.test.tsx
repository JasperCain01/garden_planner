import { render } from '@testing-library/react';
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

    // Stage div should be present (react-konva renders a div wrapper).
    const stageDiv = container.querySelector('div[style*="border"]');
    expect(stageDiv).toBeTruthy();
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

    const stageDiv = container.querySelector('div[style*="border"]');
    expect(stageDiv).toBeTruthy();
  });
});
