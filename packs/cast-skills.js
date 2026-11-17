// A cast member's signature skills (`cast[].skills`, docs/v2/PACKS.md "The cast"): the skills a person brings when they join the party, in the order written.
// Pure: the enabled packs in, plain rows out. The seeding itself is data-modules/part.js (join and return).

import { foldKey, oneLine } from '../core/text.js';
import { typeKey } from '../core/runtime/skill-slots.js';
import { SKILL_RANKS_V1 } from './limits.js';

/** The ranks a pack writes, in order (the Skills block's rank numbers 0 to 6: Novice to Legend). */
export const CAST_SKILL_RANKS = SKILL_RANKS_V1;
// The older resource words the rest of the suite reads: a pack's `sp` is stamina and its `mp` mana.
const POOL_WORDS = Object.freeze({ sp: 'stamina', mp: 'mana', stamina: 'stamina', mana: 'mana' });

/**
 * The cast entry a name means (its name or an alias, folded) and its signature skills: `{ id, name, aliases, pack, skills: [{ name, about, stat, uses, rank, type? }] }`
 * (`rank` 0 to 6; `type` only on a skill that is not a plain attack), or null. `packs`: the enabled packs (`packs.packs()`); the first pack with the person wins.
 */
export function castSkillsOf(packs, name) {
    const key = foldKey(oneLine(name));
    if (!key) return null;
    for (const pack of Array.isArray(packs) ? packs : []) {
        const person = (pack?.content?.cast ?? []).find(entry => [entry.name, ...(entry.aliases ?? [])].some(each => foldKey(each) === key));
        if (!person) continue;
        const skills = (person.skills ?? []).map(skill => ({ name: skill.name, about: skill.about, stat: skill.stat, uses: POOL_WORDS[skill.uses] ?? 'stamina', rank: Math.max(0, CAST_SKILL_RANKS.indexOf(skill.rank ?? 'novice')), ...typeKey(skill.type) }));
        return { id: person.id, name: person.name, aliases: [...(person.aliases ?? [])], pack: pack.id, skills };
    }
    return null;
}
