// Holds parsed groups to the Foes block's rules and the party's level cap.
import { FOE_LEVEL, foeLevelCap, partyLevels } from '../../foes.js';
import { PRECHECK_LIMITS } from './prompt.js';
import { isObject, nameKey, namedInMessage, oneLine } from './shared-words.js';
import { sizeGroups, tierWord } from './v1-sizing.js';

const WHOLE = /\d+(?:\.\d+)?/u;
const limitOf = (limits, keys, fallback, low = 1) => {
    for (const key of keys) {
        const value = limits?.[key];
        if (Number.isInteger(value) && value >= low) return value;
    }
    return fallback;
};

const NUMBER_WORDS = new Map([['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5], ['six', 6],
    ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10], ['eleven', 11], ['twelve', 12]]);
const UNITS = new Map([['dozen', 12], ['score', 20], ['hundred', 100], ['thousand', 1000]]);

function countOf(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    const text = oneLine(value).toLowerCase().replace(/,/gu, '');
    if (!text) return null;
    const match = /^(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(dozen|score|hundred|thousand)s?$/u.exec(text);
    if (match) {
        const amount = /^\d+$/u.test(match[1]) ? Number(match[1]) : match[1] === 'a' || match[1] === 'an' ? 1 : NUMBER_WORDS.get(match[1]);
        return amount * UNITS.get(match[2]);
    }
    const plain = WHOLE.exec(text);
    return plain && plain.index === 0 ? Math.trunc(Number(plain[0])) : null;
}

function levelOf(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    const text = oneLine(value).replace(/^(?:level|lv\.?)\s*/iu, '');
    return /^\d+$/u.test(text) ? Number(text) : null;
}

/**
 * Vets parsed groups for an opening. `limits` may narrow `{ groups, count, name, levelMin, levelMax }`; its defaults are
 * `PRECHECK_LIMITS` and the Foes rules (a count above the Foes block's maximum refuses every group). Name words may come from `message` or `previous`. A level, when given, is held to 1..99 and to the party's highest + 20.
 * `stated(name)` (stated-level.js, read by the caller BEFORE recording) gives a person's own Level: `{ level }` or a rank band `{ rank, from, to }`; it passes the cap and wins over the model's level, and the band is drawn later from the reply's seed.
 *
 * `v1`: the sheet is a Combat Rules v1 one: each group also carries its `tier` (standard when the answer names none or an unknown one) and the groups are cut to the size rule (v1-sizing.js).
 * → `[{ name, count, level? } | { name, count, rank, from, to }]`, in the exact form `openFoes` takes; a missing or invalid level is the party's top level (held to the same cap), never a random draw.
 */
export function vetGroups(groups, { message = '', previous = '', sheet = null, limits = null, stated = null, v1 = false } = {}) {
    const out = list => (v1 ? sizeGroups(list) : list);   // (a Combat Rules v1 sheet: each group names its tier and the fight is held to the size rule, parts/v1-sizing.js)
    // `tierSaid` is the pre-check's raw tier answer (diagnostic only: kept in the record's setup, never shown or sent), so a "standard" it chose differs from the fallback (null).
    const tiered = group => (v1 ? { tier: tierWord(group.tier), tierSaid: typeof group.tier === 'string' && group.tier.trim() ? group.tier.trim().slice(0, 40) : null } : {});
    if (!Array.isArray(groups)) return [];
    const maxGroups = limitOf(limits, ['groups', 'maxGroups'], PRECHECK_LIMITS.groups);
    const maxCount = limitOf(limits, ['count', 'maxCount'], PRECHECK_LIMITS.count);
    const maxName = limitOf(limits, ['name', 'maxName'], PRECHECK_LIMITS.name);
    const levelMin = limitOf(limits, ['levelMin', 'minLevel', 'min'], FOE_LEVEL.min);
    const levelMax = Math.min(FOE_LEVEL.max, limitOf(limits, ['levelMax', 'maxLevel', 'max'], FOE_LEVEL.max));
    const cap = Math.max(levelMin, Math.min(levelMax, foeLevelCap(partyLevels(sheet))));
    const topLevel = Math.max(FOE_LEVEL.min, ...partyLevels(sheet));
    const known = new Set((sheet?.foes ?? []).map(foe => oneLine(foe?.name)).filter(Boolean).map(nameKey));
    const seen = new Set();
    const accepted = [];
    for (const group of groups) {
        if (accepted.length >= maxGroups) break;
        if (!isObject(group)) continue;
        const name = oneLine(group.name).slice(0, maxName).trim();
        const key = nameKey(name);
        if (!name || !key || known.has(key) || seen.has(key) || !namedInMessage(name, message, previous)) continue;
        seen.add(key);
        const rawCount = countOf(group.count);
        if (Number.isInteger(rawCount) && rawCount > maxCount) return []; // a group past the block's maximum: refuse the whole reading, the send goes plain
        const count = Math.max(1, Number.isInteger(rawCount) ? rawCount : 1);
        let given = null;
        // One person's Level: a group of several ("Vorn's men") is not that person, and keeps the normal rules.
        try { given = count === 1 && typeof stated === 'function' ? stated(name) : null; } catch { given = null; }
        if (given && Number.isInteger(given.level)) { accepted.push({ name, count, ...tiered(group), level: Math.max(FOE_LEVEL.min, Math.min(FOE_LEVEL.max, given.level)) }); continue; }
        if (given && typeof given.rank === 'string' && Number.isInteger(given.from) && Number.isInteger(given.to) && given.from <= given.to) { accepted.push({ name, count, ...tiered(group), rank: given.rank, from: given.from, to: given.to }); continue; }
        const rawLevel = levelOf(group.level);
        const level = Math.max(levelMin, Math.min(cap, Number.isInteger(rawLevel) ? rawLevel : topLevel));
        accepted.push({ name, count, ...tiered(group), level });
    }
    return out(accepted);
}
