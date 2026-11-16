// The text of a file as it read in the old flat NPC State package folder: every relative import specifier is written the old way
// (`./src/fields/registry.js`, `./index.js`), so a test that pins how a file imports its neighbours keeps its assertion unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { oldLocation } from '../../../scripts/release/layout-paths.mjs';
import { oldPath } from './old-path.js';

const REPO = path.resolve(import.meta.dirname, '../../..');
const PKG = 'packages/npc-state-delta';

/** The old package-relative name of a repo-relative file in the new layout (a file no rule moved keeps its name). */
const oldName = oldLocation;

/** `rel` (a name from the old package folder) → that file's text with each relative import written as in the old folder. */
export function oldSource(rel) {
    const file = oldPath(rel);
    const text = fs.readFileSync(file, 'utf8');
    const fromRel = path.relative(REPO, file).split(path.sep).join('/');
    const oldHere = path.posix.join(PKG, String(rel));
    return text.replace(/((?:from\s*|import\s*\(\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g, (all, head, spec, tail) => {
        const target = path.posix.join(path.posix.dirname(fromRel), spec);
        if (!fs.existsSync(path.join(REPO, target))) return all;
        const old = oldName(target);
        const relative = path.posix.relative(path.posix.dirname(oldHere), old.startsWith('packages/') ? old : path.posix.join(PKG, old));
        return `${head}${relative.startsWith('.') ? relative : `./${relative}`}${tail}`;
    });
}

/** Every file of the old package folder that now sits under modules/people/: { old name (package-relative, posix) → absolute path }. */
export function oldInventory() {
    const names = new Map();
    const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(abs); continue; }
            const old = oldName(path.relative(REPO, abs).split(path.sep).join('/'));
            if (old.startsWith(`${PKG}/`)) names.set(old.slice(PKG.length + 1), abs);
        }
    };
    walk(path.join(REPO, 'modules/people'));
    return names;
}
