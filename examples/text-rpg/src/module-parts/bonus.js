// The roll bonus of a member for a skill or a stat, and the bonus table the dice note lists.
import { rollBonus } from '../rules/roll.js';
import { rankOf } from '../words/ranks.js';
import { practiceOf } from './practice.js';
import { skillIndex } from './members.js';
import { statKey } from './line-read.js';
import { listedSkills } from './listed.js';

/**
 * What `target` (a skill's name or a stat) adds to a member's roll: `{ stat, skill, bonus, unlearned? }`. A skill on the sheet adds its rank × 2; a plain stat
 * is +0; a skill the member does not have is −3 (`unlearned`, no stat). Injuries hampering the stat take 2 each. A companion has no sheet: +2 for a named strength.
 */
export function bonusFor(member, target) {
    if (member?.companion) {
        const want = String(target ?? '').trim().toLowerCase();
        const named = want !== '' && member.companion.strengths.some(text => text.toLowerCase().includes(want));
        return { stat: null, skill: null, bonus: named ? 2 : 0 };
    }
    const at = skillIndex(member, target);
    const skill = at < 0 ? null : member.skills[at];
    const stat = skill ? skill.stat : statKey(target);
    if (!stat) return { stat: null, skill: null, unlearned: true, bonus: rollBonus({ unlearned: true }) };
    const hampered = member.injuries.filter(injury => injury.hampers.includes(stat)).length;
    const rank = skill ? rankOf(practiceOf(member, skill)).index : 0;
    return { stat, skill, bonus: rollBonus({ rank, hampered }) };
}

/** The dice note's table: one row per member, each listed skill's bonus (listed.js); a stat try is +0 and a skill not on the sheet −3, as the note says. */
export function bonusRows(members, text = '') {
    return members.filter(member => !member.companion).map(member => ({
        who: member.name,
        bonuses: listedSkills(member, text).map(skill => [skill.name, bonusFor(member, skill.name).bonus]),
    }));
}
