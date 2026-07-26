import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUserPlantsStore } from '../state/user-plants-store.ts';
import { UserCropsSection } from './UserCropsSection.tsx';

function addCherryBelle() {
  fireEvent.change(screen.getByLabelText(/name \(from the packet\)/i), {
    target: { value: "Radish 'Cherry Belle'" },
  });
  fireEvent.change(screen.getByLabelText(/^category$/i), { target: { value: 'vegetable' } });
  fireEvent.change(screen.getByLabelText(/light requirement/i), {
    target: { value: 'full-sun' },
  });
  fireEvent.change(screen.getByLabelText(/in-row spacing/i), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText(/between-row spacing/i), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: /add crop/i }));
}

describe('UserCropsSection', () => {
  beforeEach(() => {
    useUserPlantsStore.setState({ userPlants: {} });
  });

  it('adds a submitted crop to the store and lists it with edit/remove affordances', () => {
    render(<UserCropsSection />);

    addCherryBelle();

    expect(useUserPlantsStore.getState().userPlants['user-radish-cherry-belle']).toBeTruthy();
    const item = screen.getByText("Radish 'Cherry Belle'").closest('li');
    expect(item).toBeTruthy();
    expect(within(item as HTMLElement).getByRole('button', { name: /edit/i })).toBeTruthy();
    expect(within(item as HTMLElement).getByRole('button', { name: /remove/i })).toBeTruthy();
  });

  it('removes a crop from the overlay when "Remove" is clicked', () => {
    render(<UserCropsSection />);
    addCherryBelle();

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    expect(useUserPlantsStore.getState().userPlants).toEqual({});
    expect(screen.queryByText("Radish 'Cherry Belle'")).toBeNull();
  });

  it('pre-fills the form in edit mode and re-submitting replaces the same overlay entry', () => {
    render(<UserCropsSection />);
    addCherryBelle();

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    // Pre-filled with the existing crop's data.
    expect(screen.getByLabelText(/name \(from the packet\)/i)).toHaveProperty(
      'value',
      "Radish 'Cherry Belle'",
    );

    // Change the in-row spacing and save.
    fireEvent.change(screen.getByLabelText(/in-row spacing/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    const overlay = useUserPlantsStore.getState().userPlants;
    expect(Object.keys(overlay)).toEqual(['user-radish-cherry-belle']);
    expect(overlay['user-radish-cherry-belle'].spacing).toEqual({
      row: { inRowCm: 5, betweenRowCm: 20 },
    });
  });

  it('cancels an in-progress edit without changing the stored crop', () => {
    render(<UserCropsSection />);
    addCherryBelle();

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText(/in-row spacing/i), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    const overlay = useUserPlantsStore.getState().userPlants;
    expect(overlay['user-radish-cherry-belle'].spacing).toEqual({
      row: { inRowCm: 3, betweenRowCm: 20 },
    });
    // Back to the blank "add" form.
    expect(screen.getByLabelText(/name \(from the packet\)/i)).toHaveProperty('value', '');
  });
});
