// A member's skills as the Party tab's sheet lists them (the `rpg.sheet` query's `skills`): kind, stat, cost, rank and mastery from the Combat Rules v1 tables.
import { rankOf, skillCost } from './combat/skills.js';
import { V1, RANKS } from './combat/numbers.js';

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
 * `skillsOf` rows (party-data-parts/skills.js) of a member at `level` → [{ glyph, name, about, kind, stat, resource, cost, rank, mastery, line?, stance? }] (`about`: what the skill does, as the wizard's "What it does" wrote it, '' when none). The rank is the one the practice and the level
 * allow (combat/skills.js rankOf), `mastery` its 1..7 step; `practice` the skill's practice (0..600) and `next` the rank after it ({ name, at: the practice it needs,
 * from: the practice this rank started at, minLevel, levelOk }), null at the top (owner, 20 Nov: the sheet showed no progress to the next mastery).
 * A utility skill costs nothing and is story-only, so its `line` is given ready-made.
 */
export function sheetSkills(skills, level) {
    return (Array.isArray(skills) ? skills : []).map(skill => {
        // (`typeName` is the type the block wrote; `type` is only combat or utility, which prices as an attack)
        const price = skillCost(skill.typeName ? { ...skill, type: skill.typeName } : skill), stat = typeof skill.stat === 'string' ? skill.stat : '', rank = rankOf(skill.practice, level), kind = kindOf(price, stat);
        const practice = Math.max(0, Math.floor(Number(skill.practice) || 0)), at = RANKS.findIndex(row => row.name === rank.name), after = at >= 0 ? RANKS[at + 1] : null;
        const next = after ? { name: after.name, at: after.practice, from: RANKS[at].practice, minLevel: after.minLevel, levelOk: (Number(level) || 1) >= after.minLevel } : null;
        return {
            glyph: GLYPH[kind], name: skill.name, about: typeof skill.about === 'string' ? skill.about.trim() : '', kind, stat: stat.toUpperCase(), resource: RESOURCE[price.pool] ?? 'stamina', cost: price.cost, rank: rank.name, mastery: rank.mastery, practice, next,
            ...(price.type === 'utility' ? { line: `Utility · ${stat.toUpperCase()} · story only` } : {}),
            // (which stance: Defence, Speed or Focus, so the sheet says "Speed stance")
            ...(kind === 'stance' ? { stance: V1.skill.types[price.type].label } : {}),
        };
    });
}
