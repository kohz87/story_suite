// Says what each RPG difficulty changes, from the engine's own numbers, and builds the Custom difficulty's rows (the creation numbers new characters are made with).

import { DIFFICULTIES, STANDARD_PRESETS, STANDARD_RANGES, difficultyOf } from '../../modules/rpg/rules.js';
import { LIMITS } from '../../modules/rpg/names.js';
import { TIERS, V1 } from '../../modules/rpg/combat/numbers.js';
import { customOf } from '../../modules/rpg/view/settings-data.js';

/** The Custom numbers a reader can change here: the only ones of the Custom set that today's play reads (the New character window, modules/rpg/view/wizard-data-parts/creation.js). */
export const CUSTOM_FIELDS = Object.freeze([
  Object.freeze({ field: 'startStat', label: 'Stats start at', hint: 'Every stat of a character you make; companions who join keep their own' }),
  Object.freeze({ field: 'createPoints', label: 'Points to spend at creation', hint: null }),
  Object.freeze({ field: 'createMin', label: 'Lowest stat at creation', hint: 'At most what stats start at' }),
  Object.freeze({ field: 'createMax', label: 'Highest stat at creation', hint: 'At least what stats start at' }),
]);

const sign = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const tierWords = () => {
  const names = Object.keys(TIERS), first = names[0], last = names.at(-1);
  const word = name => name.charAt(0).toUpperCase() + name.slice(1);
  return `${word(first)} ${sign(TIERS[first].roll)} to ${word(last)} ${sign(TIERS[last].roll)}`;
};
const creationLine = n => `stats start at ${n.startStat}, ${n.createPoints} points to spend, each stat ${n.createMin} to ${n.createMax}`;

/**
 * What each choice changes (one short line per choice, in DIFFICULTIES order), then what is the same at every difficulty.
 * → { lines: [{ word, text }], same }. The words are the stored values; the numbers are the presets', Combat Rules v1's and the checks' tables.
 */
export function difficultyLines() {
  const base = name => STANDARD_PRESETS[name].foeBase;
  const text = { gentle: `Foe’s base ${base('gentle')}`, standard: `Foe’s base ${base('standard')} (the default)`, harsh: `Foe’s base ${base('harsh')}`, custom: 'Your own creation numbers, below' };
  const dc = Object.entries(LIMITS.dc).map(([word, n]) => `${word} ${n}`).join(', ');
  return {
    lines: DIFFICULTIES.map(word => ({ word, text: text[word] })),
    same: `Gentle, Standard and Harsh differ only in the foe’s base, which the fight board does not use, so fights and checks play the same at all three: `
      + `the fight board rolls foes at d20 + ${V1.foe.rollBase} + level/${V1.foe.rollLevelDiv} + tier (${tierWords()}), story checks are against ${dc}, and XP follows the XP rate.`,
  };
}

/** The selected difficulty's details for `values` (Story Block's settings bucket): its foe's base and the numbers new characters are made with. */
export function difficultyDetail(values) {
  const now = difficultyOf(values);
  if (now === 'custom') return `Your numbers: ${creationLine(customOf(values))}`;
  const preset = STANDARD_PRESETS[now];
  return `Foe’s base ${preset.foeBase}; new characters: ${creationLine(preset)}`;
}

/** The Custom rows (`rpg.custom.<field>`, numbers held to the engine's ranges), or none when the difficulty is not Custom. */
export function selectCustomRows(values) {
  if (difficultyOf(values) !== 'custom') return [];
  const numbers = customOf(values);
  return CUSTOM_FIELDS.map(({ field, label, hint }) => {
    const { min, max } = STANDARD_RANGES[field];
    return { key: `rpg.custom.${field}`, group: 'Rules', type: 'num', label, hint: hint ? `${hint}; ${min} to ${max}` : `${min} to ${max}`,
      value: numbers[field], default: STANDARD_PRESETS.standard[field], options: null, unit: null, tags: [], wide: false };
  });
}
