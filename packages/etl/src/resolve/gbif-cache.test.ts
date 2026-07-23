import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadCache, normalizeQuery, saveCache, type NameCache } from './gbif-cache';

// These tests exercise real file I/O against a throwaway temp directory (never
// the committed `packages/etl/cache/` file), which is fine offline-first-wise:
// the *cache mechanics* aren't a network concern, only the resolver's calls to
// GBIF are. That network boundary is tested separately in gbif-resolver.test.ts.
describe('gbif-cache', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gbif-cache-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('normalizeQuery', () => {
    it('lowercases and trims so equivalent queries share a cache key', () => {
      expect(normalizeQuery('Onion')).toBe('onion');
      expect(normalizeQuery('  Onion  ')).toBe('onion');
      expect(normalizeQuery('ONION')).toBe(normalizeQuery('onion'));
    });
  });

  describe('loadCache', () => {
    it('returns an empty cache when the file does not exist yet', () => {
      const path = join(dir, 'does-not-exist.json');
      expect(loadCache(path)).toEqual({});
    });

    it('round-trips a cache written by saveCache', () => {
      const path = join(dir, 'cache.json');
      const cache: NameCache = {
        onion: {
          status: 'resolved',
          gbifId: 1000001,
          scientificName: 'Allium cepa',
          matchType: 'EXACT',
          confidence: 98,
        },
        'not-a-real-plant': { status: 'unresolved' },
      };

      saveCache(path, cache);
      expect(loadCache(path)).toEqual(cache);
    });
  });

  describe('saveCache', () => {
    it('writes keys in sorted order for stable diffs', () => {
      const path = join(dir, 'sorted.json');
      saveCache(path, {
        tomato: { status: 'unresolved' },
        carrot: { status: 'unresolved' },
        onion: { status: 'unresolved' },
      });

      const written = loadCache(path);
      expect(Object.keys(written)).toEqual(['carrot', 'onion', 'tomato']);
    });

    it('creates the parent directory if it does not exist', () => {
      const path = join(dir, 'nested', 'cache.json');
      saveCache(path, { onion: { status: 'unresolved' } });
      expect(loadCache(path)).toEqual({ onion: { status: 'unresolved' } });
    });
  });
});
