// Chronicle's validator: what a saved chronicle slice must look like.

import { slotValue } from '../../../../packages/story-director/src/v2/slot.js';
import { validateDays } from '../days.js';
import { MAX_EVENTS, MAX_FACTIONS, MAX_RESOLVED } from './limits-caps.js';
import { EVENT_ID, FACTION_ID, STATES } from './limits-ids.js';
import { LASTING_BY } from './limits-lasting.js';
import { MAX_AKA, MAX_NAME, MAX_NAMED, MAX_SUMMARY } from './limits-text.js';
import { keyOf, keptKeyOf } from './names.js';
import { isInt, isRecord } from './shared-basics.js';

const textOk = (value, max) => typeof value === 'string' && value.length <= max;
const namesOk = (list, max) => Array.isArray(list) && list.length <= max && list.every(name => textOk(name, MAX_NAME) && keyOf(name));

function eventErrors(id, event) {
    const at = `chronicle.events.${id}`;
    if (!isRecord(event)) return [`${at} is not an event.`];
    const errors = [];
    if (!EVENT_ID.test(id) || event.id !== id) errors.push(`${at} has a bad id.`);
    if (!textOk(event.name, MAX_NAME) || !keyOf(event.name)) errors.push(`${at} needs a name of at most ${MAX_NAME} characters.`);
    if (!textOk(event.summary, MAX_SUMMARY)) errors.push(`${at}.summary must be text of at most ${MAX_SUMMARY} characters.`);
    if (!STATES.includes(event.state)) errors.push(`${at}.state must be one of: ${STATES.join(', ')}.`);
    for (const field of ['since', 'updated']) {
        if (!(event[field] === null || isInt(event[field]))) errors.push(`${at}.${field} must be story minutes or null.`);
    }
    if (!textOk(event.place, MAX_NAME)) errors.push(`${at}.place must be text of at most ${MAX_NAME} characters.`);
    if (!namesOk(event.factions, MAX_NAMED)) errors.push(`${at}.factions must be a list of at most ${MAX_NAMED} names.`);
    if (!namesOk(event.aka, MAX_AKA)) errors.push(`${at}.aka must be a list of at most ${MAX_AKA} names.`);
    if (!isInt(event.rev) || event.rev < 0) errors.push(`${at}.rev must be a whole number.`);
    if (event.by !== undefined && !(typeof event.by === 'string' && LASTING_BY.test(event.by))) errors.push(`${at}.by must be the event that wrote it ("event:<id>").`);
    if (event.rumour !== undefined && !textOk(event.rumour, MAX_NAME)) errors.push(`${at}.rumour must be the name of the event it is about.`);
    if (event.heard !== undefined && event.heard !== true) errors.push(`${at}.heard must be true when it is there.`);
    if (event.keep !== undefined && event.keep !== true) errors.push(`${at}.keep must be true when it is there.`);
    if (event.fire !== undefined && !(isRecord(event.fire) && Object.keys(event.fire).length === 2 && isInt(event.fire.rev) && event.fire.rev >= 0
        && typeof event.fire.by === 'string' && LASTING_BY.test(event.fire.by))) {
        errors.push(`${at}.fire must be { rev, by }: the pack event that last changed it.`);
    }
    for (const key of Object.keys(event)) {
        if (!['id', 'name', 'summary', 'state', 'since', 'updated', 'place', 'factions', 'aka', 'rev', 'by', 'keep', 'fire', 'rumour', 'heard'].includes(key)) errors.push(`${at} has an unknown field "${key}".`);
    }
    return errors;
}

function factionErrors(id, faction) {
    const at = `chronicle.factions.${id}`;
    if (!isRecord(faction)) return [`${at} is not a faction.`];
    const errors = [];
    if (!FACTION_ID.test(id) || faction.id !== id) errors.push(`${at} has a bad id.`);
    if (!textOk(faction.name, MAX_NAME) || !keyOf(faction.name)) errors.push(`${at} needs a name of at most ${MAX_NAME} characters.`);
    if (!textOk(faction.summary, MAX_SUMMARY)) errors.push(`${at}.summary must be text of at most ${MAX_SUMMARY} characters.`);
    for (const field of ['area', 'stance']) {
        if (!textOk(faction[field], MAX_NAME)) errors.push(`${at}.${field} must be text of at most ${MAX_NAME} characters.`);
    }
    if (!namesOk(faction.aka, MAX_AKA)) errors.push(`${at}.aka must be a list of at most ${MAX_AKA} names.`);
    if (!isInt(faction.rev) || faction.rev < 0) errors.push(`${at}.rev must be a whole number.`);
    for (const key of Object.keys(faction)) {
        if (!['id', 'name', 'summary', 'area', 'stance', 'aka', 'rev'].includes(key)) errors.push(`${at} has an unknown field "${key}".`);
    }
    return errors;
}

