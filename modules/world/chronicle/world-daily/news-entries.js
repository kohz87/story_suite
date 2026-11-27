// World events, the daily step on the host: what fired and ended becomes news (spec §4, seam audit E33, E34). Each happening that
// fires (an authored event, or a minor template's) is one chronicle entry per occurrence, written by the reply that crossed its day:
// `by: event:world.<spec id>` (a template's `event:world.template.<id>`: the `event:` lock keeps the narrator off it, E39, and the
// pulse never rumours it, E35; a pack's legacy event writes `event:pack.…`), `reach`,
// the place it happened (an event over a region or realm: its seat, the biggest place there, ties by id), `since` the start of the
// day it fired (a long skip dates each happening on its own day, so its news has already travelled by the landing). When the event
// ends, the same entry is resolved and `updated` that day: its end is news of its own, at the same reach and courier times. Lapsed
// and Replaced events are no entry (they are on the step's card). The name is the summary with its date, unique per occurrence.

import { cleanName, cleanSummary, findIn, prune } from '../domain.js';
import { sha256 } from '../../hash.js';
import { CLASS_WEIGHT, resolveRef } from '../../daily/geo.js';
import { MAX_NAME } from '../domain-parts/limits-text.js';
import { MAX_EVENTS } from '../domain-parts/limits-caps.js';

const DAY = 1440;
const MAX_SUMMARY = 240;
const low = text => String(text ?? '').trim().toLowerCase();
export const REACHES = Object.freeze(['local', 'regional', 'realm', 'world']);
/** The `by` of an entry the world's daily step wrote (spec events and templates), never a pack's legacy event. */
export const WORLD_BY = /^event:world\./;

/** The place news of a happening comes from: its bound place, else the first `where` ref's place, or the seat of its region or realm. */
function originOf(geo, entry) {
    if (entry.place) return entry.place;
    for (const ref of Array.isArray(entry.where) ? entry.where : []) {
        const found = resolveRef(geo, ref);
        if (found?.kind === 'place') return found.name;
        const inside = geo.places.filter(place => place.klass !== 'none' && (found?.kind === 'region' ? low(place.region) === low(found.name) : found?.kind === 'realm' && place.realm === found.name));
        const seat = inside.sort((a, b) => (CLASS_WEIGHT[b.klass] ?? 0) - (CLASS_WEIGHT[a.klass] ?? 0) || (a.id < b.id ? -1 : 1))[0];
        if (seat) return seat.name;
    }
    return '';
}

// The entry's id: fixed by who fired it and the day (ev_ + 8 of a hash), so a Re-read or a swipe that fires the same happening again
// writes the same entry, and a later reply's recorded copy of it replays onto it instead of making a second one.
const idOf = (by, day) => `ev_${BigInt(`0x${sha256(`${by}|${day}`).slice(0, 12)}`).toString(36).padStart(8, '0').slice(-8)}`;

// The text cut to at most `room` characters at a word end: never mid-word, and no dangling ":", ";", "," or dash ("…" says it was cut).
function wholeWords(text, room) {
    const flat = String(text).trim();
    if (flat.length <= room) return flat;
    const room1 = Math.max(room - 1, 1);
    const at = flat.lastIndexOf(' ', room1);
    const cut = (at > room1 / 2 ? flat.slice(0, at) : flat.slice(0, room1)).replace(/[\s:;,\-–—]+$/, '');
    return `${cut}…`;
}

// A name of at most MAX_NAME characters no other entry has: the summary, then " · <date>", then a number when needed.
function nameOf(events, text, date, id) {
    const tail = date ? ` · ${date}` : '';
    const head = wholeWords(cleanName(text).replace(/[.!?…]+$/, ''), MAX_NAME - tail.length - 4);
    for (let n = 1; n < 100; n += 1) {
        const name = `${head}${tail}${n > 1 ? ` (${n})` : ''}`;
        const taken = findIn(events, name);
        if (!taken || taken.id === id) return name;
    }
    return `${head}${tail}`.slice(0, MAX_NAME);
}

/**
 * Writes `journal` (the step's report) into `chronicle.events` on the draft: an entry per firing, resolved on its end. `dateOf(day)`
 * is the day as the calendar writes it. Returns `{ written, skipped }`: the ids written, and the summaries not written (the chronicle was full).
 */
export function writeHappenings(ctx, chronicle, journal, { geo, rev, dateOf = () => '' }) {
    const written = [];
    const skipped = [];
    for (const entry of Array.isArray(journal) ? journal : []) {
        const template = typeof entry.by === 'string' && entry.by.startsWith('template:');
        const by = template ? `event:world.template.${entry.by.slice('template:'.length)}` : `event:world.${entry.by}`;
        const at = entry.day * DAY;
        if (entry.ended) {
            const open = Object.values(chronicle.events).filter(event => event.by === by && event.state !== 'resolved').sort((a, b) => (b.since ?? 0) - (a.since ?? 0))[0];
            if (!open) continue;
            if (typeof ctx.ifThere === 'function') ctx.ifThere('chronicle', `/events/${open.id}`);
            // An end with no words of its own resolves the entry and keeps what it said.
            Object.assign(open, { state: 'resolved', summary: cleanSummary(String(entry.text)).slice(0, MAX_SUMMARY) || open.summary, updated: at, rev });
            written.push(open.id);
            continue;
        }
        if ((!entry.fired && !template) || !String(entry.text ?? '').trim()) continue;
        const id = idOf(by, entry.day);
        const next = {
            id, name: nameOf(chronicle.events, entry.text, dateOf(entry.day), id), summary: cleanSummary(String(entry.text)).slice(0, MAX_SUMMARY),
            state: template ? 'resolved' : 'ongoing', since: at, updated: at, place: cleanName(originOf(geo, entry)).slice(0, MAX_NAME),
            factions: [], aka: [], rev, by, reach: REACHES.includes(entry.reach) ? entry.reach : template ? 'local' : 'regional',
        };
        const old = chronicle.events[id];
        // The same happening written again (a Re-read, or a later reply's record replayed): kept as it is when nothing but the receipt differs.
        if (old && JSON.stringify({ ...old, rev: 0 }) === JSON.stringify({ ...next, rev: 0 })) continue;
        // The chronicle keeps at most MAX_EVENTS entries: with that many and none resolved to make room, the happening is not written
        // (it stays on the step's card, with a warning), so the step never leaves a chronicle the validator refuses.
        if (!old) prune(chronicle);
        if (!old && Object.keys(chronicle.events).length >= MAX_EVENTS) { skipped.push(entry.text); continue; }
        if (old && typeof ctx.ifThere === 'function') ctx.ifThere('chronicle', `/events/${id}`);
        chronicle.events[id] = next;
        written.push(id);
    }
    if (written.length) prune(chronicle);
    return { written, skipped };
}
