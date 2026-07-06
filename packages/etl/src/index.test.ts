import { describe, it, expect } from 'vitest';
import { runPipeline } from './index';

// Scaffold smoke test. The real pipeline gets a hard-fail validation-gate test
// in Stage 1.5 (WORKPLAN.md §1.1) that proves malformed data never ships.
describe('etl scaffold', () => {
  it('reports a ready status', () => {
    expect(runPipeline()).toContain('ready');
  });
});
