import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { UserPlantInput } from '@garden-planner/engine';
import { useUserPlantsStore } from '../state/user-plants-store.ts';
import { AddCropDialog } from './AddCropDialog.tsx';

const CHERRY_BELLE: UserPlantInput = {
  commonName: "Radish 'Cherry Belle'",
  category: 'vegetable',
  light: 'full-sun',
  spacing: { row: { inRowCm: 3, betweenRowCm: 20 } },
};

/**
 * The Phase 1 relocation this covers: "Add your own crop" is a dialog off the
 * plants sidebar, not ~800px of page between the palette and the canvas. The
 * form's own behaviour is `AddCropForm.test.tsx`/`UserCropsSection.test.tsx`'s
 * job and is untouched — what's new is that it should be *absent* until asked
 * for, which is the whole point of moving it.
 */
describe('AddCropDialog', () => {
  beforeEach(() => {
    useUserPlantsStore.setState({ userPlants: {} });
  });

  it('keeps the add-crop form out of the page until the trigger is pressed', () => {
    render(<AddCropDialog />);

    expect(screen.queryByLabelText(/name \(from the packet\)/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /add your own crop/i }));

    expect(screen.getByLabelText(/name \(from the packet\)/i)).toBeTruthy();
  });

  it('closes again on the dialog’s close button', () => {
    render(<AddCropDialog />);

    fireEvent.click(screen.getByRole('button', { name: /^＋ add your own crop$/i }));
    fireEvent.click(screen.getByRole('button', { name: /close add your own crop/i }));

    expect(screen.queryByLabelText(/name \(from the packet\)/i)).toBeNull();
  });

  it('says how many of your own crops exist — the one thing the in-page section gave away for free', () => {
    render(<AddCropDialog />);

    expect(screen.queryByText(/of your own crop/i)).toBeNull();

    act(() => {
      useUserPlantsStore.getState().addUserPlant(CHERRY_BELLE);
    });

    expect(screen.getByText(/1 of your own crop is in the list above/i)).toBeTruthy();
  });
});
