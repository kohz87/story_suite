// The encounter table for one place at one time: "nothing worth noting", the pack's backdrop people who belong here, the built-in
// backdrops of the place's group, and the met cast who are here and not in the scene. Weights by place class, time of day and the
// world conditions that hold here. Pure.

import { CONDITION_FACTOR } from './limits.js';
import { DEFAULT_BACKDROPS, QUIET_WEIGHTS } from './defaults.js';

const CAST_WEIGHT = 2;
const low = value => String(value ?? '').trim().toLowerCase();

/** The row's key in the ledger: a backdrop placed by name (`at`) is one person wherever they are; one placed by kind is one person per place. */
export const rowKey = (row, place) => (row.at?.length ? row.id : `${row.id}@${place.key}`);

function belongs(row, place) {
    const names = new Set([place.key, place.name, ...(place.aliases ?? [])].map(low).filter(Boolean));
    if (row.at?.length) return row.at.some(name => names.has(name));
    if (row.kinds?.length) return row.kinds.some(kind => kind === low(place.kind) || kind === low(place.klass));
    return (row.groups ?? []).includes(place.group);
}

function weightOf(row, conditions) {
    let weight = row.weight;
    for (const name of row.likelier ?? []) if (conditions.has(name)) weight *= CONDITION_FACTOR.likelier;
    for (const name of row.less ?? []) if (conditions.has(name)) weight *= CONDITION_FACTOR.less;
    return weight;
}

/**
 * The rows, in a fixed order (quiet, the pack's in pack order, the defaults, the cast in key order), each `{ ref, kind: 'quiet' | 'backdrop' |
 * 'cast', who, look, weight, recurring, source, seen, npc?, name? }`. `place` `{ key, name, aliases, kind, klass, group }`; `pack` the
 * normalized backdrop rows; `cast` `[{ key, name }]` (met, alive, here, not in the scene); `ledger` `{ seen, bound }`; `time` a part of the
 * day ('' reads as any); `conditions` the names that hold here; `present` the lower-cased names in the scene (a promoted person there is no row).
 */
export function encounterTable({ place, pack = [], cast = [], ledger = {}, time = '', conditions = [], present = new Set(), defaults = DEFAULT_BACKDROPS }) {
    const holding = new Set(conditions.map(low));
    const seen = ledger.seen ?? {};
    const bound = ledger.bound ?? {};
    const rows = [{ ref: 'quiet', kind: 'quiet', who: '', look: '', weight: QUIET_WEIGHTS[place.klass] ?? QUIET_WEIGHTS.town, recurring: false, source: 'quiet', seen: 0 }];
    for (const row of [...pack, ...defaults]) {
        if (!belongs(row, place) || (time && row.when?.length && !row.when.includes(time))) continue;
        const ref = rowKey(row, place);
        const binding = bound[ref];
        if (binding && present.has(low(binding.name))) continue;
        const weight = weightOf(row, holding);
        if (!(weight > 0)) continue;
        rows.push({ ref, kind: 'backdrop', who: row.who, look: row.look, weight, recurring: row.recurring, source: row.source, seen: row.recurring ? seen[ref]?.n ?? 0 : 0, ...(binding ? { npc: binding.key, name: binding.name } : {}) });
    }
    for (const person of [...cast].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) {
        if (present.has(low(person.name))) continue;
        rows.push({ ref: `cast:${person.key}`, kind: 'cast', who: person.name, look: '', weight: CAST_WEIGHT, recurring: false, source: 'cast', seen: 0, name: person.name });
    }
    return rows;
}
