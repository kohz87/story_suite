// The job: checking a game pack's `content.start` (the player's money and items) and `content.pacing`.

import { GAME_PACING_LIMITS, GAME_START_FIELDS, GAME_START_LIMITS } from '../../limits.js';
import { oneLine, foldKey } from '../../../core/text.js';
import { isInt, isNumber, isObject } from '../core.js';

/** `{ money?: whole number 0 or more, items?: [{ name, qty?, note? }] }`: the player's start. Item names are matched to the world's items (or made up) when a chat begins, so they are only text here. → the normalized start or null. */
export function checkGameStart(start, add) {
    const at = 'content.start';
    const L = GAME_START_LIMITS;
    if (!isObject(start)) { add('BAD_START', at, 'start must be { "money": 40, "items": [{ "name": "Rope", "qty": 1 }] }.'); return null; }
    let ok = true;
    const bad = (path, message) => { ok = false; add('BAD_START', path, message); };
    for (const key of Object.keys(start)) {
        if (GAME_START_FIELDS.includes(key)) continue;
        ok = false;
        add('UNKNOWN_FIELD', `${at}.${key}`, key === 'world' || key === 'date' || key === 'place' ? `"${key}" belongs in the world pack (content.start).` : `"${key}" is not a game start field (expected ${GAME_START_FIELDS.join(', ')}).`);
    }
    if (start.money !== undefined && (!isInt(start.money) || start.money > L.money)) bad(`${at}.money`, `money must be a whole number from 0 to ${L.money}.`);
    const items = [];
    if (start.items !== undefined) {
        if (!Array.isArray(start.items) || start.items.length > L.items) bad(`${at}.items`, `items must be a list of at most ${L.items} { "name", "qty", "note" }.`);
        else start.items.forEach((entry, index) => {
            const here = `${at}.items[${index}]`;
            if (!isObject(entry) || Object.keys(entry).some(key => !['name', 'qty', 'note'].includes(key))) return bad(here, `${here} must be { "name", "qty", "note" }.`);
            const name = typeof entry.name === 'string' ? oneLine(entry.name) : '';
            if (!name || name.length > L.name) return bad(`${here}.name`, `name must be text of 1 to ${L.name} characters.`);
            if (items.some(item => foldKey(item.name) === foldKey(name))) return bad(`${here}.name`, `"${name}" is listed twice.`);
            if (entry.qty !== undefined && (!isInt(entry.qty, 1) || entry.qty > L.qty)) return bad(`${here}.qty`, `qty must be a whole number from 1 to ${L.qty}.`);
            if (entry.note !== undefined && (typeof entry.note !== 'string' || entry.note.length > L.note)) return bad(`${here}.note`, `note must be text of at most ${L.note} characters.`);
            items.push({ name, qty: entry.qty ?? 1, note: oneLine(entry.note ?? '') });
        });
    }
    return ok ? { ...(start.money !== undefined ? { money: start.money } : {}), ...(start.items !== undefined ? { items } : {}) } : null;
}

/** `{ tempo?: 0.25 to 4 }`: how fast the world moves. → `{ tempo? }` or null. */
export function checkPacing(pacing, add) {
    const at = 'content.pacing';
    const { min, max } = GAME_PACING_LIMITS;
    if (!isObject(pacing)) { add('BAD_CONTENT', at, 'pacing must be { "tempo": 1 }.'); return null; }
    let ok = true;
    for (const key of Object.keys(pacing)) if (key !== 'tempo') { ok = false; add('UNKNOWN_FIELD', `${at}.${key}`, `"${key}" is not a pacing field (expected tempo).`); }
    if (pacing.tempo !== undefined && (!isNumber(pacing.tempo) || pacing.tempo < min || pacing.tempo > max)) { ok = false; add('BAD_CONTENT', `${at}.tempo`, `tempo must be a number from ${min} to ${max} (1 is the usual pace).`); }
    return ok ? { ...(pacing.tempo !== undefined ? { tempo: pacing.tempo } : {}) } : null;
}
