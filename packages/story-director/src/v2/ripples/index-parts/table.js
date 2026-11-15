// Validates a pack's ripples section into a table of powers, tiers, caps and directions.

import { DEFAULT_TIERS, DEFAULT_CAPS } from './defaults.js';
import { MAX_POWERS, MAX_LIST, MAX_NAME } from './shared-limits.js';
import { text, fold, cut, list } from './shared-text.js';
import { isObject, whole } from './shared-numbers.js';

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Short text lists: trimmed, de-duplicated (case-folded), at most MAX_LIST entries. */
function namesOf(raw, problems, where) {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) {
        problems.push(`${where} is not a list`);
        return [];
    }
    const out = [];
    for (const item of raw.slice(0, MAX_LIST)) {
        const value = cut(text(item), MAX_NAME);
        if (value && !out.some(seen => fold(seen) === fold(value))) out.push(value);
    }
    return out;
}

/** Whole-number settings: each key of `defaults` read from `raw` (bad values keep the default, with a Problem). */
function numbersOf(raw, defaults, max, problems, where) {
    const out = { ...defaults };
    if (raw === undefined || raw === null) return out;
    if (!isObject(raw)) {
        problems.push(`${where} is not an object`);
        return out;
    }
    for (const key of Object.keys(defaults)) {
        if (raw[key] === undefined) continue;
        if (whole(raw[key], max)) out[key] = raw[key];
        else problems.push(`${where}.${key} must be a whole number 0..${max}`);
    }
    return out;
}

/** One power of the section, or null with a Problem. */
function powerOf(raw, index, seen, problems) {
    const where = `ripples.powers[${index}]`;
    if (!isObject(raw)) return problems.push(`${where} is not an object`), null;
    const id = text(raw.id);
    if (!SLUG.test(id)) return problems.push(`${where}.id must be a lowercase slug`), null;
    if (seen.has(id)) return problems.push(`${where}.id "${id}" is repeated`), null;
    const name = cut(text(raw.name), MAX_NAME);
    if (!name) return problems.push(`${where}.name is missing`), null;
    if (!whole(raw.base, 100)) return problems.push(`${where}.base must be a whole number 0..100`), null;
    const npcs = [];
    for (const item of list(raw.npcs).slice(0, MAX_LIST)) {
        const npc = isObject(item) ? { name: cut(text(item.name), MAX_NAME), weight: item.weight ?? 1 } : null;
        if (!npc?.name || !whole(npc.weight, 3) || npc.weight < 1) {
            problems.push(`${where}.npcs: an entry needs a name and a weight 1..3`);
            continue;
        }
        npcs.push(npc);
    }
    seen.add(id);
    return {
        id,
        name,
        aliases: namesOf(raw.aliases, problems, `${where}.aliases`),
        factions: namesOf(raw.factions, problems, `${where}.factions`),
        givers: namesOf(raw.givers, problems, `${where}.givers`),
        npcs,
        base: raw.base,
        standing: text(raw.standing) || null,
        standingBase: Number.isSafeInteger(raw.standingBase) ? raw.standingBase : 0,
    };
}

/** The pack's world directions: `{ event, favours, unless }`, `favours` a power id of the table, `unless` words of a bad ending. */
function directionsOf(raw, powerIds, problems) {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) {
        problems.push('ripples.worldDirections is not a list');
        return [];
    }
    const out = [];
    for (const item of raw.slice(0, MAX_LIST)) {
        const event = isObject(item) ? cut(text(item.event), MAX_NAME) : '';
        const favours = isObject(item) ? text(item.favours) : '';
        if (!event || !powerIds.includes(favours)) {
            problems.push('ripples.worldDirections: an entry needs an event and the id of a power');
            continue;
        }
        out.push({ event, favours, unless: namesOf(item.unless, problems, 'ripples.worldDirections.unless') });
    }
    return out;
}

/**
 * Validates a pack's `ripples` section: `{ table, problems }`. `table` is `{ powers, tiers, caps, worldDirections }`
 * or null (no section, or nothing usable in it). `standingModule` names Story Block's standing data module. Never throws.
 */
export function validateRipples(section) {
    const problems = [];
    if (section === undefined || section === null) return { table: null, problems };
    if (!isObject(section)) return { table: null, problems: ['ripples: the section is not an object'] };
    if (!Array.isArray(section.powers)) return { table: null, problems: ['ripples.powers is not a list'] };
    if (section.powers.length > MAX_POWERS) problems.push(`ripples.powers has more than ${MAX_POWERS} entries; the rest are ignored`);
    const seen = new Set();
    const powers = [];
    section.powers.slice(0, MAX_POWERS).forEach((raw, index) => {
        const power = powerOf(raw, index, seen, problems);
        if (power) powers.push(power);
    });
    if (!powers.length) return { table: null, problems: [...problems, 'ripples: no usable power'] };
    const tiers = numbersOf(section.tiers, DEFAULT_TIERS, 50, problems, 'ripples.tiers');
    const caps = numbersOf(section.caps, DEFAULT_CAPS, 100, problems, 'ripples.caps');
    const worldDirections = directionsOf(section.worldDirections, powers.map(power => power.id), problems);
    const standingModule = cut(text(section.standingModule), MAX_NAME) || null;
    return { table: { powers, tiers, caps, worldDirections, standingModule }, problems };
}
