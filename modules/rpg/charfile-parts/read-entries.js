// Reads one skill and one item entry of a character file into clean copies.

import { KINDS, RARITIES } from '../../inventory/index.js';
import { GEAR, gearStatKey, slotWordOf } from '../../inventory/gear.js';
import { CREATION, STATS_V1, USES } from '../names.js';
import { typeKey } from '../../../core/runtime/skill-slots.js';
import { FILE_LIMITS } from './limits.js';
import { isRecord, line, whole } from './shared-reading.js';

export function readSkill(entry) {
    if (!isRecord(entry)) return null;
    const name = line(entry.name, CREATION.skillName);
    // A skill with no stat (an old Skills block had none) is read without one: both a missing key and null mean "none"; any other value is not valid.
    const hasStat = entry.stat !== undefined && entry.stat !== null;
    // (a skill of a file written before Combat Rules v1 has `uses` and may name LUK, which is read as WIS; a v1 skill has a `type` and no `uses`)
    const stat = entry.stat === 'luk' ? 'wis' : entry.stat;
    if (!name || (hasStat && !STATS_V1.includes(stat)) || (entry.uses !== undefined && !USES.includes(entry.uses)) || !whole(entry.rank, 0, FILE_LIMITS.rank)) return null;
    return { name, about: line(entry.about, CREATION.skillAbout), ...(hasStat ? { stat } : {}), uses: entry.uses ?? USES[0], rank: entry.rank, ...typeKey(entry.type) };
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
    // (a file from before gear's sixth stat was WIS names it LUK: read as WIS, a LUK and a WIS beside each other adding up)
    const given = kind === 'equipment' && isRecord(entry.stats) ? Object.entries(entry.stats).map(([key, value]) => [gearStatKey(key) === 'WIS' && key !== 'WIS' ? 'WIS' : key, value]) : [];
    const sound = given.length && given.every(([key, value]) => GEAR.stats.includes(key) && whole(value, 1, 6));
    const summed = sound ? given.reduce((out, [key, value]) => ({ ...out, [key]: (out[key] ?? 0) + value }), {}) : null;
    // (a LUK and a WIS that add up past 6 are held to 6, not dropped)
    const stats = summed && Object.keys(summed).length <= GEAR.maxStats ? Object.fromEntries(Object.entries(summed).map(([key, value]) => [key, Math.min(6, value)])) : null;
    // The carry the reader set on it: a whole 1..500, else left out (an older file has none).
    return { name, qty: entry.qty, ...(note ? { note } : {}), ...(kind ? { kind } : {}), ...(RARITIES.includes(entry.rarity) ? { rarity: entry.rarity } : {}),
        ...(slot ? { slot } : {}), ...(stats ? { stats } : {}), ...(whole(entry.carry, 1, FILE_LIMITS.carry) ? { carry: entry.carry } : {}) };
}
