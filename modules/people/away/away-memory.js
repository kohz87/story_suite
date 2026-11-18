// NPC State's memory of the last absence (the npc slice's `keyAway`, written by npc.tick, so it follows swipes, deletes and reloads with the
// replies): `director.away` says who is away NOW and who came back, so the memory keeps a returned person's absence until they have been
// present for RECENT_REPLIES replies, to give the narrator the "While away" note once, at the reply the return was noticed.
//   keyAway = { [memoryKey]: { name, aliases, away: { doing, since, back, steps }, returnedAt: reply | null, presentReplies } }

import { labelKey } from '../dossier/cast-dossier-parts/shared-text.js';
import { findAwayEntry } from './away-read.js';

const RECENT_REPLIES = 3;
const MAX = 40;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isInt = Number.isInteger;
const memoryKey = name => labelKey(name).replace(/ /g, '-').slice(0, 60);

/**
 * Notes the answer (`people`, normalized) into the memory at reply `head`: { memory, changed }. Someone away now: their record as it stands;
 * one who was away and is not any more: returned at `head`, each later reply they are `here` counts toward RECENT_REPLIES, then dropped;
 * the dead and anyone no longer listed are dropped. No usable head or no answer: nothing is touched.
 */
export function observeAway(memory, people, head) {
    const before = isObject(memory) ? memory : {};
    if (!isInt(head) || head < 0 || !Array.isArray(people)) return { memory: before, changed: false };
    const next = {};
    for (const entry of people) {
        const key = memoryKey(entry.name);
        if (!key || entry.removed || Object.keys(next).length >= MAX) continue;
        const had = isObject(before[key]) && before[key].away ? before[key] : null;
        const record = { name: entry.name, aliases: [...entry.aliases], away: JSON.parse(JSON.stringify(entry.away ?? had?.away ?? null)) };
        if (entry.away) { next[key] = { ...record, returnedAt: null, presentReplies: 0 }; continue; }
        if (!had) continue;
        const fresh = !isInt(had.returnedAt);
        const present = fresh ? 0 : (isInt(had.presentReplies) ? had.presentReplies : 0) + (entry.here ? 1 : 0);
        if (present >= RECENT_REPLIES) continue;
        next[key] = { ...record, returnedAt: fresh ? head : had.returnedAt, presentReplies: present };
    }
    const changed = JSON.stringify(next) !== JSON.stringify(before);
    return { memory: changed ? next : before, changed };
}

/** The memory's validator: [] or sentences. */
export function validateAwayMemory(memory) {
    if (!isObject(memory)) return ['The away memory is not a record.'];
    const errors = [];
    const entries = Object.entries(memory);
    if (entries.length > MAX) errors.push(`The away memory keeps at most ${MAX} people.`);
    const text = (value, max) => typeof value === 'string' && value.length <= max;
    for (const [key, record] of entries) {
        const where = `The away memory entry "${key}"`;
        if (!key || key.length > 60) { errors.push(`${where} has an unusable key.`); continue; }
        if (!isObject(record) || !text(record.name, 80) || !record.name || !Array.isArray(record.aliases) || record.aliases.length > 8 || !record.aliases.every(item => text(item, 80))) { errors.push(`${where} has no usable name.`); continue; }
        const away = record.away;
        if (!isObject(away) || !text(away.doing, 200) || !text(away.since, 40) || !text(away.back, 40) || !Array.isArray(away.steps) || away.steps.length > 12
            || !away.steps.every(step => isObject(step) && text(step.date, 40) && text(step.text, 200))) errors.push(`${where} has an unusable absence.`);
        if (record.returnedAt !== null && !(isInt(record.returnedAt) && record.returnedAt >= 0)) errors.push(`${where} has an unusable return.`);
        if (!isInt(record.presentReplies) || record.presentReplies < 0 || record.presentReplies >= RECENT_REPLIES) errors.push(`${where} has an unusable count of replies.`);
    }
    return errors;
}

/**
 * What the narrator is told once with a returned person's dossier, or '': where they went, the steps and the dates in one short line (at most
 * `max` characters, cut at a step, never mid-word). Only at the reply the return was noticed (`head` is `returnedAt`): a swipe of the next
 * reply repeats it, the next reply that stays drops it.
 */
export function returnNote(list, memory, npc, head, max = 360) {
    const entry = findAwayEntry(list, npc);
    if (!entry || entry.removed || entry.away) return '';
    const kept = isObject(memory) ? memory[memoryKey(entry.name)] : null;
    if (!isObject(kept) || !kept.away || !isInt(kept.returnedAt) || head !== kept.returnedAt) return '';
    const away = kept.away;
    const range = away.since && away.back ? `${away.since} – ${away.back}` : away.since ? `since ${away.since}` : away.back ? `until ${away.back}` : '';
    const top = `WHILE AWAY, NOW BACK${range ? ` (${range})` : ''}: ${away.doing || 'away'}`;
    const steps = (away.steps ?? []).map(step => (step.date ? `${step.date}: ${step.text}` : step.text));
    let text = top;
    // The newest steps matter most; keep as many as fit, oldest dropped first.
    for (let from = Math.max(0, steps.length - 4); from < steps.length; from += 1) {
        const candidate = `${top}; ${steps.slice(from).join('; ')}`;
        if (candidate.length <= max) { text = candidate; break; }
    }
    return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).replace(/\s+\S*$/, '').trimEnd()}…` : text;
}
