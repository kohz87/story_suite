// A fake extension folder for the synthetic host, built the way the old tests built it from the flat package folder: every file of the
// old folder (or the names asked for) is there under its old name, as a one-line module that loads the real file where the layout rules
// put it. The real files import their neighbours by their new paths, so they cannot be copied apart.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { oldInventory } from './old-source.js';

/** A module body that re-exports `real` (an absolute path); `default` too when the file has one. */
export function standInSource(real) {
    const url = JSON.stringify(pathToFileURL(real).href);
    if (!/\.js$/.test(real)) return fs.readFileSync(real);
    const hasDefault = /export\s+default\b|export\s*\{[^}]*\bdefault\b/.test(fs.readFileSync(real, 'utf8'));
    return `export * from ${url};\n${hasDefault ? `export { default } from ${url};\n` : ''}`;
}

/** Writes stand-ins for the old-folder files into `dest` under their old names; `only` (a test on the old name) narrows it. */
export function standInTree(dest, only = () => true) {
    for (const [name, real] of oldInventory()) {
        if (!only(name)) continue;
        const target = path.join(dest, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, standInSource(real));
    }
}
