// Story Director: calendar name sanitization and weekday list parsing.
import { MAX_WEEK_DAYS, NAME_CHARS } from './defaults.js';

// One line, at most `max` characters: line breaks, tabs and control characters become one space, so a
// name from the settings cannot start a line of its own in the prompt ("[Happened]", "</Changes>").
export function oneLine(value, max) {
    const flat = String(value ?? '').replace(/[\s\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').trim();
    const chars = Array.from(flat);
    return chars.length > max ? chars.slice(0, max).join('').trimEnd() : flat;
}

// Day names from a list or from text ("Moonday, Tideday" or one per line), trimmed, once each.
export function parseWeek(value) {
    const list = Array.isArray(value) ? value : String(value ?? '').split(/[,\n]/);
    const seen = new Set();
    return list.map(name => oneLine(name, NAME_CHARS)).filter(name => {
        const key = name.toLowerCase();
        if (!name || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, MAX_WEEK_DAYS);
}
