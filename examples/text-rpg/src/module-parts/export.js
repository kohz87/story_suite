// The saved character file of a Text RPG member, in the shape the RPG's character file has (so either wizard reads the other's file): level, unspent points, the seven stats, skills (name, about, stat, Stamina or Mana, rank, type), plus Text RPG's own part under `textRpg`. Adapted from modules/rpg/charfile-parts/build.js.
import { DOMAIN } from '../domain/shape.js';
import { CHAR_FILE, CHAR_VERSION, FILE_LIMITS } from '../wizard/charfile.js';
import { STAT_KEYS } from '../words/stats.js';
import { effectiveStats } from './effective.js';
import { memberNamed } from './members.js';
import { practiceKey, practiceOf } from './practice.js';
import { LEVEL } from '../rules/levels.js';
import { levelOf, pointsOf } from './standing.js';

// The RPG's names for Text RPG's skill types (its file has no social or craft: both are utility there; the exact type goes in `textRpg.skills`).
const FILE_TYPE = Object.freeze({ defence: 'defence', movement: 'speed', magic: 'focus', social: 'utility', craft: 'utility', utility: 'utility' });
const UTILITY_MAX = 3;
const line = (text, max) => [...String(text ?? '').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();
const fileName = name => `${[...String(name ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')].slice(0, 40).join('').replace(/-+$/, '') || 'character'}.character.json`;

/** `args`: { id (the member's id) }. → { ok: true, name, fileName, text, own, level, points, clamped?, items, money } or { ok: false, message }. The inventory and the purse are not part of this file (`items` and `money` are 0). */
export function exportFile(state, args) {
    const slice = state?.domains?.[DOMAIN];
    const member = slice ? memberNamed(slice, args?.id) : null;
    if (!member || member.companion || member.fallen) return { ok: false, message: 'That character is not in the story any more.' };
    const level = levelOf(member), stats = effectiveStats(member);
    // (both parsers refuse a file with more than 60 unspent points: the file says 60 and the sheet says so)
    const points = Math.min(FILE_LIMITS.points, pointsOf(member)), clamped = pointsOf(member) > points;
    // (the RPG's file holds at most three utility skills: the first three go in, the rest stay with this character)
    let utility = 0;
    const kept = member.skills.filter(skill => (FILE_TYPE[skill.type] === 'utility' ? (utility += 1) <= UTILITY_MAX : true));
    const file = {
        [CHAR_FILE]: CHAR_VERSION, level, soul: Math.max(1, Math.min(9, Math.floor(level / 10) + 1)), points,
        stats: Object.fromEntries(STAT_KEYS.map(key => [key, stats[key]])),
        skills: kept.map(skill => ({ name: line(skill.name, 40), about: line(skill.about, 120), stat: skill.stat, uses: skill.cost?.pool === 'mp' ? 'mana' : 'stamina', rank: Math.min(6, Math.floor(practiceOf(member, skill) / 100)), ...(FILE_TYPE[skill.type] ? { type: FILE_TYPE[skill.type] } : {}) })),
        textRpg: {
            xp: Math.min(LEVEL.xpMax, member.xp), practice: { ...member.practice }, injuries: member.injuries.map(item => ({ ...item })), conditions: member.conditions.map(item => ({ ...item })),
            skills: kept.map(skill => ({ name: skill.name, type: skill.type, ...(skill.cost ? { cost: skill.cost } : {}), practice: member.practice[practiceKey(skill.name)] ?? 0 })),
        },
    };
    return { ok: true, name: member.name, fileName: fileName(member.name), text: `${JSON.stringify(file, null, 2)}\n`, own: member.pc === true, level, points: file.points, ...(clamped ? { clamped: true } : {}), items: 0, money: 0 };
}
