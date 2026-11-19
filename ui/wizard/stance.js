// The Skills step's one-stance rule, said as the reader chooses: a character keeps one stance skill (Combat Rules v1), so while one skill holds the
// stance the other skills' Type lists show the stance types (defence, speed, focus) switched off, with the holder named. Review's twoStances check is unchanged.

import { skillCost } from '../../modules/rpg/combat/skills.js';
import { RPG_STRINGS, fill } from '../../modules/rpg/strings.js';

const W = RPG_STRINGS.wizard;
const kindOf = skill => skillCost({ type: skill.type ?? 'attack', stat: skill.stat }).kind;

/** → whether a skill record has a stance type. */
export const isStanceSkill = skill => kindOf(skill) === 'stance';

/** → the names of the stance skills in `skills` other than the one at `at` (a blank name reads as "a new skill"). */
export const stanceHolders = (skills, at) => skills.flatMap((skill, index) => (index !== at && isStanceSkill(skill) ? [skill.name || W.newSkill] : []));

/** → the Type options for the skill at `at`: stance types off, and naming the holder, while another skill holds a stance (the skill's own type stays). */
export function typeOptions(types, skills, at) {
  const holders = stanceHolders(skills, at);
  if (!holders.length) return types;
  return types.map(type => (isStanceSkill({ type: type.value }) && type.value !== (skills[at].type ?? 'attack')
    ? { ...type, disabled: true, label: fill(W.stanceTaken, { type: type.label, names: holders.join(', ') }) } : type));
}

/** → the one-line note naming the stances when the draft already holds two or more (an imported file, a companion), else ''. */
export function stanceNote(skills) {
  const names = skills.filter(isStanceSkill).map(skill => skill.name || W.newSkill);
  return names.length > 1 ? fill(W.stanceNote, { names: names.join(', ') }) : '';
}
