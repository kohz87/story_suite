// Builds the RPG and fights page's rows from Story Block's settings bucket, the same keys and the same readers the old view's page uses.

import { AUTO_CAP, LEVEL, PRACTICE, autoCapFrom, checksOn, levelCapOf, practiceOf, precheckOn } from '../../modules/rpg/names.js';
import { JOIN_SETTING, JOINS } from '../../modules/rpg/names.js';
import { DIFFICULTIES, difficultyOf } from '../../modules/rpg/rules.js';
import { XP_RATE, xpRateOf } from '../../modules/rpg/levels.js';

/** The words a choice row shows, by the stored value (the old page's chips say the same). */
export const DIFFICULTY_WORDS = Object.freeze({ gentle: 'Gentle', standard: 'Standard', harsh: 'Harsh', custom: 'Custom' });
export const JOIN_WORDS = Object.freeze({ ask: 'Ask', auto: 'Automatically', off: 'Off' });

const row = (group, key, type, label, value, def, extra = {}) => ({
  key, group, type, label, hint: extra.hint ?? null, value, default: def, options: extra.options ?? null, unit: extra.unit ?? null, tags: extra.tags ?? [], wide: false,
});

const joinOf = values => (JOINS.includes(values?.[JOIN_SETTING]) ? values[JOIN_SETTING] : 'ask');

/** Returns the page's rows for `values` (the 'story-block' bucket, or nothing: the defaults show). */
export function selectRpgRows(values) {
  const v = values && typeof values === 'object' ? values : {};
  return [
    row('Rules', 'rpg.difficulty', 'seg', 'Difficulty', DIFFICULTY_WORDS[difficultyOf(v)], 'Standard', { hint: 'Custom opens the numbers', options: DIFFICULTIES.map(d => DIFFICULTY_WORDS[d]) }),
    row('Progression', 'rpg.levelCap', 'num', 'Level cap', levelCapOf(v.rpgLevelCap) ?? LEVEL.max, LEVEL.max, { hint: 'A story or pack can set its own' }),
    row('Progression', 'rpg.xpRate', 'num', 'XP rate', xpRateOf(v.rpgXpRate) ?? XP_RATE.default, XP_RATE.default, { unit: '%', hint: '50 to 300, in steps of 25' }),
    row('Progression', 'rpg.practicePerSkillUse', 'num', 'Practice per skill use', practiceOf(v.rpgPracticePerUse) ?? PRACTICE.perUse, PRACTICE.perUse, { hint: '1 to 5' }),
    row('Fights', 'rpg.companions', 'seg', 'Companions who join', JOIN_WORDS[joinOf(v)], 'Ask', { options: JOINS.map(j => JOIN_WORDS[j]) }),
    row('Fights', 'rpg.setUpAFightFromMyAttack', 'sw', 'Set up a fight from my attack', precheckOn(v), true),
    row('Fights', 'rpg.autoExchanges', 'num', 'Most exchanges Auto plays', autoCapFrom(v), AUTO_CAP.default, { hint: 'On the fight board; 9 plays until the end' }),
    row('Fights', 'rpg.overLoad', 'info', 'Over the load limit', 'rule', 'rule', { hint: '−2 to AGI and DEX checks and −25% travel pace; items have their own weights' }),
    row('Fights', 'rpg.storyChecksUseYourStats', 'sw', 'Story checks use your stats', checksOn(v), true, { hint: 'Out-of-fight checks use your stats; their numbers are in Director › Checks' }),
  ];
}
