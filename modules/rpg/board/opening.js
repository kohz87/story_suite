// The fight kind's opening setup: what a pre-check fight records before its first exchange (the groups the pre-check found, the rules and the practice in force).
// The opening itself is played by board/v1-opening.js. Pure: it reads the state it is given.
import { practiceOf } from '../names.js';
import { cueOfResult } from '../cue.js';
import { readSheet } from '../read.js';
import { normalizeRules } from '../rules.js';

// The slots of stale groups a pre-check put down: a non-empty list of foe slots (1–6), else undefined.
const staleOf = value => (Array.isArray(value) && value.length > 0 && value.length <= 6 && value.every(slot => Number.isInteger(slot) && slot >= 1 && slot <= 6) ? [...new Set(value)].sort((a, b) => a - b) : undefined);
const sheetOf = domain => readSheet({ domains: { dataModules: domain } });

/** The setup of an opening from what the pre-check recorded (`{ groups, key, rules, anchor, practice, stale }`); an error string when it cannot open. */
export function openingSetup({ groups, key, rules, anchor, practice, stale }) {
    if (!Array.isArray(groups) || !groups.length || typeof key !== 'string' || !key) return { error: 'There are no foes to open.' };
    return { setup: { id: `${anchor}:opening`, opening: true, key, open: structuredClone(groups), rules: normalizeRules(rules), practice: practiceOf(practice), start: anchor, ...(staleOf(stale) ? { stale: staleOf(stale) } : {}) } };
}

/** What the opening settle reads, as the pre-check's roll did: the party's sheet and the Foes block (a plain value the guard hashes). */
export const openingWitness = state => ({ sheet: sheetOf(state.domains.dataModules) });

/** The opening's note: the record's cue. */
export const openingNote = result => [cueOfResult(result, result.shape)];
