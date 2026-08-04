import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  validatePlant,
  type AntagonistAdjacencyWarning,
  type CompanionSuggestion,
  type OvercrowdingWarning,
  type Plant,
} from '@garden-planner/engine';
import { WarningsPanel } from './WarningsPanel.tsx';

function plantWith(id: string, commonName: string): Plant {
  return validatePlant({
    id,
    commonName,
    scientificName: 'Testus fixturus',
    gbifId: null,
    category: 'vegetable',
    light: 'full-sun',
    spacing: { row: { inRowCm: 10, betweenRowCm: 10 } },
    provenance: { sources: [{ source: 'hand-written test fixture' }] },
  });
}

const GARLIC = plantWith('garlic', 'Garlic');

const ANTAGONIST_WARNING: AntagonistAdjacencyWarning = {
  kind: 'antagonist-adjacency',
  severity: 'severe',
  subjects: [
    { placementId: 'potato-1', plantId: 'potato' },
    { placementId: 'tomato-1', plantId: 'tomato' },
  ],
  evidence: 'well-supported',
  distanceCm: 10,
  thresholdCm: 75,
  reason:
    'Potato and tomato are known to grow poorly together, and here they are only 10 cm apart.',
};

const SUGGESTION: CompanionSuggestion = {
  forPlacementId: 'onion-1',
  forPlantId: 'onion',
  suggestedPlantId: 'garlic',
  evidence: 'traditional',
  reason: 'Gardeners traditionally say onion grows well alongside garlic.',
};

/** A second, less urgent warning — enough to check that the badge row orders by severity rather than by arrival. */
const INFO_WARNING: OvercrowdingWarning = {
  kind: 'overcrowded',
  severity: 'info',
  subjects: [{ placementId: 'onion-1', plantId: 'onion' }],
  plantedCount: 12,
  maxCount: 10,
  spacingSource: 'recorded',
  reason: 'You have placed 12 onions where this bed fits about 10.',
};

describe('WarningsPanel', () => {
  it('shows reassuring copy when there is nothing to report', () => {
    render(
      <WarningsPanel warnings={[]} suggestions={[]} plants={[]} onFocusPlacement={() => {}} />,
    );

    expect(screen.getByText(/no problems — looking good/i)).toBeTruthy();
    expect(screen.getByText(/no companion suggestions/i)).toBeTruthy();
  });

  it("shows a warning's severity and reason verbatim, and focuses its placement on request", () => {
    const onFocusPlacement = vi.fn();
    render(
      <WarningsPanel
        warnings={[ANTAGONIST_WARNING]}
        suggestions={[]}
        plants={[]}
        onFocusPlacement={onFocusPlacement}
      />,
    );

    // UI redesign Phase 4 replaced the uppercase severity *word* with the same
    // glyph the canvas badges the marker with — so the assertion is on the
    // accessible name, which is where the word went, not on the drawing.
    expect(screen.getAllByRole('img', { name: 'severe' }).length).toBeGreaterThan(0);
    expect(screen.getByText(ANTAGONIST_WARNING.reason)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /show me/i }));
    // The warning's first subject — the same placement `PlotCanvas.tsx` badges.
    expect(onFocusPlacement).toHaveBeenCalledWith('potato-1');
  });

  it('counts the warnings by severity, most urgent first (UI redesign Phase 4)', () => {
    render(
      <WarningsPanel
        warnings={[INFO_WARNING, ANTAGONIST_WARNING]}
        suggestions={[]}
        plants={[]}
        onFocusPlacement={() => {}}
      />,
    );

    // The dock's list scrolls when it is full; these badges are what stays on
    // screen, so their order is the summary a user reads at a glance.
    const badges = screen.getAllByLabelText(/^\d+ (severe|warning|info)$/);
    expect(badges.map((badge) => badge.getAttribute('aria-label'))).toEqual(['1 severe', '1 info']);
  });

  it("resolves a suggestion's bare plant id to its display name and evidence tag", () => {
    const onFocusPlacement = vi.fn();
    render(
      <WarningsPanel
        warnings={[]}
        suggestions={[SUGGESTION]}
        plants={[GARLIC]}
        onFocusPlacement={onFocusPlacement}
      />,
    );

    expect(screen.getByText('Garlic')).toBeTruthy();
    expect(screen.getByText('Traditional')).toBeTruthy();
    expect(screen.getByText(SUGGESTION.reason)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /show me/i }));
    expect(onFocusPlacement).toHaveBeenCalledWith('onion-1');
  });

  it("falls back to the bare id if a suggested plant isn't in the current runtime plant list", () => {
    render(
      <WarningsPanel
        warnings={[]}
        suggestions={[SUGGESTION]}
        plants={[]}
        onFocusPlacement={() => {}}
      />,
    );

    expect(screen.getByText('garlic')).toBeTruthy();
  });
});
