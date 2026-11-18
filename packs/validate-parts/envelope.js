// The job: the format 4 envelope: `kind`, `recommends`, the top-level fields, and which `content` keys each kind may hold (with "belongs in a … pack" pointers).

import { CONTENT_KEYS, MOVED_TOP_FIELDS, PACK_FIELDS_V4, PACK_ID, PACK_KINDS } from '../limits.js';
import { parseRange } from '../version.js';
import { isObject } from '../validate/core.js';

const OTHER = { world: 'game', game: 'world' };
// A legacy kind the world pack replaced (format 3 `events`).
const LEGACY_POINTERS = { events: 'legacy dated events are gone; use worldEvents in a world pack.' };

/** Top-level fields of a format 4 pack: unknown ones are refused, format 3 ones that moved say where. */
export function checkTopFields4(raw, add) {
    for (const key of Object.keys(raw)) {
        if (PACK_FIELDS_V4.includes(key)) continue;
        if (MOVED_TOP_FIELDS[key]) add('UNKNOWN_FIELD', key, `"${key}" ${MOVED_TOP_FIELDS[key]}`);
        else add('UNKNOWN_FIELD', key, `"${key}" is not a pack field (expected ${PACK_FIELDS_V4.join(', ')}).`);
    }
}

/** `kind` ("world" or "game", required) and `recommends` (a world pack's suggested game). Returns { kind, recommends }; `kind` is null when it is not usable. */
export function checkKindFields(raw, add) {
    const kind = PACK_KINDS.includes(raw.kind) ? raw.kind : null;
    if (!kind) add('BAD_KIND', 'kind', `kind must be "world" or "game" (it says ${JSON.stringify(raw.kind) ?? 'nothing'}).`);
    let recommends = null;
    if (raw.recommends !== undefined) {
        if (kind === 'game') add('UNKNOWN_FIELD', 'recommends', '"recommends" belongs in a world pack: a game pack does not suggest anything.');
        else recommends = checkRecommends(raw.recommends, add);
    }
    return { kind, recommends };
}

function checkRecommends(value, add) {
    const bad = message => { add('BAD_FIELD', 'recommends', message); return null; };
    if (!isObject(value)) return bad('recommends must be { "game": { "id": "…", "version": "^1" } }.');
    for (const key of Object.keys(value)) if (key !== 'game') add('UNKNOWN_FIELD', `recommends.${key}`, `"${key}" is not a recommends field (expected game).`);
    const game = value.game;
    if (!isObject(game)) return bad('recommends.game must be { "id": "…", "version": "^1" }.');
    for (const key of Object.keys(game)) if (key !== 'id' && key !== 'version') add('UNKNOWN_FIELD', `recommends.game.${key}`, `"${key}" is not a recommends.game field (expected id, version).`);
    if (typeof game.id !== 'string' || !PACK_ID.test(game.id)) return bad('recommends.game.id must be a pack id (1 to 40 lowercase letters, digits or dashes).');
    if (typeof game.version !== 'string' || !parseRange(game.version)) return bad('recommends.game.version must be a version range like "^1".');
    return { game: { id: game.id, version: game.version } };
}

/** The `content` keys of a format 4 pack: each must belong to its kind. Returns the given content cut down to the keys the kind may hold. */
export function checkContentKeys(kind, given, add) {
    const kept = {};
    for (const key of Object.keys(given)) {
        if (kind && CONTENT_KEYS[kind].includes(key)) kept[key] = given[key];
        else if (kind && CONTENT_KEYS[OTHER[kind]].includes(key)) add('UNKNOWN_KIND', `content.${key}`, `"${key}" belongs in a ${OTHER[kind]} pack, not in a ${kind} pack.`);
        else if (LEGACY_POINTERS[key]) add('UNKNOWN_KIND', `content.${key}`, `"${key}": ${LEGACY_POINTERS[key]}`);
        else add('UNKNOWN_KIND', `content.${key}`, kind ? `"${key}" is not a content key of a ${kind} pack (expected ${CONTENT_KEYS[kind].join(', ')}).` : `"${key}" cannot be checked until kind says world or game.`);
    }
    return kept;
}
