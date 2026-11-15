// The skill sets on offer, built in and from packs, and a set's card line.

import { SKILL_SETS } from '../../templates.js';
import { RPG_STRINGS, fill } from '../../strings.js';
import { isRecord } from './shared-helpers.js';

const W = RPG_STRINGS.wizard;

/**
 * The skill sets on offer: the built-in ones, then each pack's (`packSets` = the `packs.content` records of kind rpg, each with
 * its pack id; `packNames` maps a pack id to its name). → [{ id, name, about, skills, source: 'Built in' | 'From the X pack', builtIn }]
 */
export function skillSetsOf({ packSets = [], packNames = {} } = {}) {
    const built = SKILL_SETS.map(set => ({ ...set, builtIn: true, source: W.builtIn }));
    const fromPacks = (Array.isArray(packSets) ? packSets : []).filter(set => isRecord(set) && Array.isArray(set.skills) && typeof set.name === 'string')
        .map(set => ({ id: String(set.id ?? `${set.pack}/${set.slug}`), name: set.name, about: typeof set.about === 'string' ? set.about : '', skills: set.skills, builtIn: false,
            source: fill(W.fromPack, { pack: packNames[set.pack] || set.pack || '' }) }));
    return [...built, ...fromPacks];
}

/** "Short blade (AGI) · Iron Breath (VIT) · Spark (INT, mana)" for a set's card. */
export const setLine = set => set.skills.map(skill => `${skill.name} (${skill.stat.toUpperCase()}${skill.uses === 'mana' ? ', mana' : ''})`).join(' · ');
