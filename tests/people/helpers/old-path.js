// Finds a file by the name it had in the old NPC State package folder (a flat folder: `core.js`, `src/x.js`, `runtime-settings-parts/y.js`),
// where the layout rules put it now. Source-reading tests and harnesses still name files the old way.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { atEitherLayout } from '../../../scripts/release/layout-paths.mjs';

const REPO = path.resolve(import.meta.dirname, '../../..');

// Files the layout rules put under modules/people/legacy/ that later left it (B4-5: the old dossier panel's survivors), by their old name.
const MOVED_LATER = Object.freeze({
    'dossier-tools-core.js': 'modules/people/tools/tools-core.js',
    'dossier-tools.js': 'modules/people/tools/data-tools.js',
    'dossier-experience.js': 'modules/people/tools/editor-refine.js',
    'dossier-experience-styles.js': 'modules/people/tools/editor-styles.js',
    'continuity-ui.js': 'modules/people/tools/continuity-ui.js',
    'calendar-settings.js': 'modules/people/settings/calendar-settings.js',
    'scanner-output-ui.js': 'modules/people/settings/scanner-output.js',
});

// Whole families that left modules/people/legacy/ later (B4-7), with their part folders: old name prefix → new folder.
const MOVED_FAMILIES = Object.freeze([
    ['calendar', 'modules/people/calendar/'],
    ['src/relationship-pa', 'modules/people/relationship/'],
]);

/** `rel` (from the old package folder) → the absolute path of that file or folder in this repo. */
export const oldPath = rel => {
    const name = String(rel).replace(/\/$/, '');
    if (Object.hasOwn(MOVED_LATER, name)) return path.join(REPO, MOVED_LATER[name]);
    for (const [prefix, folder] of MOVED_FAMILIES) {
        if (name.startsWith(prefix)) return path.join(REPO, folder, name.replace(/^src\//, ''));
    }
    return path.join(REPO, atEitherLayout(REPO, path.posix.join('packages/npc-state-delta', name)));
};

/** The same as a file URL (a trailing slash is kept for a folder). */
export const oldUrl = rel => new URL(pathToFileURL(oldPath(rel)).href + (String(rel).endsWith('/') ? '/' : ''));
