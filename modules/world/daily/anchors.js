// World events, the daily step: anchors (spec v0.10 §3 Anchors, anchor_mode). Each anchor's occurrences are the days it
// happened, kept in the step's state (`anchors`: key → days, oldest first); `set:` also counts an active condition's own start
// (a world line or a pack event set it). An offset ("fired:x + 90 days", tempo-scaled) makes it true that long after. Pure.

import { anchorString } from './grammar.js';
import { scaleDays } from './durations.js';

const DAY = 1440;
const KEEP = 8;

/**
 * Record that `key` happened on `day` (once a day). The first occurrence is kept for good (anchor_mode first, seam audit E24: the
 * ledger never loses it), and the last KEEP - 1 after it (anchor_mode each reads the latest).
 */
export function recordAnchor(anchors, key, day) {
    const list = anchors[key] ?? [];
    if (list.includes(day)) return;
    const next = [...list, day].sort((a, b) => a - b);
    anchors[key] = next.length > KEEP ? [next[0], ...next.slice(-(KEEP - 1))] : next;
}

/** A season anchor holds while the calendar is in that season (the offset, tempo-scaled, shifts it later); its day is the stretch's start. */
function seasonStart(ws, anchor, day) {
    if (!ws.cal || !Number.isInteger(day)) return null;
    const back = day - (anchor.offset ? scaleDays(anchor.offset, ws.tempo) : 0);
    return ws.cal.seasonOf(back) === anchor.id ? ws.cal.stretch(back).start + (day - back) : null;
}

/** The days an anchor happened, oldest first. `stage:<id>` is `fired:<id>`; `start` is the step's first day; a fixed date is its calendar day; a season is not kept (anchorDay and anchorHolds read it from the calendar). */
export function occurrences(ws, anchor) {
    if (anchor.kind === 'start') return Number.isInteger(ws.startDay) ? [ws.startDay] : [];
    if (anchor.kind === 'season') return [];
    if (anchor.kind === 'date') { const at = ws.cal?.dateDay(anchor.id) ?? null; return at === null ? [] : [at]; }
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
    if (anchor.kind === 'season') return seasonStart(ws, anchor, ws.day);
    const days = occurrences(ws, anchor);
    if (!days.length) return null;
    const base = mode === 'each' ? days[days.length - 1] : days[0];
    return anchor.offset ? base + scaleDays(anchor.offset, ws.tempo) : base;
}

/** Whether an anchor text holds on `day`: it happened (and its offset has passed) by then. */
export function anchorHolds(ws, text, day) {
    const anchor = typeof text === 'string' ? anchorString(text) : text;
    if (anchor?.kind === 'season') return seasonStart(ws, anchor, day) !== null;
    const at = anchorDay(ws, text, 'first');
    return at !== null && at <= day;
}
