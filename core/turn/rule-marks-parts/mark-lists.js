// Mark lists: the marks a record keeps, the rules parsed lines fall under, and every rule name.

import { RULE_LINES } from './rule-lines.js';

export const MAX_RULE_MARKS = 32;
const NAME = /^[A-Za-z][A-Za-z0-9]{0,31}$/u;

/** The marks a record keeps: known names only, sorted, no repeats, at most MAX_RULE_MARKS. Anything else in the field is ignored. */
export function ruleMarksOf(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter(name => typeof name === 'string' && NAME.test(name) && Object.hasOwn(RULE_LINES, name)))].sort().slice(0, MAX_RULE_MARKS);
}

/** The rules the parsed change lines fall under. */
export function ruleMarksFor(lines) {
    return Object.keys(RULE_LINES).filter(name => (lines ?? []).some(line => RULE_LINES[name](line))).sort();
}

/** Every rule a new reply is marked with at its first capture, whether or not it has such a line yet. */
export const allRuleNames = () => Object.keys(RULE_LINES).sort();
