// The capability line: one short line per member, from fixed word tables; only words reach the narrator, never numbers.
import { rankOf } from '../words/ranks.js';
import { liveConditions } from './conditions.js';
import { practiceOf } from './practice.js';
import { HEALTH_STAGES, stageOf, usesLeft } from '../words/pools.js';
import { statWord } from '../words/stats.js';
import { STAT_KEYS } from '../words/stats.js';
import { activeSkills } from './effective.js';
import { listedSkills } from './listed.js';
import { totalStats } from './gear.js';
import { poolWith } from './gear-sizes.js';
import { levelOf, woundsOf } from './standing.js';

const POOLS = [['mp', 'Mana'], ['sp', 'Stamina']];

function poolPart(member, kind, label, cap) {
    const pool = poolWith(member, kind, cap);
    const dearest = activeSkills(member).filter(skill => skill.cost?.pool === kind).sort((a, b) => b.cost.n - a.cost.n)[0];
    const left = dearest ? ` (${usesLeft(pool.now, dearest.cost.n)} ${dearest.name} left)` : '';
    return `${label}: ${stageOf(pool.now, pool.max, 'energy').word}${left}`;
}

/** The line for one member; `gear` is `{ cap, names }` from gear.js; `text` is what names a skill beyond the 8 most practised (listed.js). */
export function capabilityLine(member, gear = { cap: {}, names: [] }, now = null, text = '') {
    if (member.companion) {
        const strengths = member.companion.strengths.join(', ');
        return `${member.name} (companion, level ${levelOf(member)})${strengths ? ` — ${strengths}` : ''}`;
    }
    const total = totalStats(member, gear.cap);
    const stats = STAT_KEYS.map(key => [key.toUpperCase(), statWord(key, total[key])]).filter(([, word]) => word && word !== 'ordinary').map(([key, word]) => `${key} ${word}`);
    const skills = listedSkills(member, text).map(skill => `${skill.name} (${rankOf(practiceOf(member, skill)).name})${skill.about ? `: ${skill.about}` : ''}`);
    const conditions = liveConditions(member, now);
    const health = HEALTH_STAGES[woundsOf(member)];
    const parts = [
        ...stats,
        ...(skills.length ? [`Skills: ${skills.join('; ')}`] : []),
        `Health: ${health}${health === 'Down' ? ' (cannot act)' : ''}`,
        ...POOLS.map(([kind, label]) => poolPart(member, kind, label, gear.cap)),
        ...(gear.names.length ? [`Wearing: ${gear.names.join('; ')}`] : []),
        ...(member.injuries.length ? [`Injuries: ${member.injuries.map(injury => injury.name).join(', ')}`] : []),
        ...(conditions.length ? [`Conditions: ${conditions.map(condition => condition.name).join(', ')}`] : []),
    ];
    return `${member.name} (Level ${levelOf(member)}) — ${parts.join(' · ')}`;
}
