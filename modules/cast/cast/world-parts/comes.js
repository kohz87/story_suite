// Sorting the planner's goal pulls into meetings and journeys, and listing chance-meeting candidates.

import { atParty, routineHolds, samePlace } from '../entries.js';
import { DAY, isInt, slotOf } from '../domain.js';
import { linkOf } from './links.js';
import { movable } from './movable.js';
import { paceOf, roomLeft } from './pace.js';
import { atPlace, reachDays } from './places.js';
import { canBeHere, canReach } from './reach.js';
import { placedOf } from './schedule.js';

/**
 * What a goal pull comes to now. `comes`: the planner's `[{ key, reason }]`. Returns `{ meet, start, stop, land }`: `meet`, the comes of people
 * who may arrive (linked and here or in time); `start`, `[{ key, to, arrive, reason }]` for the linked who are too far (not for no route:
 * unknown is far and has no time to give); `stop`, the keys whose journey has lost its link; `land`, `[{ key, where, doing }]` for journeys
 * whose time is up. `links`/`travel` as above; a person already on a journey does not start another.
 */
export function sortComes(slice, cast, { comes = [], party = {}, now = null, travel = null, links = {}, present = new Set(), pinned = new Set() } = {}) {
    const out = { meet: [], start: [], stop: [], land: [] };
    const all = movable(slice, cast, { present, pinned }).filter(item => !item.met);
    for (const item of all) {
        const trip = slotOf(item.person.coming);
        if (!trip) continue;
        if (!linkOf(item, party, links)) out.stop.push(item.key);
        else if (isInt(now) && now >= trip.arrive) out.land.push({ key: item.key, where: trip.to, doing: 'came looking for you' });
    }
    for (const come of comes) {
        const item = all.find(candidate => candidate.key === come.key);
        if (!item || !item.entry.drawnTo.length || !linkOf(item, party, links) || out.meet.some(pick => pick.key === come.key) || out.start.some(pick => pick.key === come.key)) continue;
        if (canReach(item.person, party, { now, travel, placed: placedOf(slice) })) { out.meet.push(come); continue; }
        // The trip from where they are, or (after a hop with no road) from their last known place, and never before that place allows.
        const known = slotOf(item.person.known);
        const back = known ? reachDays(known.where, party, travel) : null;
        const days = reachDays(item.person.where, party, travel) ?? back;
        if (days === null || (known && back === null) || slotOf(item.person.coming) || !isInt(now)) continue;
        const arrive = Math.max(now + Math.max(1, Math.ceil(days * DAY)), known && isInt(known.since) ? known.since + Math.ceil(back * DAY) : -Infinity);
        out.start.push({ key: item.key, to: party.place, arrive, reason: come.reason });
    }
    return out;
}

/**
 * The unmet people a chance meeting may bring (the pulse): not present, not pinned, the pace has room, and they can be here (`canBeHere`: in the
 * party's area, or the time since they were placed covers the atlas trip; no route = far); someone at their start keeps their routine, as for a
 * place meeting. Each is `{ ...movable item, here }`, `here`: already at the party's place (met by place; anyone else is met by their way there).
 */
export function chanceCandidates(slice, cast, { party = {}, now = null, travel = null, present = new Set(), pinned = new Set(), pace = paceOf({}), strict = false } = {}) {
    if (roomLeft(slice, now, pace) <= 0) return [];
    // `strict` (rule 2, `reach: 2`): `canReach` and `atPlace` with road trips only; rule 1 as it was for the steps that carry it.
    const [reach, at] = strict ? [canReach, atPlace] : [canBeHere, atParty];
    return movable(slice, cast, { present, pinned }).filter(item => !item.met && reach(item.person, party, { now, travel, placed: placedOf(slice) })
        && !(at(item.person.where, party) && samePlace(item.person.where, item.entry.place) && !routineHolds(item.entry.routine, now)))
        .map(item => ({ ...item, here: at(item.person.where, party) }));
}
