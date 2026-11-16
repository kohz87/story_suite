// What a hero's own skills say about how it fights: the attack, area and heal skill (each with its own stat) and the one stance skill.
// A skill's stat decides its pool (INT or WIS draws MP, any other stat SP: skills.js) and whether its hit is magic; nothing is keyed by a build name.

import { V1 } from './numbers.js';
import { skillCost } from './skills.js';

const SKILL = V1.skill;
const statOf = skill => String((typeof skill === 'object' ? skill?.stat ?? skill?.statN : '') ?? '').trim().toLowerCase();

/** The hero's skills as `{ name, type, stat }` (type as skills.js reads it, stat lower case, '' when none): each entry may be a skill record or a type name. */
export function skillsOf(actor) {
    return (Array.isArray(actor?.skills) ? actor.skills : []).filter(skill => skill !== null && skill !== undefined).map(skill => ({
        name: typeof skill === 'object' ? String(skill?.name ?? '') : '', type: skillCost(skill).type, stat: statOf(skill),
    }));
}

const asAttack = skill => (skill ? { stat: skill.stat || 'str', magic: SKILL.magicStats.includes(skill.stat) } : null);

/**
 * `{ attack, area, heal, stance }`: the first skill of each type. attack and area are `{ stat, magic }` (null when the hero has none: it then
 * strikes with the normal attack), heal is `{ stat }` or null, stance is `{ type, stat }` or null (a stance type owns the stance slot).
 */
export function profileOf(actor) {
    const list = skillsOf(actor), first = type => list.find(skill => skill.type === type) ?? null;
    const stance = list.find(skill => skillCost(skill).kind === 'stance') ?? null, heal = first('heal');
    return {
        attack: asAttack(first('attack')), area: asAttack(first('area')), heal: heal ? { stat: heal.stat || 'wis' } : null,
        stance: stance ? { type: stance.type, stat: stance.stat || 'agi' } : null,
    };
}
