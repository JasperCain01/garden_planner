import { describe, it, expect } from 'vitest';
import { ENGINE_READY, engineStatus } from './index';

// Smoke tests for the scaffold. These are replaced by the real golden-case and
// property-based suites in Phase 2 (see WORKPLAN.md §1.2), but they already prove
// the engine package builds and is unit-testable in isolation.
describe('engine scaffold', () => {
  it('is wired in', () => {
    expect(ENGINE_READY).toBe(true);
  });

  it('reports a ready status', () => {
    expect(engineStatus()).toContain('ready');
  });
});
