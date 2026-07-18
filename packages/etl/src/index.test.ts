import { describe, expect, it } from 'vitest';
import { CACHE_PATH, main } from './index';

// This suite deliberately never calls main() — main() uses the real,
// fetch-backed GBIF transport, and unit tests must never touch the network
// (see docs/adr/0005-gbif-name-resolver.md). The resolve-and-cache logic main()
// wires together is covered against a stub transport in
// resolve/gbif-resolver.test.ts and pipeline/run.test.ts; this just checks the
// entry point is wired to the right cache file.
describe('etl entry point', () => {
  it('points the committed cache at packages/etl/cache/gbif-name-cache.json', () => {
    expect(CACHE_PATH.replaceAll('\\', '/')).toMatch(
      /packages\/etl\/cache\/gbif-name-cache\.json$/,
    );
  });

  it('exports a runnable main function', () => {
    expect(typeof main).toBe('function');
  });
});
