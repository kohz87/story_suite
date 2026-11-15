// Works out what changed between two sets of leaves and the text that tells it.

import { cutAt } from '../../text.js';
import { plainText } from './text-of.js';

// The most text the `summary` of `story:reply` holds.
const SUMMARY_MAX = 500;

/** The changes from the leaves `before` to the leaves `after` (Maps of path → value): [{ path, from, to }] by path, `null` for none. */
export function diffLeaves(before, after) {
    const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
    const changes = [];
    for (const path of paths) {
        const from = before.has(path) ? before.get(path) : null;
        const to = after.has(path) ? after.get(path) : null;
        if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ path, from, to });
    }
    return changes;
}

export const summaryOf = changes => cutAt(changes.map(change => `${change.path}: ${plainText(change.to) ?? 'none'}`).join('; '), SUMMARY_MAX);
