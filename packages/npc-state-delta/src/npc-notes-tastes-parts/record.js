// The stored taste record: reading a JSON leaf or array into valid capped rows and writing it back as text.
import { clean } from '../npc-meters-config.js';
import { TASTE_LIMITS, TASTE_RULE, LIKE, DISLIKE } from './shared-limits.js';
import { tasteWords, tasteKey } from './words.js';
import { isSign, limitOf } from './shared-signs.js';

export const replyTag = r => (typeof r === 'string' || typeof r === 'number' ? clean(r, TASTE_LIMITS.reply) || null : null);

// One stored row, or null when it is not a valid taste.
function readRow(entry, cite) {
    const words = cite ? tasteWords : clean;
    if (!entry || typeof entry !== 'object' || !isSign(entry.sign)) return null;
    const item = words(entry.item, TASTE_LIMITS.item);
    if (!tasteKey(item)) return null;
    const day = Number(entry.day);
    if (!Number.isInteger(day) || day < 0) return null;
    const row = { sign: entry.sign, item };
    const from = words(entry.from, TASTE_LIMITS.from);
    if (from) row.from = from;
    row.day = day;
    row.r = replyTag(entry.r);
    if (entry.mirrored === true) row.mirrored = true;
    if (entry.rule === TASTE_RULE) row.rule = TASTE_RULE;
    return row;
}

// Keeps the newest rows of each sign, in their original order.
export function capped(rows) {
    const counts = { [LIKE]: 0, [DISLIKE]: 0 };
    const kept = [];
    for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i];
        if (counts[row.sign] < limitOf(row.sign)) {
            counts[row.sign] += 1;
            kept.push(row);
        }
    }
    return kept.reverse();
}

/**
 * The NPC's tastes from a JSON text leaf or an array: valid rows only, first mention of an item wins, caps kept newest-first.
 * Default: citations stripped (display). { cite: false }: words exactly as stored (validity check and the write path).
 */
export function readTastes(raw, { cite = true } = {}) {
    let list = raw;
    if (typeof raw === 'string') {
        if (raw.length > TASTE_LIMITS.text) return [];
        try {
            list = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const rows = [];
    for (const entry of list) {
        const row = readRow(entry, cite);
        const key = row && tasteKey(row.item);
        if (!row || seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
    }
    return capped(rows);
}

/** The leaf text for a list of tastes (what readTastes reads back; stored rows are kept as they are, see readTastes). */
export function tastesText(list) {
    return JSON.stringify(readTastes(list, { cite: false }));
}
