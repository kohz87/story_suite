// One party member as the Party tab's row: what `ui/select/party.js` memberOf reads (id, name, line, level, xpPct, points, bars, effects, stats, skills); health is a bar of 5 stages.
import { LEVEL, xpOfLevel } from '../rules/levels.js';
import { levelFor } from '../rules/growth.js';
import { HEALTH_STAGES, stageOf } from '../words/pools.js';
import { STAT_KEYS } from '../words/stats.js';
import { liveConditions } from './conditions.js';
import { effectiveStats } from './effective.js';
import { bonusOf, poolWith } from './gear-sizes.js';
import { skillRows } from './sheet-skills.js';
import { levelOf, pointsOf, woundsOf } from './standing.js';

const BARS = [['mp', 'energy', 'Mana'], ['sp', 'energy', 'Stamina']];

/** Percent of the way from this level's first xp to the next level's. */
function xpPct(member) {
    const { next } = levelFor(member.xp);
    if (next === null) return 100;
    return Math.max(0, Math.min(100, Math.round((100 * (member.xp - xpOfLevel(levelOf(member)))) / LEVEL.xpPerLevel)));
}

/** "30/100": the xp held in this level over the 100 a level takes (as the bar shows it); null at the top level. */
function xpLabel(member) {
    const { next } = levelFor(member.xp);
    return next === null ? null : `${Math.max(0, Math.round(member.xp - xpOfLevel(levelOf(member))))}/${LEVEL.xpPerLevel}`;
}

/** The sheet row of one member (`cap` is the gear cap from gear.js, for the pool sizes and the bonus); `commands` names the commands the Party tab calls for a spend and a skill edit, and the query it asks for an Export. */
export function rowOf(member, now = null, cap = {}) {
    const companion = Boolean(member.companion);
    const level = levelOf(member);
    const wounds = woundsOf(member);
    const stats = effectiveStats(member);
    const pools = Object.fromEntries(BARS.map(([kind]) => [kind, poolWith(member, kind, cap)]));
    return {
        id: member.id, name: member.name, portrait: null, level,
        line: companion ? `Lv ${level} · companion` : `Lv ${level}`,
        xpPct: companion ? 0 : xpPct(member), xpLabel: companion ? null : xpLabel(member), points: pointsOf(member), away: null,
        bars: companion ? [] : [{ kind: 'hp', value: 5 - wounds, max: 5, label: `Health: ${HEALTH_STAGES[wounds]}` }, ...BARS.map(([kind, scale, label]) => ({ kind, value: pools[kind].now, max: pools[kind].max, label: `${label}: ${stageOf(pools[kind].now, pools[kind].max, scale).word}` }))],
        effects: [...liveConditions(member, now).map(item => item.name), ...member.injuries.map(item => item.name)],
        stats: companion ? null : Object.fromEntries(STAT_KEYS.map(key => [key.toUpperCase(), stats[key]])),
        bonus: companion ? {} : bonusOf(member, cap), // the gear bonus the rolls use (capped by rarity), which the Party sheet shows in place of the Bag's
        skills: skillRows(member),
        commands: { spend: 'textRpg.spend', skillEdit: 'textRpg.skillEdit', export: 'textRpg.export' },
    };
}
