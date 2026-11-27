// The people domain's keyed holder `bonds/npcs` (replay rule i, core/ops/holders.js): a person's meter record as a replay remakes it
// when the reply that first made it was deleted and a later reply still writes under it. It is what NPC State's first change of the
// person makes (meter-parts/records.js ensure: the name, the meters, empty stages, ladder and milestones), read from the slice alone so
// a replay never depends on the settings: the dossier's name, and its relationship numbers as the built-in meters (a meter it does not
// give reads as the meter's start). Someone with no dossier in the slice is not remade (the later block fails as before).
import { BUILT_IN_METERS, BUILT_IN_RANGE } from '../meters/npc-meters-config-parts/built-in-meters.js';

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** The meter record replay remakes for person `key` from the people slice before the block, or null. */
export function remakeBond(key, slice) {
    const dossier = isObject(slice?.npcs) && isObject(slice.npcs[key]) ? slice.npcs[key] : null;
    const name = typeof dossier?.name === 'string' ? dossier.name.trim() : '';
    if (!name) return null;
    const meters = {};
    for (const { id } of BUILT_IN_METERS) {
        const value = dossier.relationship?.[id];
        if (Number.isSafeInteger(value)) meters[id] = Math.min(BUILT_IN_RANGE.max, Math.max(BUILT_IN_RANGE.min, value));
    }
    return { name, meters, stages: {}, unlocked: [], milestones: {} };
}
