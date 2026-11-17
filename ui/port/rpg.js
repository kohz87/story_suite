// The RPG and fights page's commands for the port: each row writes the key the old view's page writes, in Story Block's bucket.

import { AUTO_CAP, AUTO_CAP_SETTING, CHECKS_SETTING, JOIN_SETTING, LEVEL, LEVEL_CAP_SETTING, PRACTICE, PRACTICE_SETTING, PRECHECK_SETTING } from '../../modules/rpg/names.js';
import { DIFFICULTY_SETTING, STANDARD_SETTING } from '../../modules/rpg/rules.js';
import { XP_RATE, XP_RATE_SETTING } from '../../modules/rpg/levels.js';
import { customOf } from '../../modules/rpg/view/settings-data.js';
import { DIFFICULTY_WORDS, JOIN_WORDS } from '../select/rpg-rows.js';

const BUCKET = 'story-block';
const FAILED = { ok: false, code: 'FAILED', message: 'That setting was not saved.' };
const wordToValue = words => word => Object.keys(words).find(k => words[k] === word);
const whole = (min, max, step = 1) => (raw) => {
  const n = Number(raw);
  return Number.isFinite(n) && raw !== null && raw !== '' ? Math.min(max, Math.max(min, Math.round(n / step) * step)) : undefined;
};

// The same clamps the old page's rows use (modules/rpg/view/settings/sections.js).
const ROWS = {
  'rpg.difficulty': [DIFFICULTY_SETTING, wordToValue(DIFFICULTY_WORDS)],
  'rpg.levelCap': [LEVEL_CAP_SETTING, whole(LEVEL.min, LEVEL.max)],
  'rpg.xpRate': [XP_RATE_SETTING, whole(XP_RATE.min, XP_RATE.max, XP_RATE.step)],
  'rpg.practicePerSkillUse': [PRACTICE_SETTING, whole(PRACTICE.minPerUse, PRACTICE.maxPerUse)],
  'rpg.companions': [JOIN_SETTING, wordToValue(JOIN_WORDS)],
  'rpg.setUpAFightFromMyAttack': [PRECHECK_SETTING, v => v === true],
  'rpg.autoExchanges': [AUTO_CAP_SETTING, whole(AUTO_CAP.min, AUTO_CAP.max)],
  'rpg.storyChecksUseYourStats': [CHECKS_SETTING, v => v === true],
};
const DEFAULTS = { 'rpg.difficulty': 'standard', 'rpg.levelCap': LEVEL.max, 'rpg.xpRate': XP_RATE.default, 'rpg.practicePerSkillUse': PRACTICE.perUse, 'rpg.companions': 'ask', 'rpg.setUpAFightFromMyAttack': true, 'rpg.autoExchanges': AUTO_CAP.default, 'rpg.storyChecksUseYourStats': true };

/**
 * `settings.set` with a key `rpg.<row>` stores that row (a value outside its range is held to it; a word that is not one of the row's is refused);
 * `settings.action` `settings.reset` with the label "Reset RPG and fights to defaults" stores every row's default. `values()` reads the bucket
 * (a first switch to Custom starts from the numbers in force, as the old page does). Any other command is not this page's: returns null.
 */
export function rpgCommand(type, payload, writes = null, values = () => null) {
  const key = String(payload?.key ?? '');
  const set = (setting, value) => writes?.settings?.set?.(BUCKET, setting, value);
  if (type === 'settings.set' && Object.hasOwn(ROWS, key)) {
    const [setting, clean] = ROWS[key];
    const value = clean(payload.value);
    if (value === undefined) return { ...FAILED, message: 'That value is not one this setting takes.' };
    const bucket = values() ?? {};
    if (key === 'rpg.difficulty' && value === 'custom' && !bucket[STANDARD_SETTING]) set(STANDARD_SETTING, customOf(bucket));
    const stored = set(setting, value);
    return stored === undefined ? FAILED : { ok: true, value: stored };
  }
  if (type === 'settings.action' && key === 'settings.reset' && payload?.value === 'Reset RPG and fights to defaults') {
    const done = Object.keys(ROWS).map(k => set(ROWS[k][0], DEFAULTS[k]));
    return done.includes(undefined) ? FAILED : { ok: true };
  }
  return null;
}
