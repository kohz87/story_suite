// A member's skills as the Party tab's sheet lists them (the `rpg.sheet` query's `skills`): kind, stat, cost, rank and mastery from the Combat Rules v1 tables.
import { rankOf, skillCost } from './combat/skills.js';

const GLYPH = Object.freeze({ attack: 'atk', area: 'area', magic: 'bolt', heal: 'heal', stance: 'stance' });
const RESOURCE = Object.freeze({ sp: 'stamina', mp: 'mana' });
const MAGIC = Object.freeze(['int', 'wis']);

/** The tab's kind for a priced skill: a stance is a stance, an attack on INT or WIS is magic, the rest keep their name (utility has no kind of its own: it reads as the attack it is next to, its `line` says so). */
function kindOf(price, stat) {
    if (price.kind === 'stance') return 'stance';
    if (price.type === 'heal') return 'heal';
    if (price.type === 'area') return 'area';
    return MAGIC.includes(stat) ? 'magic' : 'attack';
}

/**
 * `skillsOf` rows (party-data-parts/skills.js) of a member at `level` → [{ glyph, name, kind, stat, resource, cost, rank, mastery, line? }]. The rank is the one the practice and the level
 * allow (combat/skills.js rankOf), `mastery` its 1..7 step. A utility skill costs nothing and is story-only, so its `line` is given ready-made.
 */
export function sheetSkills(skills, level) {
    return (Array.isArray(skills) ? skills : []).map(skill => {
        const price = skillCost(skill), stat = typeof skill.stat === 'string' ? skill.stat : '', rank = rankOf(skill.practice, level), kind = kindOf(price, stat);
        return {
            glyph: GLYPH[kind], name: skill.name, kind, stat: stat.toUpperCase(), resource: RESOURCE[price.pool] ?? 'stamina', cost: price.cost, rank: rank.name, mastery: rank.mastery,
            ...(price.type === 'utility' ? { line: `Utility · ${stat.toUpperCase()} · story only` } : {}),
        };
    });
}
