import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { restoreDesigns } from './state/designs-store.ts';

// The design system (UI redesign Phase 0, see `styles/tokens.css` and ADR
// 0029), loaded once here rather than from any component: `fonts.css` declares
// the one self-hosted webfont, `tokens.css` defines every colour/space/type
// value the app is allowed to spend, and `global.css` restyles the HTML
// primitives (buttons, inputs, fieldsets) in terms of those tokens. Order
// matters — the token definitions must be parsed before the rules that use
// them. Per-component layout lives in that component's own `*.module.css`.
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';

// Mount point defined in index.html. Non-null assertion is safe because the
// element is part of the static HTML shell shipped with the app.
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

// The saved design, read back before the first render (UI redesign Phase 5).
//
// Here rather than in an effect, and before `render` rather than after, because
// both halves of that are observable: a restore that ran in an effect would
// paint the default 3×2m bed and replace it a frame later, and one that ran
// asynchronously would race the canvas's first measurement. It can be
// synchronous because everything it needs is local — `localStorage` is a
// synchronous API and the crop list it resolves placements against is a bundled
// import — which is also why it works with the network off, as the service
// worker means a reload frequently has none. See `state/designs-store.ts`.
restoreDesigns();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
