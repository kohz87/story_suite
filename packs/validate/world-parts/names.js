// Checking the name lists (`content.names`).

import { NAMES_FIELDS, NAMES_LIMITS, SLUG } from '../../limits.js';
import { oneLine, foldKey } from '../../../core/text.js';
import { isObject } from '../core.js';

// The name lists (`content.names`, limits.js NAMES_*): one object of culture id -> { regions, given, family? } plus an optional `banned`
// list. A culture id is a slug (not `banned`). Names are one line of at most NAMES_LIMITS.name characters, kept trimmed and
// de-duplicated ignoring case. Any problem is a pack Problem and the whole section is left out (null), like a bad weather table.
export function checkNames(names, add) {
    if (!isObject(names)) {
        add('BAD_CONTENT', 'content.names', 'content.names must be an object: { "banned": [ … ], "river": { "regions": [ … ], "given": [ … ] } }.');
        return null;
    }
    let ok = true;
    const say = (code, path, message) => { ok = false; add(code, path, message); };
    const list = (value, path, max, longest, what, min = 0) => {
        if (!Array.isArray(value) || value.length < min || value.length > max || value.some(item => typeof item !== 'string' || !oneLine(item) || [...oneLine(item)].length > longest)) {
            say('BAD_CONTENT', path, `${path} must be a list of ${min ? `1 to ${max}` : `at most ${max}`} ${what}, each 1 to ${longest} characters.`);
            return [];
        }
        const seen = new Set();
        return value.map(item => oneLine(item)).filter(item => !seen.has(foldKey(item)) && seen.add(foldKey(item)));
    };
    const out = {};
    if (names.banned !== undefined) out.banned = list(names.banned, 'content.names.banned', NAMES_LIMITS.banned, NAMES_LIMITS.bannedName, 'overused names');
    const ids = Object.keys(names).filter(key => key !== 'banned');
    if (ids.length > NAMES_LIMITS.cultures) say('BAD_CONTENT', 'content.names', `content.names holds at most ${NAMES_LIMITS.cultures} cultures.`);
    for (const id of ids) {
        const path = `content.names.${id}`;
        const culture = names[id];
        if (!SLUG.test(id) || id === 'names') say('BAD_CONTENT', path, `"${id}" is not a culture id (use a lowercase slug like "river"; "names" is reserved and "banned" is the list of overused names).`);
        if (!isObject(culture)) { say('BAD_CONTENT', path, `${path} must be an object: { "regions": [ … ], "given": [ … ] }.`); continue; }
        for (const key of Object.keys(culture)) if (!NAMES_FIELDS.includes(key)) say('UNKNOWN_FIELD', `${path}.${key}`, `"${key}" is not a names field (expected ${NAMES_FIELDS.join(', ')}).`);
        const regions = list(culture.regions, `${path}.regions`, NAMES_LIMITS.regions, NAMES_LIMITS.region, 'region names', 1);
        const given = list(culture.given, `${path}.given`, NAMES_LIMITS.given, NAMES_LIMITS.name, 'given names', 1);
        const family = culture.family === undefined ? null : list(culture.family, `${path}.family`, NAMES_LIMITS.family, NAMES_LIMITS.name, 'family names');
        out[id] = { regions, given, ...(family ? { family } : {}) };
    }
    return ok ? out : null;
}
