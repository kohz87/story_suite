// Adapted from modules/rpg/strings/character.js, its `wizard` words (keep in step when that file changes): the wizard's words for Text RPG, the same where the step is the same.
import { STAT_KEYS } from '../words/stats.js';

/** The wizard's words. */
export const W = Object.freeze({
  title: 'New character', steps: Object.freeze({ who: 'Who', stats: 'Stats', skills: 'Skills', review: 'Review' }), summaryLabel: 'Your character',
  you: 'You', statsHead: 'Stats', skillsHead: 'Skills', noSkills: '—', pointsLeft: 'Points left: {n}', skillCount: '{n} of {max} skills', skillCountOne: '1 of {max} skills',
  name: 'Name', nameHint: 'From your persona. You can change it here.', whoNote: 'Starts at Lv {level} with 0 XP. Health, Mana and Stamina start full. Next: spend your stat points, then pick skills.',
  whoNoteImported: 'Starts at Lv {level} (imported) with 0 XP. Health, Mana and Stamina start full. The name stays yours.',
  startingLevel: 'Starting level', startingLevelHelp: '1 to {cap}. {rank}The Rules page sets the level cap (default 99).', startingLevelRank: 'Rank {name} covers this level in this story pack. ',
  statsNote: 'Every stat starts at {start}, the minimum. Spend {budget} points; a stat can go up to {max} now. Each level you gain later gives 1 more point.', statsReset: 'Reset',
  statsNoteLevel: 'Starting at Lv {level} gives you {extra} more points to place, and a stat can go that much higher.',
  statsNoteImport: 'These are the saved character\'s stats. Spend the {n} points from the file as you like; a stat can go down to {min} to free a point and up to {max} (a saved stat above that stays). Each level you gain later gives 1 more point.',
  skillsIntro: 'Write up to {max} skills, each with what it does, the stat it rolls with, a type and, if you like, what it costs. You can add more later in play.',
  yourSkills: 'Your skills', colSkill: 'Skill', colAbout: 'What it does (the AI reads this)', colStat: 'Stat', colType: 'Type', colCost: 'Costs', colCostN: 'Cost',
  skillType: '{name} type', skillName: 'Skill name', skillAbout: 'What {name} does', skillStat: '{name} rolls with', skillCost: '{name} costs', skillCostN: '{name} cost', remove: 'Remove {name}', add: '+ Add a skill', newSkill: 'New skill',
  slotsLeft: '{n} slots left.', slotLeft: '1 slot left.', slotsFull: 'All slots are used.',
  reviewHead: 'Check everything, then create', reviewWho: '{name} · {kind}', costs: 'costs', create: 'Create', creating: 'Creating…', back: 'Back', next: 'Next', fixFirst: 'Fix the problem above, then Create.', problems: 'Fix this first:',
  needName: 'Give the character a name.', needPoints: 'Place all {n} points ({left} left).', tooMany: 'Take back {n} points: you have placed more than you have.', tooManySkills: 'Take out {n} skills: Lv {level} holds {max}.', needSkillName: 'Every skill needs a name.', generic: 'The character could not be made.',
  stamina: 'Stamina', mana: 'Mana', begins: '{name} begins the story.', reviewLevel: 'Lv {level}',
  importText: 'Start from a saved character: its stats, unspent points, level, skills, inventory and money.', importButton: 'Import file…', importLabel: 'Saved character file',
  importDone: 'Imported from {file}: stats, {points}, Lv {level} and {skills}.', importPoints: '{n} unspent points', importPointsOne: '1 unspent point', importNoPoints: 'no unspent points',
  importSkills: '{n} skills', importSkillsOne: '1 skill', importNoSkills: 'no skills', importAdds: 'When you press Create it also adds {list}.', importThings: '{n} things', importThing: '1 thing', importMoney: '{amount} money to the purse',
  importHeld: 'A stat saved above {max} is held at {max}, one below {min} raised to {min}.', importLeft: 'Its practice, injuries and conditions are not taken.', importName: 'Give the character a name below.', importUndo: 'Undo import',
  madeButNot: '{name} is made, but not added: {list}.', notAdded: '{what} ({why})', moneyNotAdded: 'the money ({why})',
  file: Object.freeze({
    empty: 'The file is empty.', tooBig: 'This file is too big to be a saved character.', notJson: 'This is not a saved character: the file could not be read.', notCharacter: 'This is not a saved character file.',
    version: 'This file was saved by a newer version, so it cannot be used here.', level: 'The file has no valid level (1 to 99) or Soul Class (1 to 9).', points: 'The file has no valid number of unspent points (0 to {max}).',
    stats: 'The file needs all seven stats.', stat: 'The file has no valid {stat} (1 to 30).', skills: 'The skills in the file are not a list of at most {max}.',
    skill: 'Skill {n} in the file is not valid: it needs a name, a rank from 0 to 6 and, if it has one, one of the seven stats.', items: 'The inventory in the file is not a list of at most {max} things.',
    item: 'Thing {n} in the file is not valid: it needs a name and a count from 1 to {max}.', money: 'The money in the file is not a whole number from 0 to 1,000,000,000.', unreadable: '{name} could not be read.',
  }),
});

/** `fill('{n} left', { n: 3 })` → '3 left'. */
export function fill(text, values = {}) {
  return String(text).replace(/\{(\w+)\}/g, (all, key) => (key in values ? String(values[key]) : all));
}

/** The stats as one line, "STR 9 · VIT 9 · …". */
export const statsLine = stats => STAT_KEYS.map(key => `${key.toUpperCase()} ${stats[key]}`).join(' · ');
