/**
 * "Add your own crop", as a modal off the palette sidebar (UI redesign
 * Phase 1).
 *
 * Until this phase the whole capability sat *in the page flow*, unnumbered,
 * between the palette and the canvas — ~800px of prime mid-page real estate
 * for something used rarely, and 800px of extra distance between the palette
 * and the canvas it was sitting between (`docs/ui-aesthetic-review.md` §Part 1
 * and §"Phase 1"). The form itself was never the problem, so nothing about it
 * changes: this is a trigger button, a dialog, and the same
 * `UserCropsSection.tsx` inside it.
 *
 * **Why the button lives here and not in `PlantPalette.tsx`.** The palette's
 * job is ranking and showing the crops that exist; minting a new one is a
 * different job that happens to be reachable from the same sidebar. Keeping
 * them separate means the palette's own scrollport ends where the list ends,
 * and this button can stay pinned below it (see
 * `PlotDefinitionPage.module.css`'s plants column).
 *
 * The added-crop count under the button replaces something the in-page
 * section gave away for free: with the form on the page you could *see* your
 * crops listed. Behind a dialog you can't, so the sidebar says how many there
 * are and the dialog is where they're managed.
 */

import { useState } from 'react';
import { useUserPlantsStore } from '../state/user-plants-store.ts';
import { ModalDialog } from '../ui/ModalDialog.tsx';
import { UserCropsSection } from './UserCropsSection.tsx';
import styles from './AddCropDialog.module.css';

const TITLE = 'Add your own crop';

export function AddCropDialog() {
  const [open, setOpen] = useState(false);
  const cropCount = useUserPlantsStore((state) => Object.keys(state.userPlants).length);

  return (
    <div className={styles.wrapper}>
      <button type="button" onClick={() => setOpen(true)} className={styles.trigger}>
        ＋ {TITLE}
      </button>
      {cropCount > 0 && (
        <p className={styles.count}>
          {cropCount} of your own {cropCount === 1 ? 'crop is' : 'crops are'} in the list above.
        </p>
      )}
      <ModalDialog open={open} onClose={() => setOpen(false)} title={TITLE}>
        <UserCropsSection />
      </ModalDialog>
    </div>
  );
}