// Two entries of one table may not go by the same name.
function clashes(table, what) {
    const owner = new Map();
    const errors = [];
    for (const entry of Object.values(table)) {
        if (!isRecord(entry)) continue;
        const key = keptKeyOf(entry.name);
        if (key && owner.has(key) && owner.get(key) !== entry.id) errors.push(`Two ${what} are called "${entry.name}".`);
        owner.set(key, entry.id);
    }
    return errors;
}

/** `validate(slice, state) → string[]` (SPEC §2.5). */
export function validateChronicle(slice) {
    if (!isRecord(slice)) return ['chronicle is not an object.'];
    const errors = [];
    const events = isRecord(slice.events) ? slice.events : null;
    if (!events) errors.push('chronicle.events is not an object.');
    else {
        for (const [id, event] of Object.entries(events)) errors.push(...eventErrors(id, event));
        const all = Object.values(events);
        if (all.length > MAX_EVENTS) errors.push(`The chronicle keeps at most ${MAX_EVENTS} events.`);
        if (all.filter(event => event?.state === 'resolved').length > MAX_RESOLVED) errors.push(`The chronicle keeps at most ${MAX_RESOLVED} resolved events.`);
        errors.push(...clashes(events, 'events'));
    }
    if (!isRecord(slice.factions)) errors.push('chronicle.factions is not an object.');
    else {
        for (const [id, faction] of Object.entries(slice.factions)) errors.push(...factionErrors(id, faction));
        if (Object.keys(slice.factions).length > MAX_FACTIONS) errors.push(`The chronicle keeps at most ${MAX_FACTIONS} factions.`);
        errors.push(...clashes(slice.factions, 'factions'));
    }
    if (!isInt(slice.round) || slice.round < 0) errors.push('chronicle.round must be a whole number.');
    const seen = slotValue(slice.seen);
    if (!seen || (Array.isArray(slice.seen) && slice.seen.length !== 1)) errors.push('chronicle.seen is not an object.');
    else {
        for (const [id, round] of Object.entries(seen)) {
            if (!EVENT_ID.test(id)) errors.push(`chronicle.seen["${id}"] is for no event.`);
            else if (!isInt(round) || round < 0) errors.push(`chronicle.seen["${id}"] must be a round.`);
        }
    }
    // A round past `round` (a pick before it deleted) is read as just shown: never refused.
    if (slice.seenAt !== undefined) {
        if (!isRecord(slice.seenAt)) errors.push('chronicle.seenAt is not an object.');
        else {
            for (const [id, round] of Object.entries(slice.seenAt)) {
                if (!EVENT_ID.test(id)) errors.push(`chronicle.seenAt["${id}"] is for no event.`);
                else if (!isInt(round) || round < 0) errors.push(`chronicle.seenAt["${id}"] must be a round.`);
            }
            if (Object.keys(slice.seenAt).length > MAX_EVENTS * 4) errors.push(`chronicle.seenAt keeps about ${MAX_EVENTS} events at most.`);
        }
    }
    const surfaced = slotValue(slice.surfaced);
    if (slice.surfaced !== null) {
        if (!isRecord(surfaced) || (Array.isArray(slice.surfaced) && slice.surfaced.length !== 1) || !(surfaced.at === null || (isInt(surfaced.at) && surfaced.at >= 0)) || !isInt(surfaced.round)
            || !Array.isArray(surfaced.ids) || surfaced.ids.some(id => typeof id !== 'string' || !EVENT_ID.test(id))) {
            errors.push('chronicle.surfaced must be null or { at, round, ids }.');
        }
    }
    // A chronicle from before the day digest has no `days` or `written`.
    errors.push(...validateDays(slice));
    for (const key of Object.keys(slice)) {
        if (!['events', 'factions', 'seen', 'seenAt', 'round', 'surfaced', 'days', 'written', 'dayFacts', 'noted', 'questLog'].includes(key)) errors.push(`chronicle has an unknown field "${key}".`);
    }
    return errors;
}
