// The per-reply mood change history: reading the stored text and adding a reply's move to it.
import { MOOD_MIN, MOOD_MAX } from './axes.js';
import { cleanReason } from './text.js';

// ---- the per-reply mood change history (record.moodLog) ----
// ONE text leaf (compact JSON { e: [...] }, like lastEvent): the last MOOD_LOG_MAX moves of the axes, newest first: { n: reply number (the message index) or null, s: the reply's record id when known (the same-reply key), date: the
// story date before the reply, v/a/d: the change of each axis (whole numbers, a zero left out), why: the plain reason }. Written in the same op as the
// move, so a swipe or a replay gives the same list; a record without it (an old chat) has an empty history. Display only: nothing that decides reads it.

export const MOOD_LOG_MAX = 6;
const LOG_TEXT_MAX = 1100;   // under the slice's text-leaf limit (1200)
const LOG_WHY_MAX = 100;

/** The valid entries of a stored history text (or array), newest first; anything unreadable is an empty list. */
export function readMoodLog(raw) {
    let list = raw;
    if (typeof raw === 'string') { try { list = JSON.parse(raw); } catch { return []; } }
    list = list && typeof list === 'object' && !Array.isArray(list) ? list.e : null;
    if (!Array.isArray(list) || (typeof raw === 'string' && raw.length > LOG_TEXT_MAX)) return [];
    const whole = value => Number.isSafeInteger(value) && value >= 2 * MOOD_MIN && value <= 2 * MOOD_MAX && value !== 0;
    return list.slice(0, MOOD_LOG_MAX).filter(item => item && typeof item === 'object' && !Array.isArray(item)
        && (item.n === null || (Number.isSafeInteger(item.n) && item.n >= 0)) && typeof item.date === 'string' && typeof item.why === 'string' && (item.s === undefined || typeof item.s === 'string')
        && ['v', 'a', 'd'].every(key => item[key] === undefined || whole(item[key])) && ['v', 'a', 'd'].some(key => item[key] !== undefined))
        .map(item => ({ n: item.n, ...(item.s ? { s: item.s.slice(0, 60) } : {}), date: item.date.slice(0, 40), ...Object.fromEntries(['v', 'a', 'd'].filter(key => item[key] !== undefined).map(key => [key, item[key]])), why: cleanReason(item.why).slice(0, LOG_WHY_MAX) }));
}

/**
 * The history text after this reply's move: `entry` { n, s, date, change: { v, a, d }, why }. A reply that already has an entry takes this move on top of it
 * (the changes add, the reasons join): the same reply is the same record id `s` when both know one, else the same message index `n`, so a delete in the middle
 * of the chat does not join two replies. A merge that nets to zero drops that reply's row. An all-zero change on a reply with no row adds nothing (null).
 */
export function nextMoodLog(prior, { n = null, s = null, date = '', change, why = '' }) {
    const moved = ['v', 'a', 'd'].filter(key => change?.[key]);
    const old = readMoodLog(prior);
    if (!moved.length) return null;
    const sid = typeof s === 'string' && s ? s : null;
    const same = old.length && (sid && old[0].s ? old[0].s === sid : n !== null && old[0].n === n) ? old[0] : null;
    const merged = Object.fromEntries(['v', 'a', 'd'].map(key => [key, (same?.[key] ?? 0) + (change[key] ?? 0)]).filter(([, value]) => value));
    const rest = old.slice(same ? 1 : 0);
    if (!Object.keys(merged).length) return same ? JSON.stringify({ e: rest }) : null;
    const reason = [same?.why, cleanReason(why)].filter(Boolean).filter((text, i, all) => all.indexOf(text) === i).join('; ');
    const head = { n, ...(sid ? { s: sid } : {}), date: String(date || '').slice(0, 40), ...merged, why: cleanReason(reason).slice(0, LOG_WHY_MAX) };
    const text = JSON.stringify({ e: [head, ...rest].slice(0, MOOD_LOG_MAX) });
    return text.length <= LOG_TEXT_MAX ? text : null;
}
