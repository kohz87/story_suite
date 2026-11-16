// Reads one skill and one item entry of a character file into clean copies.

import { KINDS, RARITIES } from '../../domains/inventory.js';
import { GEAR, slotWordOf } from '../../domains/gear.js';
import { CREATION, STATS, USES } from '../names.js';
import { FILE_LIMITS } from './limits.js';
import { isRecord, line, whole } from './shared-reading.js';

export function readSkill(entry) {
    if (!isRecord(entry)) return null;
    const name = line(entry.name, CREATION.skillName);
    // A skill with no stat (an old Skills block had none) is read without one: both a missing key and null mean "none"; any other value is not valid.
    const hasStat = entry.stat !== undefined && entry.stat !== null;
    if (!name || (hasStat && !STATS.includes(entry.stat)) || !USES.includes(entry.uses) || !whole(entry.rank, 0, FILE_LIMITS.rank)) return null;
    return { name, about: line(entry.about, CREATION.skillAbout), ...(hasStat ? { stat: entry.stat } : {}), uses: entry.uses, rank: entry.rank, ...(entry.type === 'utility' ? { type: 'utility' } : {}) };
}

export function readItem(entry) {
    if (!isRecord(entry)) return null;
    const name = line(entry.name, FILE_LIMITS.itemName);
    if (!name || !whole(entry.qty, 1, FILE_LIMITS.qty)) return null;
    const note = line(entry.note, FILE_LIMITS.itemNote);
    // A kind or rarity this build does not know is left out, so the thing is added as the inventory would add it.
    // A piece set up by hand (Equipment) also keeps its slot and its bonus (at most the stats a piece may give, each a whole number), so it comes back as it was.
    const kind = KINDS.includes(entry.kind) ? entry.kind : null;
    const slot = kind === 'equipment' && typeof entry.slot === 'string' ? slotWordOf(entry.slot) : null;
    const given = kind === 'equipment' && isRecord(entry.stats) ? Object.entries(entry.stats) : [];
    const stats = given.length && given.length <= GEAR.maxStats && given.every(([key, value]) => GEAR.stats.includes(key) && whole(value, 1, 6)) ? Object.fromEntries(given) : null;
    // The carry the reader set on it: a whole 1..500, else left out (an older file has none).
    return { name, qty: entry.qty, ...(note ? { note } : {}), ...(kind ? { kind } : {}), ...(RARITIES.includes(entry.rarity) ? { rarity: entry.rarity } : {}),
        ...(slot ? { slot } : {}), ...(stats ? { stats } : {}), ...(whole(entry.carry, 1, FILE_LIMITS.carry) ? { carry: entry.carry } : {}) };
}
