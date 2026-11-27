// A member's skills as the Party tab's sheet lists them (rows shaped like the RPG's `rpg.sheet` skills).
import { activeSkills } from './effective.js';
import { practiceOf } from './practice.js';
import { RANKS, rankOf } from '../words/ranks.js';

const KIND = { attack: 'attack', magic: 'magic', defence: 'stance', movement: 'stance' };
const GLYPH = { attack: 'atk', magic: 'bolt', stance: 'stance' };

/** `[{ glyph, name, about, kind, stat, resource, cost, rank, mastery, practice, next, line? }]`. */
export function skillRows(member) {
    const active = new Set(activeSkills(member));
    const isOn = skill => active.has(skill);
    return (Array.isArray(member?.skills) ? member.skills : []).map(skill => {
        const practice = practiceOf(member, skill);
        const rank = rankOf(practice);
        const after = RANKS[rank.index + 1];
        const kind = KIND[skill.type] ?? 'attack';
        return {
            glyph: GLYPH[kind], name: skill.name, ...(isOn(skill) ? {} : { inactive: true }), about: skill.about, kind, stat: skill.stat.toUpperCase(),
            resource: skill.cost?.pool === 'mp' ? 'mana' : 'stamina', cost: skill.cost?.n ?? 0, rank: rank.name, mastery: rank.index + 1, practice,
            next: after ? { name: after.name, at: after.at, from: RANKS[rank.index].at, minLevel: 1, levelOk: true } : null,
            ...(!isOn(skill) ? { line: 'Inactive: not known at this level' } : skill.type === 'utility' || skill.type === 'social' || skill.type === 'craft' ? { line: `${skill.type[0].toUpperCase()}${skill.type.slice(1)} · ${skill.stat.toUpperCase()} · story only` } : {}),
        };
    });
}
