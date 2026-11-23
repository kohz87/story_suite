// One party member as the Party tab's row: what `ui/select/party.js` memberOf reads (id, name, line, level, xpPct, points, bars, effects, stats, skills); health is a bar of 5 stages.
import { levelFor } from '../rules/growth.js';
import { HEALTH_STAGES, stageOf } from '../words/pools.js';
import { STAT_KEYS } from '../words/stats.js';
import { liveConditions } from './conditions.js';
import { effectiveStats, poolOf } from './effective.js';
import { skillRows } from './sheet-skills.js';
import { levelOf, pointsOf, woundsOf } from './standing.js';

const BARS = [['mp', 'energy', 'Mana'], ['sp', 'energy', 'Stamina']];

/** Percent of the way from this level's first xp to the next level's. */
function xpPct(member) {
    const { next } = levelFor(member.xp);
    if (next === null) return 100;
    const from = 25 * (levelOf(member) - 1) * levelOf(member);
    return Math.max(0, Math.min(100, Math.round((100 * (member.xp - from)) / (next - from))));
}

/** "30/50": the xp held over the xp the next level needs (the bar's percent runs from this level's first xp); null at the top level. */
function xpLabel(member) {
    const { next } = levelFor(member.xp);
    return next === null ? null : `${Math.max(0, Math.round(member.xp))}/${next}`;
}

/** The sheet row of one member; `commands` names the commands the Party tab calls for a spend and a skill edit. */
export function rowOf(member, now = null) {
    const companion = Boolean(member.companion);
    const level = levelOf(member);
    const wounds = woundsOf(member);
    const stats = effectiveStats(member);
    const pools = Object.fromEntries(BARS.map(([kind]) => [kind, poolOf(member, kind, stats)]));
    return {
        id: member.id, name: member.name, portrait: null, level,
        line: companion ? `Lv ${level} · companion` : `Lv ${level}`,
        xpPct: companion ? 0 : xpPct(member), xpLabel: companion ? null : xpLabel(member), points: pointsOf(member), away: null,
        bars: companion ? [] : [{ kind: 'hp', value: 5 - wounds, max: 5, label: `Health: ${HEALTH_STAGES[wounds]}` }, ...BARS.map(([kind, scale, label]) => ({ kind, value: pools[kind].now, max: pools[kind].max, label: `${label}: ${stageOf(pools[kind].now, pools[kind].max, scale).word}` }))],
        effects: [...liveConditions(member, now).map(item => item.name), ...member.injuries.map(item => item.name)],
        stats: companion ? null : Object.fromEntries(STAT_KEYS.map(key => [key.toUpperCase(), stats[key]])),
        skills: skillRows(member),
        commands: { spend: 'textRpg.spend', skillEdit: 'textRpg.skillEdit' },
    };
}
