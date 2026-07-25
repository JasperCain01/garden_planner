/**
 * The index route. Through Stage 3.1 this was a placeholder proving the app
 * shell, engine wiring, and dataset-loading layer worked; Stage 3.2 replaces
 * that content with the real first step of `DESIGN.md`'s core loop — defining
 * the plot — since a second nav link with the placeholder still at `/` would
 * leave the actual entry point to the app behind a click. The component stays
 * named `Home` because it's still what the router's index route renders; the
 * real content lives in `../plot/PlotDefinitionPage.tsx`.
 */

import { PlotDefinitionPage } from '../plot/PlotDefinitionPage.tsx';

export function Home() {
  return <PlotDefinitionPage />;
}
