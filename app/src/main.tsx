import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

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

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
