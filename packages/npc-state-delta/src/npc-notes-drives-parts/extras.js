// The per-drive extras kept in the stored leaf: checking, reading and writing the leaf text.
import { DRIVES } from './shared-table.js';
import { KEYS } from './shared-strength.js';

const SOURCES = new Set(['p', 'd', 'u', 'l']);

export const serialize = (drives, extras) => {
    const out = Object.fromEntries(DRIVES.map(drive => [drive.key, drives[drive.key]]));
    const x = Object.fromEntries(DRIVES.filter(drive => extras && extras[drive.key] && Object.keys(extras[drive.key]).length).map(drive => [drive.key, extras[drive.key]]));
    if (Object.keys(x).length) out.x = x;
    return JSON.stringify(out);
};
// Per-drive extras: { s: p|d|u|l (pack, description, grew, eased), n: moments, c: cue word, e: 'u|d:reply' pending evidence }.
export function validExtras(x) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
    return Object.keys(x).every(key => KEYS.has(key) && x[key] && typeof x[key] === 'object' && !Array.isArray(x[key])
        && Object.keys(x[key]).every(field => ['s', 'n', 'c', 'e'].includes(field))
        && (x[key].s === undefined || SOURCES.has(x[key].s)) && (x[key].n === undefined || (Number.isInteger(x[key].n) && x[key].n >= 0 && x[key].n <= 999))
        && (x[key].c === undefined || (typeof x[key].c === 'string' && x[key].c.length <= 24)) && (x[key].e === undefined || (typeof x[key].e === 'string' && x[key].e.length <= 48)));
}
// The stored extras ({} when none or unreadable).
export function readExtras(leaf) {
    if (typeof leaf !== 'string' || !leaf) return {};
    try { const parsed = JSON.parse(leaf); return parsed && validExtras(parsed.x) ? parsed.x : {}; } catch { return {}; }
}
