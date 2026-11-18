// Join: the pull (pack format 4, §5.3). When a person joins, their NPC State record (level, role, history, abilities, keepsakes) is what the sheet is built from; RPG
// owns every number afterwards. Pure over the state (the people slice of the reply's own prefix), so a swipe, a Re-read and a rebuild pull the same sheet.
// A person with no usable record falls back to the format 3 cast skills the caller passes (`fallback`; X1 removes that path).

import { oneLine } from '../../../core/text.js';
import { typeKey } from '../../../core/runtime/skill-slots.js';
import { levelOfClass } from '../formula.js';
import { RANKS, V1 } from '../combat/numbers.js';
import { abilityWord, leanStat } from './pull-words.js';

const DEFAULT_ABILITIES = 4, ABILITY_MAX = 6;
const STANCES = Object.freeze({
    defence: { name: 'Guard', about: 'Plants their feet and takes the blow on the shield or the arm.', stat: 'vit' },
    evasion: { name: 'Evade', about: 'Stays light on their feet and out of reach.', stat: 'agi' },
    support: { name: 'Rally', about: 'Keeps the others steady and on their feet.', stat: 'cha' },
});
const isStance = type => V1.skill.types[type]?.kind === 'stance';
const fold = text => oneLine(text).toLowerCase();

/** The people record `name` means (its name or an alias, folded) in the state's people slice, or null (nobody, or two people share the name). */
export function personOf(state, name) {
    const npcs = state?.domains?.people?.npcs, wanted = fold(name);
    if (!wanted || !npcs || typeof npcs !== 'object') return null;
    const hits = Object.values(npcs).filter(record => record && typeof record === 'object' && [record.name, ...(Array.isArray(record.aliases) ? record.aliases : [])].some(each => fold(each) === wanted));
    return hits.length === 1 ? hits[0] : null;
}

/** The skill rank (0 to 6) a level stands for: one under the highest rank its level allows (practice does the rest), never below Novice. */
export const rankAtLevel = level => Math.max(0, RANKS.reduce((top, rank, at) => (level >= rank.minLevel ? at : top), 0) - 1);

const listOf = value => (Array.isArray(value) ? value.filter(entry => entry && typeof entry.name === 'string' && entry.name) : []);

/**
 * What a joining person's sheet is built from: `{ level?, best, skills, keepsakes }`. `level` only when the record states one, held to `cap`; the join line's class stands
 * otherwise (the caller's `soul`). `best` is the line's, else the keyword table's over role, history and abilities, else ''. `skills`: one per ability in order, up to
 * `pull.abilities` (default 4), each by the keyword table, then one stance skill unless `pull.stance` is false or an ability already is one; with no abilities the
 * `fallback` (the format 3 cast skills) is what there is. `keepsakes`: their names, for the gear.
 */
export function pullOf(state, { name, soul = 1, best = '', pull = null, cap = null, fallback = [] } = {}) {
    const record = personOf(state, name);
    const stated = Number.isSafeInteger(record?.level) && record.level >= 1 ? record.level : 0;
    const level = stated ? Math.min(stated, Number.isSafeInteger(cap) ? Math.max(1, cap) : V1.level.max) : undefined;
    const abilities = listOf(record?.abilities), keepsakes = listOf(record?.keepsakes).map(entry => entry.name);
    const lead = best || (record ? leanStat([record.role, record.background, ...abilities.map(entry => `${entry.name} ${entry.description ?? ''}`)]) : '');
    if (!abilities.length) return { ...(level ? { level } : {}), best: lead, skills: Array.isArray(fallback) ? fallback : [], keepsakes };
    const count = Math.max(1, Math.min(ABILITY_MAX, Number.isSafeInteger(pull?.abilities) ? pull.abilities : DEFAULT_ABILITIES));
    const rank = rankAtLevel(level ?? levelOfClass(soul));
    const skills = abilities.slice(0, count).map(entry => {
        const word = abilityWord(`${entry.name} ${entry.description ?? ''}`), type = word?.type ?? 'attack', stat = word?.stat ?? (lead || 'str');
        return { name: oneLine(entry.name), about: oneLine(entry.description ?? ''), stat, uses: type === 'heal' || stat === 'int' || stat === 'wis' ? 'mana' : 'stamina', rank, ...typeKey(type) };
    });
    if (pull?.stance !== false && !skills.some(skill => isStance(skill.type ?? 'attack'))) {
        const kind = lead === 'dex' || lead === 'agi' ? 'evasion' : lead === 'int' || lead === 'wis' || lead === 'cha' ? 'support' : 'defence';
        skills.push({ ...STANCES[kind], uses: 'stamina', rank, type: kind });
    }
    return { ...(level ? { level } : {}), best: lead, skills, keepsakes };
}
