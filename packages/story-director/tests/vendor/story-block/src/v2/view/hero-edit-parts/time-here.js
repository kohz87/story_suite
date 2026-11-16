// Hero editor: the time box's "HH:MM" and the people line, each read and written both ways.

import { short, HERE_MAX, NAME_MAX } from './shared-limits.js';

/** Minutes of a day (0..1439) as a time box's "HH:MM"; '' for anything else. */
export function timeText(minutes) {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) return '';
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** A time box's "HH:MM" (or "HH:MM:SS") as minutes of the day; null for anything else. */
export function timeMinutes(text) {
    const found = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(text ?? '').trim());
    if (!found) return null;
    const hours = Number(found[1]);
    const minutes = Number(found[2]);
    return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
}

/** The people as a comma-separated line, and back: names trimmed, empty ones dropped, each once (any case), at most HERE_MAX. */
export const hereText = names => (Array.isArray(names) ? names : []).join(', ');
export function hereNames(text) {
    const out = [];
    for (const piece of String(text ?? '').split(',')) {
        const name = short(piece, NAME_MAX);
        if (name && !out.some(other => other.toLowerCase() === name.toLowerCase())) out.push(name);
        if (out.length >= HERE_MAX) break;
    }
    return out;
}
