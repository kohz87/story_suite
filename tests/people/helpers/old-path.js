// Finds a file by the name it had in the old NPC State package folder (a flat folder: `core.js`, `src/x.js`, `runtime-settings-parts/y.js`),
// where the layout rules put it now. Source-reading tests and harnesses still name files the old way.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { atEitherLayout } from '../../../scripts/release/layout-paths.mjs';

const REPO = path.resolve(import.meta.dirname, '../../..');

/** `rel` (from the old package folder) → the absolute path of that file or folder in this repo. */
export const oldPath = rel => path.join(REPO, atEitherLayout(REPO, path.posix.join('packages/npc-state-delta', String(rel).replace(/\/$/, ''))));

/** The same as a file URL (a trailing slash is kept for a folder). */
export const oldUrl = rel => new URL(pathToFileURL(oldPath(rel)).href + (String(rel).endsWith('/') ? '/' : ''));
