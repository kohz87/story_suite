// Checking terms, ranks and name lists.

import { LIMITS, TERMS_FIELDS, TERMS_LIMITS, TERM_SEPARATORS, TERMS_TIER_FIELDS, TERMS_NUMERALS, RANKS_LIMITS, RANK_FIELDS, RANK_ID, NAMES_FIELDS, NAMES_LIMITS, SLUG } from '../../limits.js';
import { oneLine, foldKey } from '../../../../../../../core/text.js';
import { isObject, slugify, isInt } from '../core.js';

// A record of display terms gets the slug from its `id`, else its name, else `terms`, `terms-2` … in
// file order (a pack usually has one).
export function termsSlug() {
    let count = 0;
    return record => {
        const named = typeof record.name === 'string' ? slugify(record.name) : '';
        if (named) return named;
        count += 1;
        return count === 1 ? 'terms' : `terms-${count}`;
    };
}

// The words a world uses for levels and XP (MODULES §F25), for a consuming module:
// `{ id?, name?, levelName?, xpName?, tiers?: true | { size?, numerals?, enabled? } }`. The reader's
// own terms win over these. A term is a label in a module's blocks, so it may not hold `| : # < >`
// or a line break; checkPlain has already refused any markup or script link in it.
export function checkTerms(record, path, label, add) {
    let ok = true;
    const say = (field, message, code = 'BAD_RECORD') => { ok = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
    for (const key of Object.keys(record)) if (!TERMS_FIELDS.includes(key)) say(key, `"${key}" is not a terms field (expected ${TERMS_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
    if (record.name !== undefined && (typeof record.name !== 'string' || !record.name.trim() || record.name.length > LIMITS.name)) say('name', `name must be text of 1 to ${LIMITS.name} characters.`);
    const out = {};
    if (typeof record.name === 'string') out.name = oneLine(record.name, LIMITS.name);
    for (const [field, word, example] of [['levelName', 'level', 'Soul Class'], ['xpName', 'XP', 'Soul Growth']]) {
        const value = record[field];
        if (value === undefined) continue;
        if (typeof value !== 'string' || !value.trim() || oneLine(value).length > TERMS_LIMITS.term) say(field, `${field} must be the ${word} word, 1 to ${TERMS_LIMITS.term} characters (like "${example}").`);
        else if (TERM_SEPARATORS.test(value)) say(field, `${field} may not hold | : # < > or a line break (it is a label in the story's blocks).`);
        else out[field] = oneLine(value);
    }
    const tiers = record.tiers;
    if (tiers !== undefined) {
        if (tiers === true) out.tiers = true;
        else if (!isObject(tiers)) say('tiers', 'tiers must be true or { "size": 10, "numerals": "roman" } (levels grouped into titled tiers).');
        else {
            for (const key of Object.keys(tiers)) if (!TERMS_TIER_FIELDS.includes(key)) say(`tiers.${key}`, `"${key}" is not a tiers field (expected ${TERMS_TIER_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
            if (tiers.size !== undefined && (!isInt(tiers.size, 1) || tiers.size > TERMS_LIMITS.tierSize)) say('tiers.size', `tiers.size must be a whole number of levels from 1 to ${TERMS_LIMITS.tierSize}.`);
            if (tiers.numerals !== undefined && !TERMS_NUMERALS.includes(tiers.numerals)) say('tiers.numerals', `tiers.numerals must be ${TERMS_NUMERALS.map(word => `"${word}"`).join(' or ')}.`);
            if (tiers.enabled !== undefined && tiers.enabled !== false) say('tiers.enabled', 'tiers.enabled can only be false (to switch tiers off); leave it out otherwise.');
            out.tiers = { ...tiers };
        }
    }
    if (ok && out.levelName === undefined && out.xpName === undefined && out.tiers === undefined) {
        ok = false;
        add('BAD_RECORD', path, `${label}: a terms record suggests at least one of levelName, xpName or tiers.`);
    }
    return ok ? out : null;
}

// A ladder of ranks, lowest first for a module that reads them. The id is
// the rank as the story writes it ('F', 'SS'), kept as given and unique ignoring case, not a slug;
// `levels`, `reward` and `xp` are whole-number ranges, the reward in units of the chat's one currency and the xp (2.5.0, optional,
// at most RANKS_LIMITS.xp) the experience a job of the rank may give.
// A rank never starts below the one before it, so a ladder written highest first is caught.
export function checkRanks(list, packId, add) {
    if (!Array.isArray(list)) {
        add('BAD_CONTENT', 'content.ranks', 'content.ranks must be a list of ranks, lowest first: [{ "id": "F" }, { "id": "E" }].');
        return [];
    }
    if (list.length > RANKS_LIMITS.records) {
        add('BAD_CONTENT', 'content.ranks', `content.ranks holds at most ${RANKS_LIMITS.records} ranks.`);
        return [];
    }
    const out = [];
    const seen = new Set();
    let ok = true;
    // The last rank (id and range) that gave levels, the last that gave a reward and the last that gave xp.
    const last = { levels: null, reward: null, xp: null };
    list.forEach((record, index) => {
        const path = `content.ranks[${index}]`;
        if (!isObject(record)) { ok = false; return add('BAD_RECORD', path, `${path} must be an object like { "id": "F", "title": "Registered" }.`); }
        const label = typeof record.id === 'string' ? `Rank "${record.id}"` : path;
        let good = true;
        const say = (field, message, code = 'BAD_RECORD') => { good = false; add(code, `${path}.${field}`, `${label}: ${message}`); };
        for (const key of Object.keys(record)) if (!RANK_FIELDS.includes(key)) say(key, `"${key}" is not a rank field (expected ${RANK_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
        if (typeof record.id !== 'string' || !RANK_ID.test(record.id)) say('id', 'id must be 1 to 8 letters, digits, + or -, the rank as the story writes it (like "F" or "SS").');
        else if (seen.has(foldKey(record.id))) say('id', `"${record.id}" repeats an earlier rank's id (ids are unique, ignoring case).`, 'DUPLICATE');
        else seen.add(foldKey(record.id));
        const title = record.title;
        if (title !== undefined) {
            if (typeof title !== 'string' || !title.trim() || oneLine(title).length > RANKS_LIMITS.title) say('title', `title must be text of 1 to ${RANKS_LIMITS.title} characters (like "Journeyman").`);
            else if (TERM_SEPARATORS.test(title)) say('title', 'title may not hold | : # < > or a line break.');
        }
        const range = (field, min, max, words) => {
            const value = record[field];
            if (value === undefined) return null;
            if (!Array.isArray(value) || value.length !== 2 || !value.every(n => isInt(n, min) && n <= max) || value[0] > value[1]) {
                say(field, `${field} must be [lowest, highest]: two ${words}, the first not above the second.`);
                return null;
            }
            return [value[0], value[1]];
        };
        const levels = range('levels', 1, RANKS_LIMITS.level, `whole levels from 1 to ${RANKS_LIMITS.level}`);
        const reward = range('reward', 0, Number.MAX_SAFE_INTEGER, 'whole amounts of 0 or more of the chat\'s currency');
        const xp = range('xp', 0, RANKS_LIMITS.xp, `whole amounts of experience from 0 to ${RANKS_LIMITS.xp.toLocaleString('en-US')}`);
        if (!good) { ok = false; return; }
        const rank = { id: record.id, ...(title !== undefined ? { title: oneLine(title) } : {}), ...(levels ? { levels } : {}), ...(reward ? { reward } : {}), ...(xp ? { xp } : {}), pack: packId };
        for (const field of ['levels', 'reward', 'xp']) {
            if (!rank[field]) continue;
            const before = last[field];
            if (before && rank[field][0] < before.range[0]) {
                ok = false;
                add('BAD_RECORD', `${path}.${field}`, `${label}: ranks go from lowest to highest, but its ${field} start below rank "${before.id}"'s.`);
            }
            last[field] = { id: rank.id, range: rank[field] };
        }
        out.push(rank);
    });
    return ok ? out : [];
}

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
