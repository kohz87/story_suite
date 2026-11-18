// Runs the game's own pack checker (packs/validate.js validatePack) on the pack text and groups what it says by Studio part.
//
// checkText(text) → `{ ok, errors, warnings, byPart: { <part id>: [{ code, path, message, level, part, rec }] }, total }`. The Studio never
// checks a pack any other way, so it cannot pass a pack the game would refuse or refuse one the game would take.

import { validatePack } from '../packs/validate.js';
import { partOfPath } from './parts.js';

const tag = level => problem => ({ ...problem, level, ...partOfPath(problem.path) });

/** Checks `text` (the pack.json as written). */
export function checkText(text) {
    const result = validatePack(String(text ?? ''));
    const errors = (result.errors ?? []).map(tag('error'));
    const warnings = (result.warnings ?? []).map(tag('warning'));
    const byPart = {};
    for (const problem of [...errors, ...warnings]) (byPart[problem.part] ??= []).push(problem);
    return { ok: result.ok === true, errors, warnings, byPart, total: errors.length + warnings.length };
}
