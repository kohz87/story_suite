// Imports each matrix module's definition builder from its checkout and sorts the missing and broken ones.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MODULES, ORDER } from './scripts.js';

/**
 * Imports each module's definition builder from its checkout. `roots`: { sd?, nsd? } (paths);
 * `entries`: { sd?, nsd? } overrides of the entry file inside a checkout (the modules' wiring
 * moves between releases). A module that is not given, or whose checkout is not there, is `missing`
 * with a sentence; a checkout that does not import is `broken` (that fails its rows, it is not skipped).
 * → { loaded: { key: { ...MODULES[key], root, imported, make(ref) } }, missing: { key: sentence }, broken: { key: error } }
 */
export async function loadModules(roots = {}, entries = {}) {
    const loaded = {};
    const missing = {};
    const broken = {};
    for (const key of ORDER) {
        const spec = MODULES[key];
        const root = roots[key] ? resolve(roots[key]) : null;
        const file = root ? join(root, entries[key] ?? spec.entry) : null;
        if (!root) { missing[key] = `no ${spec.dir} checkout given`; continue; }
        if (!existsSync(file)) { missing[key] = `${file} is not there`; continue; }
        try {
            const imported = await import(pathToFileURL(file).href);
            loaded[key] = { ...spec, root, imported, make: ref => spec.make(imported, ref) };
        } catch (error) {
            broken[key] = error;
        }
    }
    return { loaded, missing, broken };
}
