// Mark history: which rules an existing reply may keep or gain when its text is captured again.

import { adoptLegacy, assistSections, extractBlock, parseChanges } from '../../capture.js';
import { RULE_LINES } from './rule-lines.js';
import { foeLine } from './foe-line.js';
import { ruleMarksFor } from './mark-lists.js';

/** Rules that cannot be newly marked on an existing reply without changing its earlier lines on Re-read. */
export function previousMarks(before, heads, late = []) {
    if (before === undefined) return { foe: false, rules: [], first: true }; // A new reply or swipe: its first capture marks it with every rule.
    if (typeof before !== 'string') return { foe: true, rules: Object.keys(RULE_LINES) }; // Unknown previous text: stay conservative.
    const text = adoptLegacy(before).text;
    const block = extractBlock(text, 'Changes', null, { heads });
    const lines = [...parseChanges(block ?? '').lines, ...parseChanges(assistSections(text).now.join('\n')).lines, ...late];
    return { foe: lines.some(line => foeLine(line)), rules: ruleMarksFor(lines) };
}

/** Only replies seen being created here may gain their first mark after their initial capture. */
export function createMarkHistory() {
    const fresh = new WeakMap();
    return (message, sid, type, before, heads, late) => {
        const valid = message && typeof message === 'object' && typeof sid === 'string';
        if (type !== 'continue' && type !== 'late') {
            if (valid) {
                const ids = fresh.get(message) ?? new Set();
                ids.add(sid);
                fresh.set(message, ids);
            }
            return previousMarks(undefined, heads);
        }
        if (!valid || !fresh.get(message)?.has(sid)) return { foe: true, rules: Object.keys(RULE_LINES) };
        return previousMarks(before, heads, late);
    };
}
