import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

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
