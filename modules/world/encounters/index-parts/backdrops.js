// A pack's backdrop list (proposed `content.backdrops`, owner question): checked and normalized. A bad entry is dropped with a
// Problem naming it and the field; the rest stay. Pure.

import { LIMITS } from './limits.js';

const TIMES = new Set(['night', 'dawn', 'morning', 'midday', 'afternoon', 'evening']);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const words = value => (Array.isArray(value) ? value : value === undefined ? [] : null);
const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function entryOf(raw, index, seen) {
    const name = isRecord(raw) && typeof raw.id === 'string' ? raw.id : `#${index + 1}`;
    const bad = (field, why) => ({ problem: `backdrops ${name}: ${field} ${why}` });
    if (!isRecord(raw)) return bad('entry', 'is not an object.');
    if (typeof raw.id !== 'string' || !ID.test(raw.id) || raw.id.length > LIMITS.id) return bad('id', 'must be a lower-case slug (ferryman, lock-boy).');
    if (seen.has(raw.id)) return bad('id', 'is used twice.');
    const who = text(raw.who, LIMITS.who);
    if (!who) return bad('who', 'must say who they are ("the ferryman").');
    const lists = {};
    for (const field of ['at', 'kinds', 'when', 'likelier_if', 'less_if']) {
        const list = words(raw[field]);
        if (!list || list.some(item => typeof item !== 'string' || !item.trim())) return bad(field, 'must be a list of words.');
        lists[field] = list.map(item => item.trim().toLowerCase());
    }
    if (lists.when.some(item => !TIMES.has(item))) return bad('when', `takes only ${[...TIMES].join(', ')}.`);
    if (!lists.at.length && !lists.kinds.length) return bad('at', 'or kinds must say where they are.');
    const weight = raw.weight === undefined ? 1 : raw.weight;
    if (!Number.isInteger(weight) || weight < 1 || weight > 10) return bad('weight', 'must be a whole number 1-10.');
    if (raw.recurring !== undefined && typeof raw.recurring !== 'boolean') return bad('recurring', 'must be true or false.');
    return { row: Object.freeze({ id: raw.id, who, look: text(raw.look, LIMITS.look), at: lists.at, kinds: lists.kinds, when: lists.when, likelier: lists.likelier_if, less: lists.less_if, weight, recurring: raw.recurring !== false, source: 'pack' }) };
}

/** `normalizeBackdrops(list)` → `{ rows, problems }`: the pack's backdrop rows in pack order (at most LIMITS.rows) and a Problem per dropped entry. */
export function normalizeBackdrops(list) {
    const rows = [];
    const problems = [];
    if (list === undefined || list === null) return { rows, problems };
    if (!Array.isArray(list)) return { rows, problems: ['backdrops must be a list.'] };
    const seen = new Set();
    for (const [index, raw] of list.entries()) {
        if (rows.length >= LIMITS.rows) { problems.push(`backdrops: only the first ${LIMITS.rows} are read.`); break; }
        const out = entryOf(raw, index, seen);
        if (out.problem) problems.push(out.problem);
        else { rows.push(out.row); seen.add(out.row.id); }
    }
    return { rows, problems };
}
