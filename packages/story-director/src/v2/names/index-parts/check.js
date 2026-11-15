// Story Director v2, names: the collision check of a name against the names already known.

import { OVERUSED } from './overused.js';
import { cleanName } from './text.js';
import { nameKey, bareKey, givenKey, sameName } from './keys.js';

const MIN_EDIT_LENGTH = 4;

// Strings one edit apart (one insertion, deletion or substitution), or equal.
function withinOneEdit(a, b) {
    if (a === b) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    if (long.length - short.length > 1) return false;
    let i = 0;
    while (i < short.length && short[i] === long[i]) i++;
    if (long.length === short.length) return short.slice(i + 1) === long.slice(i + 1);
    return short.slice(i) === long.slice(i + 1);
}

/**
 * The collision check of a name a reply brings in, against the names already known. `known` is an array of names or of
 * `{ name, by }` entries (`by` is a label the caller chooses; it is returned as given, so the caller decides what may
 * be said about an unmet person); `banned` is the setting's list (plus a pack's); `overused` the built-in list; `self` is
 * the person's own name, whose entry is skipped. Returns `{ ok, reasons }`, reasons in the order banned, overused, taken,
 * first, near, one per kind: `taken` (the same name), `first` (the same given name), `near` (a given name one edit away,
 * both four letters or more: "Bregja" for "Bregje").
 */
export function checkName(name, { known = [], banned = [], overused = OVERUSED, self = '' } = {}) {
    const cleaned = cleanName(name);
    const given = givenKey(cleaned);
    if (!nameKey(cleaned)) return { ok: false, reasons: [{ kind: 'empty' }] };
    const reasons = [];
    const add = (kind, by) => { if (!reasons.some(reason => reason.kind === kind)) reasons.push(by === undefined ? { kind } : { kind, by }); };

    for (const entry of banned) {
        const key = nameKey(entry);
        if (!key) continue;
        if (sameName(cleaned, entry) || (!key.includes(' ') && key === given)) { add('banned', cleanName(entry)); break; }
    }
    if (overused.some(word => nameKey(word) === given)) add('overused', given);

    const selfBare = nameKey(self) ? bareKey(self) : '';
    for (const entry of known) {
        const other = typeof entry === 'string' ? entry : entry?.name;
        const by = typeof entry === 'object' && entry?.by !== undefined ? String(entry.by) : undefined;
        if (!nameKey(other) || (selfBare && bareKey(other) === selfBare)) continue;
        const otherGiven = givenKey(other);
        if (sameName(cleaned, other)) add('taken', by);
        else if (given && otherGiven === given) add('first', by);
        else if (given.length >= MIN_EDIT_LENGTH && otherGiven.length >= MIN_EDIT_LENGTH && withinOneEdit(given, otherGiven)) add('near', by);
    }
    return { ok: reasons.length === 0, reasons };
}
