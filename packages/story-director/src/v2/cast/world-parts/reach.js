// Whether a person can be at the party's place in time, and whether a planner move fits the roads (rule 1 and rule 2).

import { atParty } from '../entries.js';
import { DAY, isInt, slotOf } from '../domain.js';
import { atPlace, daysBetween, reachDays } from './places.js';

/** Whether the person can be at the party's place now: they are in its area, or the story time since they were last placed (`since`, else `placed`: the cast's own day) covers the trip. No route: far. */
export function canBeHere(person, party, { now = null, travel = null, placed = null } = {}) {
    const days = daysBetween(person?.where, party, travel);
    if (days === null) return false;
    if (days === 0) return true;
    const since = isInt(person?.since) ? person.since : placed;
    return isInt(since) && isInt(now) && now - since >= Math.ceil(days * DAY);
}

// ---- reach, rule 2 (pulse steps with `reach: 2`, `reach: 3` and every hook choice, which is stored as the reply's payload) -------------
// Rule 1 (pulse steps with `reach: 1`, replayed as they were) took a place in the party's region for the party's place and the atlas's
// first answer, a straight-line estimate too: "Drowned Bell taproom", a place the map placed itself with no road, was half a day from
// Auvoth at the reader's map scale (one km a unit) though the road is 3.5 days, so Rika was met there 1.2 days after the start.
// Rule 2 as merged (`party.old`: the steps with `reach: 2`; a party with no atlas reader, `locate`) read a town as a name one place's name
// holds; the rest reads places by the atlas's ids and saved parent links (`party.locate`, entries.js `locator`), never a region.

/**
 * Rule 2: whether the person can be at the party's place at `now`. From their place now (since `since`, else `placed`) and, after a move the
 * atlas had no road for, from the last place it had one for (`known`: `[{ where, since }]`, since they left it), both by `reachDays`; no road
 * from where they are and no known place, or no road from the known place: far. So nobody reaches the party faster than the atlas's road trip
 * from their own last known place, by any number of hops through places with no road.
 */
export function canReach(person, party, { now = null, travel = null, placed = null } = {}) {
    const known = slotOf(person?.known);
    const legs = [];
    const days = reachDays(person?.where, party, travel);
    if (days !== null) legs.push([days, isInt(person?.since) ? person.since : placed]);
    else if (!known) return false;
    if (known) {
        const back = reachDays(known.where, party, travel);
        if (back === null) return false;
        legs.push([back, known.since]);
    }
    return legs.every(([need, since]) => need === 0 || (isInt(since) && isInt(now) && now - since >= Math.ceil(need * DAY)));
}

/**
 * Rule 2 for a planner move of `person` to `where` at story minute `to`: null when it does not fit, else `{ from? }`. The trip from where they
 * are and from their last known place (`known`) must fit the time since each (a move within one town is no trip, by the atlas: `party.locate`);
 * with no road from the last known place the move is kept only away from the party's place, town and region, and `from` keeps that last
 * known place (and the minute they left it) for the reach rule. A move that has a road from it clears `known`. Someone unplaced, or a move
 * with no place, has nothing to check.
 */
export function moveReach(person, where, { party = {}, to = null, travel = null, placed = null } = {}) {
    if (!person?.where || !where) return {};
    const since = isInt(person.since) ? person.since : placed;
    const base = slotOf(person.known) ?? { where: person.where, since };
    const dest = { place: where, locate: party.locate };
    const fits = (from, start) => {
        const days = reachDays(from, dest, travel);
        return days === null ? null : days === 0 || !isInt(start) || !isInt(to) || to - start >= Math.ceil(days * DAY);
    };
    if (fits(person.where, since) === false || fits(base.where, base.since) === false) return null;
    if (fits(base.where, base.since) !== null) return {};
    if (atPlace(where, party) || atParty(where, party)) return null;
    return { from: { where: base.where, since: isInt(base.since) ? base.since : null } };
}

/** Whether a planner move of `person` (not an unplaced one) to `where` at story minute `to` is possible: the trip fits the time since they were placed; no route is allowed except onto the party's place. */
export function moveFits(person, where, { party = {}, to = null, travel = null, placed = null } = {}) {
    if (!person?.where) return true;   // unplaced: nowhere to travel from
    const days = daysBetween(person?.where, { place: where, region: '' }, travel);
    if (days === null) return !atParty(where, party);
    const since = isInt(person?.since) ? person.since : placed;
    return days === 0 || !isInt(since) || !isInt(to) || to - since >= Math.ceil(days * DAY);
}
