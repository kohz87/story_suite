// Finds the module checkouts that sit next to each other in a folder, by their usual folder names.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** The checkout folder names, for `discoverRoots`. */
export const FOLDERS = { sb: 'Story_block', sd: 'Story_director', nsd: 'npc_state_delta' };

/**
 * The checkouts next to each other in `base`, by their usual folder names (Story Block's folder may
 * also be `sb`): { sb?, sd?, nsd? } with the ones that exist.
 */
export function discoverRoots(base) {
    const roots = {};
    for (const [key, folder] of Object.entries(FOLDERS)) {
        for (const name of key === 'sb' ? [folder, 'sb'] : [folder]) {
            const path = resolve(base, name);
            if (existsSync(path)) { roots[key] = path; break; }
        }
    }
    return roots;
}
