// The roll bonus of a member for a skill or a stat, and the bonus table the dice note lists.
import { rollBonus } from '../rules/roll.js';
import { rankOf } from '../words/ranks.js';
import { STAT_KEYS } from '../words/stats.js';
import { practiceOf } from './practice.js';
import { skillIndex } from './members.js';
import { statKey } from './line-read.js';
import { totalStats } from './gear.js';
import { levelOf } from './standing.js';
import { listedSkills } from './listed.js';

/**
 * What `target` (a skill's name or a stat) adds to a member's roll: `{ stat, skill, bonus }`, or null when the
 * member has no such skill or stat. A companion has no sheet: their level term and +2 for a named strength.
 */
export function bonusFor(member, target, cap = {}) {
    if (member?.companion) {
        const want = String(target ?? '').trim().toLowerCase();
        const named = want !== '' && member.companion.strengths.some(text => text.toLowerCase().includes(want));
        return { stat: null, skill: null, bonus: Math.floor(member.companion.level / 10) + (named ? 2 : 0) };
    }
    const at = skillIndex(member, target);
    const skill = at < 0 ? null : member.skills[at];
    const stat = skill ? skill.stat : statKey(target);
    if (!stat) return null;
    const hampered = member.injuries.filter(injury => injury.hampers.includes(stat)).length;
    const rankBonus = skill ? rankOf(practiceOf(member, skill)).bonus : 0;
    return { stat, skill, bonus: rollBonus({ stat: totalStats(member, cap)[stat], rankBonus, level: levelOf(member), hampered }) };
}

/** The dice note's table: one row per member, each stat's bonus then each listed skill's (listed.js). */
export function bonusRows(members, capOf, text = '') {
    return members.filter(member => !member.companion).map(member => {
        const cap = capOf(member);
        const stats = STAT_KEYS.map(key => [key.toUpperCase(), bonusFor(member, key, cap).bonus]);
        const skills = listedSkills(member, text).map(skill => [skill.name, bonusFor(member, skill.name, cap).bonus]);
        return { who: member.name, bonuses: [...stats, ...skills] };
    });
}
