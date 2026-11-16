// Setting a scanner mood word's numbers on a mood and writing its cause line.
import { flatText } from './shared-checks.js';
import { dayOf } from './axes.js';
import { cleanReason } from './text.js';
import { decayMood } from './settle.js';

/**
 * A mood word's numbers set on a mood at story minute `minutes`: the old mood settles to now (the fade toward rest), the axes become the word's
 * numbers, and the easing is anchored there. `change` is what the axes moved by from the settled values ({ v, a, d }, whole numbers), `cause` the
 * plain cause text ("now mortified and flustered" or "now mortified and flustered — why"). target null (no known word): the settled mood, no change.
 */
export function applyWord(mood, minutes, target, word, reason = '') {
    const settled = decayMood(mood, minutes);
    // No numbers and no known word: the axes and their fade stay as they were; the reason says so (never silently nothing).
    if (!target) return { mood: { ...settled, cause: causeLine(word, UNRATED) }, change: { v: 0, a: 0, d: 0 } };
    const next = { ...settled, v: target.v, a: target.a, d: target.d, cause: causeLine(word, reason), at: dayOf(minutes), from: { v: target.v, a: target.a, d: target.d } };
    return { mood: next, change: { v: next.v - settled.v, a: next.a - settled.a, d: next.d - settled.d } };
}

export const UNRATED = 'mood word not rated';

function causeLine(word, reason) {
    const w = flatText(word);
    const why = flatText(reason);
    return cleanReason(why ? `now ${w} — ${why}` : `now ${w}`);
}
