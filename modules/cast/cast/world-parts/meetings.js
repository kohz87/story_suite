// Choosing who meets the party, who is only rumored, who may be sought, and who the story already shows.

import { isPersona } from '../../tracker/initiative.js';
import { routineHolds, samePlace } from '../entries.js';
import { isAlive, isMet, keysOfPerson, peopleOf, slotOf } from '../domain.js';
import { kindTouches, rumorText } from '../sought.js';
import { movable } from './movable.js';
import { PER_REPLY, roomLeft } from './pace.js';
import { atPlace } from './places.js';
import { canReach } from './reach.js';
import { placedOf } from './schedule.js';
import { bare } from './shared-bare.js';

/**
 * The people who meet the party in the reply about to be written, `[{ key, why: 'place' | 'goal', reason }]` (at most PER_REPLY, none
 * during a fight or when the pace allows no more). `comes`: the planner's `[{ key, reason }]`; `sought`: its checked `[{ key, words }]`.
 */
export function chooseMeetings(slice, cast, { now = null, party = {}, comes = [], sought = [], fight = false, pace, present = new Set(), pinned = new Set(), travel = null, persona = '' } = {}) {
    if (fight) return [];
    const place = party?.place ?? '';
    let room = Math.min(PER_REPLY, roomLeft(slice, now, pace));
    if (room <= 0) return [];
    // At the party's place (rule 2: its place or town, not its region alone); someone whose last hop had no road also within reach of their last known place.
    const here = item => atPlace(item.person.where, party) && (!slotOf(item.person.known) || canReach(item.person, party, { now, travel, placed: placedOf(slice) }));
    // {{user}} (`persona`, the name) is never met: the cast part would announce the player's own character as a newcomer.
    const eligible = movable(slice, cast, { present, pinned }).filter(item => !item.met && !isPersona({ key: item.key, name: item.person?.name, names: item.person?.aliases }, persona));
    const picks = [];
    for (const come of comes) {
        const item = eligible.find(candidate => candidate.key === come.key);
        if (!item || !item.entry.drawnTo.length || picks.some(pick => pick.key === item.key)) continue;
        picks.push({ key: item.key, why: 'goal', reason: come.reason, place });
        if (picks.length >= room) return picks;
    }
    room -= picks.length;
    // Someone the reader sought who is at this place (and whose routine has them here): they come, with the reader's own words as the reason.
    for (const ask of sought) {
        if (room <= 0) break;
        const item = eligible.find(candidate => candidate.key === ask.key);
        if (!item || picks.some(pick => pick.key === item.key) || !here(item)) continue;
        if (samePlace(item.person.where, item.entry.place) && !routineHolds(item.entry.routine, now)) continue;
        picks.push({ key: item.key, why: 'sought', reason: ask.words, place });
        room -= 1;
    }
    const byJoin = [...eligible].sort((a, b) => (a.person.joined ?? -Infinity) - (b.person.joined ?? -Infinity) || (a.key < b.key ? -1 : 1));
    for (const item of byJoin) {
        if (room <= 0) break;
        if (picks.some(pick => pick.key === item.key) || !here(item)) continue;
        // Their routine only binds them at their start: someone who has moved on is where they are now.
        const home = samePlace(item.person.where, item.entry.place);
        if (home && !routineHolds(item.entry.routine, now)) continue;
        picks.push({ key: item.key, why: 'place', reason: '' });
        room -= 1;
    }
    return picks;
}

/**
 * A sought person who is elsewhere: `{ key, where, text }` or null. A rumor and no meeting (nobody comes, the pace is not used): never during a
 * fight, never when a meeting is made in this reply (one cue a reply), never someone present or pinned, someone met or dead, someone already
 * heard of at the place they are still at, or someone who has no place or is at the party's (they come, or wait). The text describes them and
 * never names them (sought.js); with no way to say it without the name, no rumor.
 */
export function chooseRumor(slice, cast, { party = {}, sought = [], fight = false, met = [], present = new Set(), pinned = new Set() } = {}) {
    if (fight || met.length) return null;
    const eligible = movable(slice, cast, { present, pinned }).filter(item => !item.met);
    for (const ask of sought) {
        const item = eligible.find(candidate => candidate.key === ask.key);
        if (!item || !item.person.where || atPlace(item.person.where, party)) continue;
        const told = slotOf(item.person.rumored);
        if (told && told.where === item.person.where) continue;
        const text = rumorText(item.entry, { where: item.person.where, home: samePlace(item.person.where, item.entry.place) });
        if (text) return { key: item.key, where: item.person.where, text };
    }
    return null;
}

/** The unmet, living, placed people (not in the scene, not pinned) the reader's `text` may be asking for, by their calling: the planner's list. */
export function seekable(slice, cast, { present = new Set(), pinned = new Set(), text = '' } = {}) {
    return movable(slice, cast, { present, pinned }).filter(item => !item.met && item.person.where && kindTouches(item.entry, text));
}

/**
 * The unmet people of the packs' cast the story already has in the scene under their name or an alias (`present`: keys): they are met at
 * that moment, "met in the story", as `{ key, why: 'story', reason: '', place }` (no cue: the narrator has them already).
 */
export function metInTheStory(slice, cast, { present = new Set(), party = {}, persona = '' } = {}) {
    return peopleOf(slice)
        .filter(person => !isMet(person) && !isPersona({ key: person.key, name: person.name, names: person.aliases }, persona) && isAlive(person) && cast.byKey.has(person.key) && keysOfPerson(person).some(key => present.has(key) || present.has(bare(key))))
        .map(person => ({ key: person.key, why: 'story', reason: '', place: party?.place ?? '' }));
}
