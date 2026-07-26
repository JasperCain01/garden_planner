/**
 * Stage 4.1 icon generator — a developer tool, not part of the shipped app
 * (mirrors `packages/etl`'s "build-time only" convention). Run it with:
 *
 *   node --experimental-strip-types tools/icons/generate.ts
 *
 * It reads `data/plants.json`, resolves each crop's archetype from
 * `classification.ts`, renders the archetype (`archetypes.ts`) with the
 * crop's category colour (`colors.ts`), optimizes the result with SVGO, and
 * writes one `.svg` file per crop into `app/src/icons/crops/`, plus the
 * generic fallback into `app/src/icons/generic.svg`.
 *
 * Re-run this whenever `classification.ts` changes, a new archetype is added,
 * or the dataset gains a crop — see `docs/icon-style-guide.md` "Adding an
 * icon for a new crop".
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { optimize } from 'svgo';

import { ARCHETYPES, svgShell, seedlingArchetype, type ArchetypeKey } from './archetypes.ts';
import { CROP_ARCHETYPES } from './classification.ts';
import { CATEGORY_FILL, FALLBACK_FILL, INK } from './colors.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const datasetPath = path.join(repoRoot, 'data', 'plants.json');
const cropsOutDir = path.join(repoRoot, 'app', 'src', 'icons', 'crops');
const genericOutPath = path.join(repoRoot, 'app', 'src', 'icons', 'generic.svg');

interface PlantRecord {
  id: string;
  category: 'vegetable' | 'fruit' | 'herb';
}

interface PlantsArtifact {
  plants: PlantRecord[];
}

function optimizeSvg(markup: string): string {
  const result = optimize(markup, { multipass: true });
  return result.data;
}

function main(): void {
  const { plants } = JSON.parse(readFileSync(datasetPath, 'utf8')) as PlantsArtifact;

  // Fail loudly (build-time gate, same spirit as the ETL's hard-fail
  // validation) if the classification map and the dataset have drifted apart
  // in either direction — a silent gap here means a crop ships with no icon.
  const datasetIds = new Set(plants.map((p) => p.id));
  const classifiedIds = new Set(Object.keys(CROP_ARCHETYPES));

  const missing = [...datasetIds].filter((id) => !classifiedIds.has(id));
  if (missing.length > 0) {
    throw new Error(
      `${missing.length} shipped crop(s) have no archetype in classification.ts: ${missing.join(', ')}`,
    );
  }
  const stale = [...classifiedIds].filter((id) => !datasetIds.has(id));
  if (stale.length > 0) {
    throw new Error(
      `classification.ts references ${stale.length} id(s) no longer in data/plants.json: ${stale.join(', ')}`,
    );
  }

  mkdirSync(cropsOutDir, { recursive: true });
  // Clear stale files so a removed crop's old icon doesn't linger.
  for (const existing of readdirSync(cropsOutDir)) {
    rmSync(path.join(cropsOutDir, existing));
  }

  let totalBytes = 0;
  for (const plant of plants) {
    const archetypeKey: ArchetypeKey = CROP_ARCHETYPES[plant.id];
    const build = ARCHETYPES[archetypeKey];
    const fill = CATEGORY_FILL[plant.category];
    const raw = svgShell(build(fill, INK));
    const optimized = optimizeSvg(raw);
    const outPath = path.join(cropsOutDir, `${plant.id}.svg`);
    writeFileSync(outPath, optimized, 'utf8');
    totalBytes += Buffer.byteLength(optimized, 'utf8');
  }

  const genericRaw = svgShell(seedlingArchetype(FALLBACK_FILL, INK));
  const genericOptimized = optimizeSvg(genericRaw);
  writeFileSync(genericOutPath, genericOptimized, 'utf8');
  totalBytes += Buffer.byteLength(genericOptimized, 'utf8');

  const count = plants.length + 1;
  console.log(`Wrote ${count} icons (${plants.length} crops + 1 fallback).`);
  console.log(`Total optimized payload: ${(totalBytes / 1024).toFixed(1)} KB`);
  console.log(`Average per icon: ${(totalBytes / count).toFixed(0)} bytes`);
}

main();
