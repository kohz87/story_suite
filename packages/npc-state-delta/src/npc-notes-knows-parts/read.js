// Cleaning one know entry and reading the stored knows leaf into a list.
import { KNOWS_MAX, KNOW_FACT_MAX, KNOW_ABOUT_MAX, KNOWS_TEXT_MAX } from './shared-limits.js';
import { KNOW_HOW, KNOW_RULE } from './shared-marks.js';
import { clean, wholeDay, replyKeyOk } from './shared-clean.js';

/**
 * One stored or written entry, cleaned: { about, fact, how, day, r, secret? } or null. `about` and `fact` are needed, `how` is
 * 'saw' or 'heard' only, `r` is the reply key, `day` is a whole story day or null. `secret` is kept only when it is true.
 */
export function knowOf(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const about = clean(item.about, KNOW_ABOUT_MAX);
    const fact = clean(item.fact, KNOW_FACT_MAX);
    if (!about || !fact || !KNOW_HOW.includes(item.how) || !replyKeyOk(item.r)) return null;
    if (item.day !== undefined && item.day !== null && wholeDay(item.day) === null) return null;
    const entry = { about, fact, how: item.how, day: wholeDay(item.day), r: item.r };
    if (item.secret === true) entry.secret = true;
    if (item.rule === KNOW_RULE) entry.rule = KNOW_RULE;
    return entry;
}

/** A source (the stored text, or an array of entries) as clean entries, at most KNOWS_MAX, oldest first. */
export function listOf(source) {
    if (typeof source === 'string') return readKnows(source);
    return Array.isArray(source) ? source.map(knowOf).filter(Boolean).slice(-KNOWS_MAX) : [];
}

/** The stored list of a record's `knows` leaf (JSON text), oldest first, at most KNOWS_MAX. Bad text or bad entries give nothing for those parts. */
export function readKnows(text) {
    if (typeof text !== 'string' || !text || text.length > KNOWS_TEXT_MAX) return [];
    let value;
    try { value = JSON.parse(text); } catch { return []; }
    if (!Array.isArray(value)) return [];
    return value.map(knowOf).filter(Boolean).slice(-KNOWS_MAX);
}
