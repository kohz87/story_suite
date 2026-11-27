// The Director's verdicts on the narrator's new world entries (and on tomorrow's daily roll: `marks`) reach the chat through one command, `chronicle.world.judged` (switch
// story-director.world-events), run in beforeGenerate (the message before the next reply, as the open templates' answers: a swipe, delete
// or Re-read of a reply never takes a stored verdict away). The asking is the arc judge's (modules/arc/judge/world-ask.js); this writes.
// Code has the last word: a verdict is used only on an entry still waiting with the same words (`judge.key`); a reshape is read again by the
// world line's own reading (same name; its place must be one the map knows) and is the line's result kept when it does not read; a refusal
// ends the entry (heard nowhere: a false rumour) and lifts the conditions its line set that still stand as the line set them.

import { cleanName, cleanSummary, keyOf, revOf } from '../domain.js';
import { clockOf } from '../capture/text.js';
import { parseChanges } from '../../changes.js';
import { yearOf } from '../conditions/director-calls.js';
import { calendarFrom } from '../queries.js';
import { WORLD_EVENTS_FEATURE, worldEventsOn } from '../conditions/feature.js';
import { judgedErrors, storeJudged } from './calls.js';
import { readWorld } from '../world-daily/read-world.js';
import { fadedWords } from '../world-daily/summary.js';
import { buildGeo } from '../../daily/geo.js';

export const JUDGED = 'chronicle.world.judged';
const VERDICTS = new Set(['accept', 'reshape', 'refuse', 'fell']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const flat = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// The judge's corrected line as `{ summary, place }` for `event`, or null when it does not read as the same entry or names a place the map does not know.
function reshapeOf(ctx, event, line) {
    const op = parseChanges(`+ event ${flat(line, 600)}`).ops[0];
    if (!op || keyOf(cleanName(op.key)) !== keyOf(event.name)) return null;
    const summary = cleanSummary(op.fields?.desc ?? '');
    const placeText = cleanName(op.fields?.place ?? op.extra?.place ?? '');
    let place = event.place;
    if (placeText && keyOf(placeText) !== keyOf(event.place)) {
        let found = null;
        try { found = ctx.query('atlas.place', { name: placeText }); } catch { found = null; }
        if (!found) return null;
        place = placeText;
    }
    return summary || place !== event.place ? { summary: summary || event.summary, place } : null;
}

// Lifts the conditions the refused line set, where they still stand as it set them (by the narrator, since the entry began).
function liftConditions(ctx, event) {
    const table = ctx.draft('chronicle').conditions ?? {};
    const lifted = [];
    for (const key of event.judge.conditions ?? []) {
        const entry = table[key];
        if (!isRecord(entry) || entry.by !== 'narrator' || entry.since !== event.since) continue;
        try {
            ctx.call('chronicle.condition.clear', { name: entry.name, ref: entry.ref, why: `the Director refused "${event.name}"`, by: 'director' });
            lifted.push(key);
        } catch { /* a refused clear leaves it: the refusal stands */ }
    }
    return lifted;
}

// The lifted conditions as a reader sees them ("grain dear on The March"), from their keys.
function liftedWords(ctx, keys) {
    const geo = buildGeo(readWorld((name, args) => ctx.query?.(name, args)));
    return keys.map(key => fadedWords(key.slice(0, key.indexOf('@')), key.slice(key.indexOf('@') + 1), geo)).join(', ');
}

function store(ctx, payload = {}) {
    if (ctx.cause !== 'system' || ctx.caller) return ctx.fail('REFUSED', 'The Director\'s verdicts on world lines are stored by code before a reply.');
    if (!worldEventsOn(ctx)) return ctx.fail('REFUSED', 'World events are off.');
    const results = isRecord(payload.results) ? payload.results : {};
    const bad = Object.entries(results).some(([id, row]) => !/^ev_/.test(id) || !isRecord(row) || typeof row.key !== 'string' || !VERDICTS.has(row.verdict)
        || (row.why !== undefined && typeof row.why !== 'string') || (row.line !== undefined && typeof row.line !== 'string'));
    const calls = payload.calls ?? 0;
    // `marks`: the Director's verdicts on tomorrow's roll (`{ "<event id>|<day>": { veto? | weight? } }`), read by the daily step (daily/director-mark.js).
    const marks = isRecord(payload.marks) ? payload.marks : {};
    if (bad || judgedErrors(undefined, marks).length || !Number.isInteger(calls) || calls < 0 || calls > 99) return ctx.fail('INVALID', 'The stored verdicts are not in the form the world reads.');
    const chronicle = ctx.draft('chronicle');
    const now = clockOf(ctx);
    const rev = revOf(ctx);
    const said = [];
    const data = { accepted: [], reshaped: [], kept: [], refused: [], skipped: [] };
    for (const [id, row] of Object.entries(results).sort(([a], [b]) => (a < b ? -1 : 1))) {
        const event = chronicle.events?.[id];
        // A verdict on words the entry no longer has (an edited Re-read, a deleted reply) is not used.
        if (!event || event.judge?.state !== 'pending' || event.judge.key !== row.key) { data.skipped.push(id); continue; }
        if (typeof ctx.ifThere === 'function') ctx.ifThere('chronicle', `/events/${id}`);
        const base = { key: event.judge.key, ...(event.judge.conditions ? { conditions: event.judge.conditions } : {}) };
        if (row.verdict === 'refuse') {
            const why = flat(row.why, 160) || 'it does not fit the world';
            Object.assign(event, { state: 'resolved', updated: now ?? event.updated, rev, judge: { ...base, state: 'refused', why } });
            const lifted = liftConditions(ctx, event);
            data.refused.push(id);
            said.push(`World: the Director refused "${event.name}" (${why}); it was only a rumour.${lifted.length ? ` Lifted: ${liftedWords(ctx, lifted)}.` : ''}`);
            continue;
        }
        const fixed = row.verdict === 'reshape' ? reshapeOf(ctx, event, row.line) : null;
        if (fixed) {
            Object.assign(event, { summary: fixed.summary, place: fixed.place, updated: now ?? event.updated, rev, judge: { ...base, state: 'reshaped' } });
            data.reshaped.push(id);
            said.push(`World: the Director reshaped "${event.name}".`);
            continue;
        }
        // Accepted, or a verdict code could not use (no answer, a reshape that does not read): the line's own result stands.
        const state = row.verdict === 'accept' ? 'accepted' : 'kept';
        event.judge = { ...base, state };
        data[state].push(id);
    }
    const query = typeof ctx.query === 'function' ? (name, args) => ctx.query(name, args) : null;
    if (calls > 0 || Object.keys(marks).length) storeJudged(chronicle, { calls, year: yearOf(calendarFrom(query), now), marks });
    // No name: the event has not happened, and telling which one it was would give it away.
    if (Object.values(marks).some(row => typeof row.veto === 'string')) said.push('World: the Director held something back for tomorrow.');
    return { summary: said.join(' '), narrate: false, data: { ...data, calls, ...(Object.keys(marks).length ? { marks: Object.keys(marks).sort() } : {}) } };
}

/** The command, tagged with the feature (refused while the switch is off) and internal (never from a click or the sdk). */
export const judgedCommand = Object.assign(store, { feature: WORLD_EVENTS_FEATURE });
Object.defineProperty(judgedCommand, 'internal', { value: true, enumerable: true });
