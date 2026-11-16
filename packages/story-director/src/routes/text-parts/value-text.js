// Small range, date, and capitalization formatting helpers for route text.

import { num } from '../util.js';

export function rangeText(range) {
    if (!range) return '?';
    return range.low === range.high ? num(range.low) : `${num(range.low)}–${num(range.high)}`;
}

export function dateText(value, calendar) {
    if (typeof value === 'number' && calendar) return calendar.format(value, { era: false });
    return String(value);
}

export function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
