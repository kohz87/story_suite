// One party member as the Party tab's row: what `ui/select/party.js` memberOf reads (id, name, line, level, xpPct, points, bars, effects, stats, skills).
import { levelFor } from '../rules/growth.js';
import { stageOf } from '../words/pools.js';
import { STAT_KEYS } from '../words/stats.js';
import { skillRows } from './sheet-skills.js';

const BARS = [['hp', 'health', 'Health'], ['mp', 'energy', 'Mana'], ['sp', 'energy', 'Stamina']];

/** Percent of the way from this level's first xp to the next level's. */
function xpPct(member) {
    const { next } = levelFor(member.xp);
    if (next === null) return 100;
    const from = 25 * (member.level - 1) * member.level;
    return Math.max(0, Math.min(100, Math.round((100 * (member.xp - from)) / (next - from))));
}

/** The sheet row of one member; `commands` names the commands the Party tab calls for a spend and a skill edit. */
export function rowOf(member) {
    const companion = Boolean(member.companion);
    return {
        id: member.id, name: member.name, portrait: null, level: member.level,
        line: companion ? `Lv ${member.level} · companion` : `Lv ${member.level}`,
        xpPct: companion ? 0 : xpPct(member), points: member.points, away: null,
        bars: companion ? [] : BARS.map(([kind, scale, label]) => ({ kind, value: member.pools[kind].now, max: member.pools[kind].max, label: `${label}: ${stageOf(member.pools[kind].now, member.pools[kind].max, scale).word}` })),
        effects: [...member.conditions.map(item => item.name), ...member.injuries.map(item => item.name)],
        stats: companion ? null : Object.fromEntries(STAT_KEYS.map(key => [key.toUpperCase(), member.stats[key]])),
        skills: skillRows(member.skills),
        commands: { spend: 'textRpg.spend', skillEdit: 'textRpg.skillEdit' },
    };
}
