import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

// Component smoke test: proves the app renders and that the engine wiring works
// end-to-end (the engine's status string reaches the DOM). Real UI behaviour is
// tested from Stage 3.1 onward.
describe('App shell', () => {
  it('renders the title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /garden planner/i })).toBeTruthy();
  });

  it('shows the engine status (cross-workspace wiring works)', () => {
    render(<App />);
    expect(screen.getByText(/engine scaffold ready/i)).toBeTruthy();
  });
});
