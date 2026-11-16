// Story Director: label-value splitting shared between change parsing and formatting.
import { FIELDS } from './fields.js';
import { isSpace, wordCount } from './shared-text.js';

// `label: value`: the label is words (so the `09` of `09:00` is not one) and the colon is
// followed by a space or the end (so `09:00` and `a:b` stay inside values). Read by labelled in
// one pass (it was `/^(\p{L}[\p{L}\p{N}'’ -]*?)\s*:(?:\s+|$)(.*)$/su`, quadratic on spaces).
const LABEL_WORDS = /^\p{L}[\p{L}\p{N}'’ -]*$/u;
// A known field may skip the space (`on:Haywane 13`); an arbitrary label may not.
const TIGHT_FIELD = /^(\p{L}+):(.*)$/su;

const MAX_EXTRA_LABEL_WORDS = 3;

// `[label, value]` for `label: value` (the label untrimmed of inner spaces), or null. The label can
// hold no colon, so only the first colon can end it.
function labelled(part) {
    const colon = part.indexOf(':');
    if (colon < 1) return null;
    const after = part.slice(colon + 1);
    if (after && !isSpace(after[0])) return null;
    const label = part.slice(0, colon).trimEnd();
    if (!LABEL_WORDS.test(label)) return null;
    return [label, after.trimStart()];
}

/** `{ field, value }`, `{ label, value }` (extra) or null for an unlabeled part. */
export function splitLabel(part) {
    const match = labelled(part);
    if (match) {
        const label = match[0].trim().toLowerCase();
        const value = match[1].trim();
        if (FIELDS.includes(label)) return { field: label, value };
        if (wordCount(label) <= MAX_EXTRA_LABEL_WORDS) return { label, value };
        return null;
    }
    const tight = part.match(TIGHT_FIELD);
    if (tight && FIELDS.includes(tight[1].toLowerCase())) {
        return { field: tight[1].toLowerCase(), value: tight[2].trim() };
    }
    return null;
}
