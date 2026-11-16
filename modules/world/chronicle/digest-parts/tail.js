// Story Director v2, chronicle part: the one tail line about the last day after a time skip. Pure.

import { dayOf, digestSettings, orderedDays, writtenOf } from '../days.js';
import { ask, digestOn, isInt } from './shared-ask.js';

export const YESTERDAY_TAG = '[Yesterday]';
export const LAST_DAY_TAG = '[Last day]';
/** About 60 tokens: the line is optional, and Story Block drops it before anything else. */
export const DIGEST_TAIL_BUDGET = 60;

// The time part's While away recap is for this reply (its own staleness rule, time/settle.js).
function recapLive(view) {
    const recap = ask(typeof view.query === 'function' ? (name, args) => view.query(name, args) : null, 'time.recap', {});
    if (!recap || !Array.isArray(recap.lines) || !recap.lines.length) return false;
    const at = isInt(view?.chat?.length) ? view.chat.length : null;
    if (isInt(at) && isInt(recap.at)) return at < recap.at + 2;
    const rev = view?.state?.meta?.rev;
    return !(isInt(rev) && isInt(recap.rev) && rev > recap.rev);
}

/**
 * The tail's optional line: the last day's one line (`[Yesterday] …`, or `[Last day] …` when it was
 * longer ago), for the reply right after a time skip or a While away recap. '' otherwise.
 */
export function digestTailLine(view) {
    const chronicle = view?.state?.domains?.chronicle;
    if (!chronicle || !digestOn(view)) return '';
    if (!digestSettings(view.settings).tail) return '';
    const minutes = view.state.domains.director?.time?.minutes;
    if (!isInt(minutes)) return '';
    const written = writtenOf(chronicle);
    const at = isInt(view?.chat?.length) ? view.chat.length : null;
    // This reply (or a swipe of it) is the one the digests were written for.
    const fresh = written && isInt(written.at) && isInt(at) && at >= written.at && at < written.at + 2;
    if (!(fresh && written.skip) && !recapLive(view)) return '';
    const today = dayOf(minutes);
    // The digests as their days' facts stand now (a reply of the last day deleted since: its facts gone).
    const query = typeof view.query === 'function' ? (name, args) => view.query(name, args) : null;
    const last = orderedDays(chronicle, { state: view.state, currency: ask(query, 'inventory.currency', {}) }).filter(digest => digest.day < today).at(-1);
    if (!last?.line) return '';
    return `${last.day === today - 1 ? YESTERDAY_TAG : LAST_DAY_TAG} ${last.line}`;
}
