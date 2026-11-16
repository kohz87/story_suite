// The numbers a draft's creation runs on and the level it starts at.

import { LEVEL, CREATION } from '../../names.js';
import { STANDARD_FORMULA, isStandard } from '../../rules.js';
import { levelOfClass } from '../../formula.js';
import { isRecord, clamp } from './shared-helpers.js';

/**
 * The numbers creation runs on under `rules`: `{ ...CREATION, start, budget, min, max, statMax, perSoul, standard: true }` from the rules' startStat,
 * createPoints, createMin, createMax, statMax and pointsPerSoul (the Standard preset's when `rules` are not Standard).
 */
export function creationOf(rules) {
    if (!isStandard(rules)) rules = STANDARD_FORMULA;
    return { ...CREATION, start: rules.startStat, budget: rules.createPoints, min: rules.createMin, max: rules.createMax, statMax: rules.statMax, perSoul: rules.pointsPerSoul, standard: true };
}

/** The numbers a draft runs on: its own `creation`, else the Standard preset's. */
export const draftCreation = draft => (draft?.creation?.standard === true ? draft.creation : creationOf(STANDARD_FORMULA));

// A draft's `creation` as the dialog may hand it back: whole numbers in range, else dropped (the draft then runs on the Standard preset's).
export function readCreation(raw) {
    if (!isRecord(raw) || raw.standard !== true) return null;
    const whole = (value, low, high) => (Number.isSafeInteger(value) && value >= low && value <= high ? value : null);
    const start = whole(raw.start, 1, 10), budget = whole(raw.budget, 0, 400), min = whole(raw.min, 1, 10), max = whole(raw.max, 3, 20), statMax = whole(raw.statMax, 10, 20), perSoul = whole(raw.perSoul, 0, 10);
    if ([start, budget, min, max, statMax, perSoul].includes(null) || !(min <= start && start <= max && max <= statMax)) return null;
    return { ...CREATION, start, budget, min, max, statMax, perSoul, standard: true };
}

/** The level a draft starts at (a new character 1; a companion who joins or an imported one, the level their class or file stands for). */
export const draftLevel = draft => (Number.isSafeInteger(draft?.level) && draft.level > 1 ? clamp(draft.level, 1, LEVEL.max)
    : Number.isSafeInteger(draft?.soul) && draft.soul >= 1 ? clamp(levelOfClass(clamp(draft.soul, 1, 9)), 1, LEVEL.max) : 1);
