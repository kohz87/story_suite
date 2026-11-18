// The numbers the settings give now, what a pack asks for, and which of its asks is in force.
import { LEVEL } from '../names.js';
import { divisorOf } from './levels.js';
import { DIFFICULTY_SETTING, STANDARD_SETTING } from './numbers.js';
import { DIFFICULTIES, STANDARD_PRESETS } from './presets.js';
import { normalizeStandard } from './normalize.js';

/**
 * What a pack asks for, from its `content.rpg` records: `{ pack }` (the id of the pack that names the formula), or null. A pack cannot tune the numbers
 * (`numbers` is dropped by the validator), the formula is always v1 and the level cap is read apart (levelCapFor, packLevelsOf), so nothing else is left to ask.
 */
export function packRulesOf(records) {
    const found = (Array.isArray(records) ? records : []).find(record => record && typeof record === 'object' && record.slug === 'formula' && record.formula);
    return found ? { ...(typeof found.pack === 'string' ? { pack: found.pack } : {}) } : null;
}

/** The difficulty the settings say: a known word, else Standard. */
export const difficultyOf = values => (DIFFICULTIES.includes(values?.[DIFFICULTY_SETTING]) ? values[DIFFICULTY_SETTING] : 'standard');

/** The numbers the settings give now: the preset, or the Custom numbers (held to their ranges); a pack never changes them. */
export function rulesFromSettings(values) {
    // Every roll planned from now on is a levelled one: the divisor is the Custom row's (3..8), else 5.
    const base = plainRulesFromSettings(values), custom = difficultyOf(values) === 'custom';
    const typed = custom ? divisorOf(values?.[STANDARD_SETTING]?.levelDivisor) : null;
    return { ...base, levelDivisor: typed ?? LEVEL.divisor };
}

function plainRulesFromSettings(values) {
    const difficulty = difficultyOf(values);
    if (difficulty === 'custom') return normalizeStandard({ ...values?.[STANDARD_SETTING], formula: 'standard' });
    return { ...STANDARD_PRESETS[difficulty] };
}

/** What of a pack's ask is in force now: `{ formula, numbers }`, both false (Standard is the only formula, and a pack cannot give numbers). Kept for the settings rows. */
export const packInForce = () => ({ formula: false, numbers: false });
