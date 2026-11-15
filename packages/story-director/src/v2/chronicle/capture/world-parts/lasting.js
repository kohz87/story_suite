// Story Director v2, chronicle part: applies pack-event lasting changes to world events.

import {
    LASTING_BY, MAX_EVENTS, MAX_NAME, STATES, cleanName, cleanSummary, findIn, isOpen, isRecord, keyOf, newId, prune, revOf,
} from '../../domain.js';
import { clockOf, sentence } from '../text.js';
import { changeEvent, eventSummary } from './event-state.js';

const LASTING_FIELDS = ['name', 'state', 'summary', 'place', 'factions', 'keep'];
const MAX_LASTING_SUMMARY = 240;
const MAX_LASTING_FACTIONS = 4;

// The payload of `chronicle.lasting` as the entry takes it, or fails with INVALID.
function readLasting(ctx, payload) {
    if (!isRecord(payload)) return ctx.fail('INVALID', 'chronicle.lasting takes { name, state, summary?, place?, factions?, keep? }.');
    const unknown = Object.keys(payload).filter(key => !LASTING_FIELDS.includes(key));
    if (unknown.length) return ctx.fail('INVALID', `chronicle.lasting has no ${unknown.join(', ')}.`);
    const short = (value, max, what) => {
        if (typeof value !== 'string') return ctx.fail('INVALID', `chronicle.lasting: ${what} must be text.`);
        if (Array.from(value.trim()).length > max) return ctx.fail('INVALID', `chronicle.lasting: ${what} has at most ${max} characters.`);
        return value;
    };
    const name = cleanName(short(payload.name, MAX_NAME, 'name'));
    if (!keyOf(name)) return ctx.fail('INVALID', 'chronicle.lasting needs a name.');
    if (!STATES.includes(payload.state)) return ctx.fail('INVALID', `chronicle.lasting: state must be one of ${STATES.join(', ')}.`);
    const out = { name, state: payload.state };
    if (payload.summary !== undefined) out.summary = cleanSummary(short(payload.summary, MAX_LASTING_SUMMARY, 'summary'));
    if (payload.place !== undefined) out.place = cleanName(short(payload.place, MAX_NAME, 'place'));
    if (payload.factions !== undefined) {
        if (!Array.isArray(payload.factions) || payload.factions.length > MAX_LASTING_FACTIONS) return ctx.fail('INVALID', `chronicle.lasting: factions is a list of at most ${MAX_LASTING_FACTIONS} names.`);
        const names = [];
        for (const given of payload.factions) {
            const faction = cleanName(short(given, MAX_NAME, 'a faction'));
            if (!keyOf(faction)) return ctx.fail('INVALID', 'chronicle.lasting: a faction needs a name.');
            if (!names.some(other => keyOf(other) === keyOf(faction))) names.push(faction);
        }
        out.factions = names;
    }
    if (payload.keep !== undefined) {
        if (typeof payload.keep !== 'boolean') return ctx.fail('INVALID', 'chronicle.lasting: keep is true or false.');
        out.keep = payload.keep;
    }
    return out;
}

/**
 * `chronicle.lasting { name, state, summary?, place?, factions?, keep? }`: a pack event's lasting change to the
 * world (see the header). Refused unless a pack event calls it (`ctx.caller` is `event:<id>`). What the payload
 * leaves out stays as it is; `since` is stamped on create, `updated` on every change. Fails (NOT_YET) while the
 * Director's clock is null.
 */
export function lasting(ctx, payload = {}) {
    const caller = typeof ctx.caller === 'string' ? ctx.caller : '';
    if (!LASTING_BY.test(caller)) return ctx.fail('REFUSED', 'A lasting change to the world is written only by an event of the story\'s pack, never by a button, a change line or another command.');
    const fields = readLasting(ctx, payload);
    // Until the story has a date there is nothing to stamp `since` with, and a delay counted from it would never come
    // due: the step fails, the pack event is not claimed and is tried again on the next reply.
    const now = clockOf(ctx);
    if (now === null) return ctx.fail('NOT_YET', 'The story has no date yet; this world event waits for one.');
    const chronicle = ctx.draft('chronicle');
    const rev = revOf(ctx);
    const found = findIn(chronicle.events, fields.name);

    if (!found) {
        const events = Object.values(chronicle.events);
        if (events.length >= MAX_EVENTS && events.every(isOpen)) {
            return ctx.fail('REFUSED', `The chronicle already follows ${MAX_EVENTS} world events under way; resolve or remove one first.`);
        }
        const id = newId(ctx, 'ev', chronicle.events);
        const event = {
            id, name: fields.name, summary: fields.summary ?? '', state: fields.state, since: now, updated: now,
            place: fields.place ?? '', factions: fields.factions ?? [], aka: [], rev, by: caller,
            ...(fields.keep === true ? { keep: true } : {}), fire: { rev, by: caller },
        };
        chronicle.events[id] = event;
        const gone = prune(chronicle);
        if (!Object.hasOwn(chronicle.events, id)) return { summary: `World: ${fields.name} has ended (too old to keep).`, narrate: false, data: { event: null, pruned: gone } };
        return { summary: sentence(eventSummary(event, true)), narrate: false, data: { event: id, created: true, state: event.state, ...(gone.length ? { pruned: gone } : {}) } };
    }

    const event = chronicle.events[found.id];
    const changes = changeEvent(chronicle, event, { summary: fields.summary, state: fields.state, place: fields.place, factions: fields.factions, by: caller, keep: fields.keep }, { now, rev });
    const gone = prune(chronicle);
    if (!changes.length) return { summary: `World: ${event.name} is unchanged.`, narrate: false, data: { event: event.id, state: event.state } };
    // This fire's receipt is kept on the entry, so the Journal can find the change whatever else touches the entry later.
    event.fire = { rev, by: caller };
    return { summary: sentence(eventSummary(event, false)), narrate: false, data: { event: event.id, state: event.state, ...(gone.length ? { pruned: gone } : {}) } };
}
