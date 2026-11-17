// World events, the daily step: anchors (spec v0.10 §3 Anchors, anchor_mode). Each anchor's occurrences are the days it
// happened, kept in the step's state (`anchors`: key → days, oldest first); `set:` also counts an active condition's own start
// (a world line or a pack event set it). An offset ("fired:x + 90 days", tempo-scaled) makes it true that long after. Pure.

import { anchorString } from './grammar.js';
import { scaleDays } from './durations.js';

const DAY = 1440;
const KEEP = 8;

/** Record that `key` happened on `day` (once a day; the last KEEP occurrences are kept). */
export function recordAnchor(anchors, key, day) {
    const list = anchors[key] ?? [];
    if (list[list.length - 1] === day) return;
    anchors[key] = [...list, day].slice(-KEEP);
}

/** The days an anchor happened, oldest first. `stage:<id>` is `fired:<id>`; `start` is the step's first day; a season is not kept (none). */
export function occurrences(ws, anchor) {
    if (anchor.kind === 'start') return Number.isInteger(ws.startDay) ? [ws.startDay] : [];
    if (anchor.kind === 'season') return [];
    const kind = anchor.kind === 'stage' ? 'fired' : anchor.kind;
    const days = [...(ws.anchors[`${kind}:${anchor.id}`] ?? [])];
    if (kind === 'set') {
        const [name, ref] = anchor.id.split('@');
        for (const entry of Object.values(ws.table)) {
            if (entry.name !== name || (ref && entry.ref.toLowerCase() !== ref.trim().toLowerCase())) continue;
            const since = Math.floor(entry.since / DAY);
            if (!days.includes(since)) days.push(since);
        }
        days.sort((a, b) => a - b);
    }
    return days;
}

/** The day an anchor text counts from (first or latest occurrence by `mode`, plus its scaled offset), or null when it has not happened. */
export function anchorDay(ws, text, mode = 'first') {
    const anchor = typeof text === 'string' ? anchorString(text) : text;
    if (!anchor) return null;
    const days = occurrences(ws, anchor);
    if (!days.length) return null;
    const base = mode === 'each' ? days[days.length - 1] : days[0];
    return anchor.offset ? base + scaleDays(anchor.offset, ws.tempo) : base;
}

/** Whether an anchor text holds on `day`: it happened (and its offset has passed) by then. */
export function anchorHolds(ws, text, day) {
    const at = anchorDay(ws, text, 'first');
    return at !== null && at <= day;
}
