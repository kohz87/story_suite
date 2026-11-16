// Prepares and rolls a plan (the Standard formula) and reads a block field's own maximum.
import { STANDARD } from '../rules.js';
import { prepareStandard, rollStandard } from '../standard.js';

export const prepare = (plan, sheet, rules = STANDARD, options = {}) => prepareStandard(plan, sheet, rules, options);

/**
 * Rolls a prepared plan: `source` is positionalDice's answer (each action draws from its own stream). → { checks, rounds, stop, text, summary } with the
 * rounds already cut to the stop and the cue budget. `rules` are the numbers in force (default: Standard); the most rounds is `rules.roundCap`. `earlier`: the
 * cue is fitted as it was for a roll of the earlier scheme (cue.js fitCue). Standard is the only formula: a roll with no `formula` replays as Standard.
 */
export function rollPrepared(plan, prepared, source, rules = STANDARD, { earlier = false, carried = null, flow = 1, wearOf = null, drop = null, opened = null, fix = false, then = false, noXp = false } = {}) {
    // (`fix`: a roll of stage 65, FIX_VERSION; `then`: of mark 3; without it the cue is told exactly as before, because its length decides how many rounds are told)
    return rollStandard(plan, prepared, source, rules, { carried, flow, wearOf, drop, opened, fix, then, noXp });
}

// The most a block's own field holds (the pinned definition's `max`): a block of an older definition holds at most 5 Health stages.
export const fieldMax = domain => (module, field) => {
    const max = domain?.pins?.[domain?.active?.[module]?.hash]?.definition?.state?.[field]?.max;
    return Number.isSafeInteger(max) ? max : Infinity;
};
