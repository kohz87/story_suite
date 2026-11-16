// Reads the layout rule files of every area (kept apart from the tool's command line so a light caller does not load the source parser).
import fs from 'node:fs';
import path from 'node:path';
import { loadRules } from './rules.mjs';

export const AREAS = ['core', 'director', 'legacy-ui', 'packs', 'people', 'rpg', 'scene-inventory', 'shared'];
export const DEFAULT_RULES_DIR = path.join(import.meta.dirname, 'layout');

/** Reads every `*.rules.json` in `rulesDir`, sorted by area, and refuses a folder that lacks one of the eight areas. */
export function loadLayoutRules(rulesDir = DEFAULT_RULES_DIR) {
  const sets = fs.readdirSync(rulesDir)
    .filter(name => name.endsWith('.rules.json'))
    .sort()
    .map(name => loadRules(path.join(rulesDir, name)));
  const areas = sets.map(set => set.area).sort();
  if (JSON.stringify(areas) !== JSON.stringify([...AREAS].sort())) {
    throw new Error(`layout rule files must cover exactly: ${AREAS.join(', ')} (found: ${areas.join(', ') || 'none'})`);
  }
  return sets;
}
