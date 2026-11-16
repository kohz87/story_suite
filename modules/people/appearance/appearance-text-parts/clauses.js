/* Appearance equality and clause splitting. A part of appearance-text.js (same owner, moved without change). */
import { appearanceText } from './basics.js';
import { normalizeName } from '../../core/core-text.js';

export function sameAppearance(a, b) { return normalizeName(a) === normalizeName(b); }
export function appearanceClauses(value, max) {
    return appearanceText(value, max).split(/\s*;\s*|(?<=[.!?])\s+/).map(part => appearanceText(part, max)).filter(Boolean);
}
