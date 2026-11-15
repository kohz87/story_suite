// Story Director v2, chronicle part: text flattening, cutting, code-point counting, and relative time labels. Pure.

import { isInt, text } from './types.js';

// Invisible format marks and control characters go; whitespace folds to one space.
const INVISIBLE = /[\p{Cf}\p{Cc}]+/gu;

/** `value` as one flat line: invisible marks and line breaks gone, spaces folded. */
export function flat(value) {
    return text(value).replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();
}

/** `value` cut to `max` code points (never inside a character), with "…" when it was longer. */
export function cut(value, max) {
    const chars = Array.from(flat(value));
    if (chars.length <= max) return chars.join('');
    return `${chars.slice(0, Math.max(0, max - 1)).join('').trimEnd()}…`;
}

export const codePoints = value => Array.from(text(value)).length;

/** "this hour", "5 h ago", "3 days ago", "2 weeks ago", "4 months ago"; '' for an unknown span. */
export function agoText(minutes) {
    if (!isInt(minutes) || minutes < 0) return '';
    if (minutes < 60) return 'this hour';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(minutes / 1440);
    if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
    const months = Math.floor(days / 30);
    return months < 24 ? `${months} months ago` : `${Math.floor(days / 365)} years ago`;
}
