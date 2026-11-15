// Story Director v2, chronicle part: formats relative day labels and witness name suffixes for backlog lines.

import { agoText } from '../days/shared.js';
import { list } from './shared.js';

/** A day's body (its relevant lines) cut to this many characters. */
export const BODY_CHARS = 100;
/** A line names at most this many of the people who were there, then "+N". */
export const WITNESS_NAMES = 3;

/** The relative day of `days` days before today, in words (the story clock's own count; agoText beyond a day). */
export function agoWords(days) {
    if (!Number.isSafeInteger(days) || days < 0) return '';
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return agoText(days * 1440);
}

// The witnesses as a suffix: at most three names, then "+N" for the rest ("(Bregje, Torka, Dag +2)"); '' for none.
export function witnessText(who) {
    const names = [...new Set(list(who))];
    if (!names.length) return '';
    const shown = names.slice(0, WITNESS_NAMES).join(', ');
    return ` (${shown}${names.length > WITNESS_NAMES ? ` +${names.length - WITNESS_NAMES}` : ''})`;
}
