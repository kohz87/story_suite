// The job: checking `content.lore` (spec §7): titles, keys, World Info fields, the protected and hidden flags, and a hidden entry's gate.

import { LORE_FIELDS, LORE_LOGIC, WORLD_LIMITS } from '../../limits.js';
import { isObject, isText } from '../core.js';
import { checkGate } from './gate.js';

const words = value => Array.isArray(value) && value.length <= 200 && value.every(word => typeof word === 'string' && word.trim() && word.length <= 80);

/** `list` of lore entries; `makeCtx(path, label)` gives the per-entry check context. Returns the kept entries (plain copies). */
export function checkLore(list, makeCtx, add, warn) {
    if (!Array.isArray(list)) { add('BAD_CONTENT', 'content.lore', 'content.lore must be a list of { "title", "keys", "text" }.'); return []; }
    if (list.length > WORLD_LIMITS.lore) { add('BAD_CONTENT', 'content.lore', `content.lore holds at most ${WORLD_LIMITS.lore} entries.`); return []; }
    const out = [];
    const titles = new Set();
    list.forEach((record, index) => {
        const path = `content.lore[${index}]`;
        if (!isObject(record)) return add('BAD_RECORD', path, `${path} must be an object.`);
        const ctx = makeCtx(path, `Lore ${typeof record.title === 'string' ? `"${record.title}"` : path}`);
        const { say } = ctx;
        for (const key of Object.keys(record)) if (!LORE_FIELDS.includes(key)) say(key, `"${key}" is not a lore field (expected ${LORE_FIELDS.join(', ')}).`, 'UNKNOWN_FIELD');
        if (!isText(record.title, 120) || !record.title.trim()) say('title', 'title must be short text (1 to 120 characters).');
        else if (titles.has(record.title)) say('title', `two lore entries are titled "${record.title}"; titles are unique.`, 'DUPLICATE');
        if (!isText(record.text, 4000) || !record.text.trim()) say('text', 'text must be text of 1 to 4000 characters.');
        const constant = record.constant === true;
        if (!(words(record.keys) && (record.keys.length || constant || record.hidden === true))) say('keys', 'keys must be a list of names, places and terms that pull the entry in (a constant or hidden entry may have none).');
        if (record.secondaryKeys !== undefined && !words(record.secondaryKeys)) say('secondaryKeys', 'secondaryKeys must be a list of words.');
        if (record.logic !== undefined && !LORE_LOGIC.includes(record.logic)) say('logic', `logic must be one of ${LORE_LOGIC.join(', ')}.`);
        for (const flag of ['constant', 'protected', 'hidden']) if (record[flag] !== undefined && typeof record[flag] !== 'boolean') say(flag, `${flag} must be true or false.`);
        if (record.order !== undefined && !Number.isFinite(record.order)) say('order', 'order must be a number.');
        if (record.hidden === true && record.gate === undefined) say('gate', 'a hidden entry must have a gate (the condition that makes it revealable).');
        else if (record.gate !== undefined && record.hidden !== true) warn('UNUSED_GATE', `${path}.gate`, `Lore "${record.title}": a gate belongs on a hidden entry; this entry is not hidden, so nothing uses the gate.`);
        else if (record.gate !== undefined) checkGate(record.gate, ctx, 'gate');
        if (ctx.ok()) { titles.add(record.title); out.push(JSON.parse(JSON.stringify(record))); }
    });
    return out;
}
