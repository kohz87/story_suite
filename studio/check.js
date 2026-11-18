// Runs the game's own pack checker (packs/validate.js validatePack) on the pack text and files what it says under Studio parts.
//
// checkText(text) → `{ ok, errors, warnings, byPart: { <part id>: [{ code, path, message, level, part, rec, field }] }, total }`, filed
// as format 3 is; checkPack(text, { kind, legacy }) the same, filed by a format 4 pack's own kind. `field` is the path below the record
// (`content.cast[3].secrets[1].gate` → `['secrets', 1, 'gate']`), which Go to and F8 open the editor at; null when the problem is not
// inside a record. The Studio never checks a pack any other way, so it cannot pass a pack the game would refuse or refuse one it takes.

import { validatePack } from '../packs/validate.js';
import { partOfPath } from './parts.js';

// `content.cast[3].secrets[1].gate` → ['content', 'cast', 3, 'secrets', 1, 'gate'].
export const pathSteps = path => [...String(path ?? '').matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map(m => (m[2] !== undefined ? Number(m[2]) : m[1]));

const fieldOf = (path, rec) => (rec ? pathSteps(path).slice(3) : null);

function filed(result, kind) {
    const tag = level => problem => {
        const at = partOfPath(problem.path, kind);
        return { ...problem, level, ...at, field: fieldOf(problem.path, at.rec) };
    };
    const errors = (result.errors ?? []).map(tag('error'));
    const warnings = (result.warnings ?? []).map(tag('warning'));
    const byPart = {};
    for (const problem of [...errors, ...warnings]) (byPart[problem.part] ??= []).push(problem);
    return { ok: result.ok === true, errors, warnings, byPart, total: errors.length + warnings.length };
}

/** Checks `text` (the pack.json as written), filing the problems as for a format 3 pack. */
export function checkText(text) {
    return filed(validatePack(String(text ?? '')), undefined);
}

/** Checks `text` and files the problems by the pack's kind (`legacy`: format 3 filing). */
export function checkPack(text, { kind = 'world', legacy = false } = {}) {
    return filed(validatePack(String(text ?? '')), legacy ? undefined : kind);
}
