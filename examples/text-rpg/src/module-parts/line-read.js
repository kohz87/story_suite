// Reading a change line's parts: the text pieces after the name, a label, and the stat words.
import { STAT_KEYS } from '../words/stats.js';

/** The pieces of a line's text, split at the `;` the parser joins unlabelled `|` parts with. */
export function partsOf(line) {
    return String(line?.text ?? '').split(';').map(part => part.trim()).filter(Boolean);
}

/** A label's value (labels are lower case), or ''. */
export function labelOf(line, key) {
    const value = line?.labels?.[key];
    return typeof value === 'string' ? value.trim() : '';
}

/** A stat key (str…cha) from a word in any case, or null. */
export function statKey(word) {
    const key = String(word ?? '').trim().toLowerCase();
    return STAT_KEYS.includes(key) ? key : null;
}
