// Story Director v2, part **keypeople**: lists the away key people in the order the tail tells them.

import { awayOf, isInt, isRecord, tables } from '../domain.js';

/**
 * The away key people (pinned people with an away record), told in the tail's order: `[{ key, name, doing, since, back, due,
 * last: { date, text } | null, steps }]`. `now`: the story clock, or null.
 */
export function awayEntries(slice, now) {
    const { pins } = tables(slice);
    const out = [];
    for (const key of Object.keys(pins)) {
        const away = awayOf(slice, key);
        if (!away) continue;
        const back = isInt(away.back) ? away.back : null;
        const steps = Array.isArray(away.steps) ? away.steps.filter(isRecord) : [];
        const last = steps.at(-1) ?? null;
        out.push({
            key, name: String(pins[key].name ?? away.name ?? ''), doing: String(away.doing ?? ''), since: isInt(away.since) ? away.since : null, back,
            due: back !== null && isInt(now) && now >= back, last: last ? { date: isInt(last.date) ? last.date : null, text: String(last.text ?? '') } : null, steps,
        });
    }
    const soon = entry => (entry.back === null ? Infinity : entry.back);
    const late = entry => entry.last?.date ?? -Infinity;
    return out.sort((a, b) => soon(a) - soon(b) || late(b) - late(a) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
