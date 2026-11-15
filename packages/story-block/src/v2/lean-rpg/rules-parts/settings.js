// The numbers the settings give now, what a pack asks for, and which of its asks is in force.
import { LEVEL, levelCapOf } from '../names.js';
import { divisorOf } from './levels.js';
import { DIFFICULTY_SETTING, STANDARD_SETTING } from './numbers.js';
import { DIFFICULTIES, STANDARD_PRESETS } from './presets.js';
import { normalizeStandard } from './normalize.js';

/**
 * What a pack asks for, from its `content.rpg` records (packs/validate.js keeps `formula` and `numbers` as one record with the slug `formula`):
 * `{ formula?, numbers? }`, or null. The reader's own choices win over it: it is the default of a story whose reader has not chosen.
 */
export function packRulesOf(records) {
    const found = (Array.isArray(records) ? records : []).find(record => record && typeof record === 'object' && record.slug === 'formula' && (record.formula || record.numbers || levelCapOf(record.levelCap)));
    if (!found) return null;
    return { ...(typeof found.pack === 'string' ? { pack: found.pack } : {}), ...(levelCapOf(found.levelCap) ? { levelCap: found.levelCap } : {}), ...(found.formula === 'standard' ? { formula: found.formula } : {}),
        ...(found.numbers && typeof found.numbers === 'object' && !Array.isArray(found.numbers) ? { numbers: { ...found.numbers } } : {}) };
}

/** The difficulty the settings say: a known word, else Standard. */
export const difficultyOf = values => (DIFFICULTIES.includes(values?.[DIFFICULTY_SETTING]) ? values[DIFFICULTY_SETTING] : 'standard');

/** The numbers the settings give now: the preset, or the Custom numbers (held to their ranges); `pack` (packRulesOf) fills in what the reader has not chosen. */
export function rulesFromSettings(values, pack = null) {
    // Every roll planned from now on is a levelled one: the divisor is the Custom row's (3..8), else 5.
    const base = plainRulesFromSettings(values, pack), custom = difficultyOf(values) === 'custom';
    const typed = custom ? divisorOf(values?.[STANDARD_SETTING]?.levelDivisor) : null;
    return { ...base, levelDivisor: typed ?? LEVEL.divisor };
}

function plainRulesFromSettings(values, pack) {
    const difficulty = difficultyOf(values);
    if (difficulty === 'custom') return normalizeStandard({ ...values?.[STANDARD_SETTING], formula: 'standard' });
    const preset = { ...STANDARD_PRESETS[difficulty] };
    // A pack's numbers are the defaults of a reader who never picked a difficulty; a picked difficulty is the reader's.
    const asked = pack?.numbers && !DIFFICULTIES.includes(values?.[DIFFICULTY_SETTING]) ? pack.numbers : null;
    return asked ? normalizeStandard({ ...preset, ...asked, formula: 'standard' }) : preset;
}

/**
 * What of a pack's ask is in force now: `{ formula, numbers }` booleans. Standard is the only formula, so `formula` is never an ask in force; the numbers are
 * the pack's when the reader has not picked a difficulty (the rules of rulesFromSettings).
 */
export function packInForce(values, pack) {
    if (!pack) return { formula: false, numbers: false };
    return { formula: false,
        numbers: Boolean(pack.numbers) && !DIFFICULTIES.includes(values?.[DIFFICULTY_SETTING]) && difficultyOf(values) !== 'custom' };
}
