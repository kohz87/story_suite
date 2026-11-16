// Checks a recorded set of dice and a recorded bonus table.

import { FORMULA, LIMITS, STATS, practiceOf } from '../../names.js';
import { CHECK_DICE_COUNT } from './roll.js';
import { inRange, isObject } from './shared-checks.js';

/** A recorded set of dice, rules, difficulty numbers and practice, checked: { list, rules, dc, perUse } or null. */
export function diceOf(value) {
    if (!isObject(value) || !Array.isArray(value.list) || value.list.length !== CHECK_DICE_COUNT || !value.list.every(die => Number.isSafeInteger(die) && die >= 1 && die <= FORMULA.die)) return null;
    const rules = isObject(value.rules) ? value.rules : null, dc = isObject(value.dc) ? value.dc : null;
    if (!rules || !dc || !['costMargin', 'decisiveMargin', 'classWeight'].every(key => inRange(rules[key], 40)) || !(rules.levelDivisor === undefined || inRange(rules.levelDivisor, 8))) return null;
    if (!Object.keys(LIMITS.dc).every(key => inRange(dc[key], 60)) || practiceOf(value.perUse) === null) return null;
    return { list: [...value.list], rules: { ...(rules.levelDivisor ? { levelDivisor: rules.levelDivisor } : {}), classWeight: rules.classWeight, costMargin: rules.costMargin, decisiveMargin: rules.decisiveMargin },
        dc: Object.fromEntries(Object.keys(LIMITS.dc).map(key => [key, dc[key]])), perUse: value.perUse };
}

export const tableOf = value => (Array.isArray(value) ? value.slice(0, 8).filter(row => isObject(row) && typeof row.who === 'string' && row.who && Array.isArray(row.stats) && row.stats.length === STATS.length
    && row.stats.every(Number.isSafeInteger) && Array.isArray(row.skills)).map(row => ({ who: [...row.who].slice(0, 40).join(''), stats: [...row.stats],
    skills: row.skills.slice(0, 11).filter(entry => Array.isArray(entry) && typeof entry[0] === 'string' && Number.isSafeInteger(entry[1])).map(entry => [[...entry[0]].slice(0, 40).join(''), entry[1]]) })) : []);
