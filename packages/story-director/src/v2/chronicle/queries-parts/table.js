// Chronicle's table of named queries.

import { DIGEST_FEATURE, questLogOf } from '../days.js';
import { findIn, isOpen, orderedEvents, orderedFactions } from '../domain.js';
import { isInt } from '../domain-parts/shared-basics.js';
import { chronicleBoard } from './board.js';
import { dayBoard, daysQuery } from './days-board.js';
import { setup } from './env.js';
import { eventOut, factionOut } from './out.js';
import { dayArg } from './shared-day-args.js';
import { dayEventsQuery, dayFactsQuery, noteFactsQuery } from './receipts.js';

// A query of the day digest only (MODULES §F100): tagged with its feature, so Story Block answers null
// while the reader has the digest off (B-c2-2). An older host without features keeps it on.
const digestOnly = fn => Object.assign((state, args, tools) => fn(state, args, tools), { feature: DIGEST_FEATURE });

export const queries = {
    /**
     * The world events, open first (newest news first), then resolved: `[{ id, name, summary, state,
     * open, place, factions: [{ name, id|null }], factionsText, since, updated, sinceText,
     * updatedText, updatedAgo, aka, rev }]`. `state` keeps one state; `open: true|false` open or resolved ones.
     */
    'chronicle.events': (state, { state: only = null, open = null } = {}, tools) => {
        const env = setup(state, tools);
        return orderedEvents(env.chronicle)
            .filter(event => (!only || event.state === only) && (open === null || isOpen(event) === open))
            .map(event => eventOut(event, env));
    },
    /** One world event by `id` or `name` (or a name it had), or null. */
    'chronicle.event': (state, { id = null, name = null } = {}, tools) => {
        const env = setup(state, tools);
        const found = findIn(env.chronicle.events, id ?? name);
        return found ? eventOut(found, env) : null;
    },
    /**
     * Whether `minutes` story minutes have gone by since the world event `name` (or `id`, or a name it had)
     * began (`since`): true or false, for a pack event's `when` (the condition language has no sums:
     * `query('chronicle.passed', { name: 'The Siege', minutes: 86400 })`). False when there is no such event,
     * or the Director's clock was not set when it began or is not set now.
     */
    'chronicle.passed': (state, { id = null, name = null, minutes = null } = {}, tools) => {
        if (!isInt(minutes) || minutes < 0) return false;
        const env = setup(state, tools);
        const found = findIn(env.chronicle.events, id ?? name);
        return Boolean(found) && isInt(found.since) && isInt(env.now) && env.now >= found.since + minutes;
    },
    /** The factions by name: `[{ id, name, summary, area, stance, events: [{ id, name, state }], eventsText, aka, rev }]`. */
    'chronicle.factions': (state, _args, tools) => {
        const env = setup(state, tools);
        return orderedFactions(env.chronicle).map(faction => factionOut(faction, env));
    },
    /** One faction by `id` or `name` (or a name it had), or null. */
    'chronicle.faction': (state, { id = null, name = null } = {}, tools) => {
        const env = setup(state, tools);
        const found = findIn(env.chronicle.factions, id ?? name);
        return found ? factionOut(found, env) : null;
    },
    'chronicle.board': chronicleBoard,
    /** The day digests kept, oldest first (`daysQuery`): other modules' and the fold history's. */
    'chronicle.days': digestOnly(daysQuery),
    /** One day's digest by its day number, or null. */
    'chronicle.day': digestOnly((state, { day = null } = {}, tools) => {
        const wanted = dayArg(day);
        if (wanted === null || Number.isNaN(wanted)) return null;
        return daysQuery(state, { from: wanted, to: wanted }, tools)?.[0] ?? null;
    }),
    'chronicle.dayBoard': digestOnly(dayBoard),
    'chronicle.dayFacts': digestOnly(dayFactsQuery),
    'chronicle.dayEvents': digestOnly(dayEventsQuery),
    'chronicle.noteFacts': noteFactsQuery,
    /** The kept history of a quest or thread `id`: `[{ rev, text }]`, oldest first (the last few). */
    'chronicle.questLog': (state, { id = null } = {}) => questLogOf(state?.domains?.chronicle, id),
};
