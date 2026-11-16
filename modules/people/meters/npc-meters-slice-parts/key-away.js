// The memory of a key person's last absence (Story Director's director.keyPeople, read only) and its validation.
import { isInt, isObject } from '../npc-meters-config.js';
import { isKey, memoryKey, RECENT_REPLIES } from '../../cast/key-people.js';

// ---- key people: the memory of the last absence (Story Director's director.keyPeople, read only) ----
//
// The query says only who is away NOW; after a return it is null again. So the slice keeps `keyAway`: { [memoryKey]: { name, aliases,
// away: { doing, since, back, steps }, returnedAt: reply | null, presentReplies } } for a key person who has been away, until they
// have been present for RECENT_REPLIES replies. npc.tick writes it (observeKeyAway), so it is part of the replies' state: it follows
// swipes and deletes, and a reload never loses it. Absent while nobody has been away.

/**
 * Notes the answer (`people`, normalized) into the memory at reply `head`: { memory, changed }.
 * - a key person away now: their record as it stands (the newest steps), not yet returned;
 * - one who was away and is not any more: returned at `head`; each later reply they are `here` counts toward
 *   RECENT_REPLIES, after which the record is dropped (a person who is not here waits);
 * - anyone no longer a key person is dropped. No usable head or no answer: nothing is touched.
 */
export function observeKeyAway(memory, people, head) {
    const before = isObject(memory) ? memory : {};
    if (!Number.isInteger(head) || head < 0 || !Array.isArray(people)) return { memory: before, changed: false };
    const next = {};
    for (const entry of people) {
        if (!isKey(entry)) continue;
        const key = memoryKey(entry.name);
        if (!key) continue;
        const had = isObject(before[key]) && before[key].away ? before[key] : null;
        const record = { name: entry.name, aliases: [...entry.aliases], away: JSON.parse(JSON.stringify(entry.away ?? had?.away ?? null)) };
        if (entry.away) {
            next[key] = { ...record, returnedAt: null, presentReplies: 0 };
            continue;
        }
        if (!had) continue;
        const fresh = !isInt(had.returnedAt);
        const present = fresh ? 0 : (isInt(had.presentReplies) ? had.presentReplies : 0) + (entry.here ? 1 : 0);
        if (present >= RECENT_REPLIES) continue;
        next[key] = { ...record, returnedAt: fresh ? head : had.returnedAt, presentReplies: present };
    }
    const changed = JSON.stringify(next) !== JSON.stringify(before);
    return { memory: changed ? next : before, changed };
}

const KEY_AWAY_MAX = 40;
export function validateKeyAway(memory) {
    if (!isObject(memory)) return ['The key people memory is not a record.'];
    const errors = [];
    const entries = Object.entries(memory);
    if (entries.length > KEY_AWAY_MAX) errors.push(`The key people memory keeps at most ${KEY_AWAY_MAX} people.`);
    const text = (value, max) => typeof value === 'string' && value.length <= max;
    for (const [key, record] of entries) {
        const where = `The key people entry "${key}"`;
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
