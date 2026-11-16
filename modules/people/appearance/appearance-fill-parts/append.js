/* Accepting a fill result only when it keeps the stored text word for word and adds what was missing. A part of appearance-fill.js (same owner, moved without change). */
import { describedFeatures } from './features.js';
import { DURABLE_PROFILE_LIMITS } from '../../core/core-mechanics.js';
import { appearanceText } from '../appearance-text.js';

// What `next` adds to `prior`, or '': all of `prior` word for word, then more. A closing full stop (or ; ,) of `prior` may give way to the
// addition's own comma or semicolon: "... a tear-blotched face." extended as "... a tear-blotched face, watery blue eyes." loses no word.
function additionTo(prior, next) {
    if (!prior || !next) return '';
    if (next.startsWith(prior)) return next.slice(prior.length);
    const core = prior.replace(/[\s.;,]+$/, '');
    return core && core !== prior && next.startsWith(core) && /^[,;]\s*\S/.test(next.slice(core.length)) ? next.slice(core.length) : '';
}

/** True when `incoming` is an attempt to extend `previous` (starts with all of it and says more); such a result in a fill call is
 *  accepted by appendedLooks or refused, never handed to the ordinary rewrite gate. */
export function attemptsExtension(previous, incoming, limit = DURABLE_PROFILE_LIMITS?.appearance || 800) {
    return Boolean(additionTo(appearanceText(previous), appearanceText(incoming, limit + 1)));
}

/** The accepted text when `incoming` is `previous` kept word for word plus an addition that describes only what was missing and fits
 *  the limit; null otherwise (the record stays as it is). The code enforces what the prompt asks. */
export function appendedLooks(previous, incoming, limit = DURABLE_PROFILE_LIMITS?.appearance || 800) {
    const prior = appearanceText(previous);
    const next = appearanceText(incoming, limit + 1);
    // The normaliser upstream cuts an over-long answer to `limit` characters (then trims): a text that long may be cut, so it is refused.
    const addition = next.length >= limit - 1 ? '' : additionTo(prior, next);
    if (!addition) return null;
    if (!/\W/.test(next.slice(-addition.length - 1, -addition.length)) && /\w/.test(addition[0])) return null;   // a word was changed, not extended
    const have = describedFeatures(prior);
    return describedFeatures(addition).some(key => have.includes(key)) ? null : next;
}

export const FILL_MERGE_OPTION = 'fillBlankAppearance';
