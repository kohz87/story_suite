// Adapted from modules/rpg/strings/character.js, its `wizard` words (keep in step when that file changes): the wizard's words for Text RPG, the same where the step is the same.
import { STAT_KEYS } from '../words/stats.js';

/** The wizard's words. */
export const W = Object.freeze({
  title: 'New character', steps: Object.freeze({ who: 'Who', stats: 'Stats', skills: 'Skills', review: 'Review' }), summaryLabel: 'Your character',
  you: 'You', statsHead: 'Stats', skillsHead: 'Skills', noSkills: '—', pointsLeft: 'Points left: {n}', skillCount: '{n} of {max} skills', skillCountOne: '1 of {max} skills',
  name: 'Name', nameHint: 'The name the story uses for you.', whoNote: 'Next: spend your stat points, then pick skills.',
  statsNote: 'Every stat starts near the middle. Spend {budget} points in all; a stat can go from {min} to {max}. Lower one to raise another.', statsReset: 'Reset',
  skillsIntro: 'Write up to {max} skills, each with what it does, the stat it rolls with, a type and, if you like, what it costs. You can add more later in play.',
  yourSkills: 'Your skills', colSkill: 'Skill', colAbout: 'What it does (the AI reads this)', colStat: 'Stat', colType: 'Type', colCost: 'Costs', colCostN: 'Cost',
  skillType: '{name} type', skillName: 'Skill name', skillAbout: 'What {name} does', skillStat: '{name} rolls with', skillCost: '{name} costs', skillCostN: '{name} cost', remove: 'Remove {name}', add: '+ Add a skill', newSkill: 'New skill',
  slotsLeft: '{n} slots left.', slotLeft: '1 slot left.', slotsFull: 'All slots are used.',
  reviewHead: 'Check everything, then create', reviewWho: '{name} · {kind}', costs: 'costs', create: 'Create', creating: 'Creating…', back: 'Back', next: 'Next', fixFirst: 'Fix the problem above, then Create.', problems: 'Fix this first:',
  needName: 'Give the character a name.', needPoints: 'Place all {n} points ({left} left).', tooMany: 'Take back {n} points: the stats add up to more than {total}.', needSkillName: 'Every skill needs a name.', generic: 'The character could not be made.',
  stamina: 'Stamina', mana: 'Mana', begins: '{name} begins the story.',
});

/** `fill('{n} left', { n: 3 })` → '3 left'. */
export function fill(text, values = {}) {
  return String(text).replace(/\{(\w+)\}/g, (all, key) => (key in values ? String(values[key]) : all));
}

/** The stats as one line, "STR 9 · VIT 9 · …". */
export const statsLine = stats => STAT_KEYS.map(key => `${key.toUpperCase()} ${stats[key]}`).join(' · ');
