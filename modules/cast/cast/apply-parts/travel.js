// Applies cast journey, meeting withdrawal, and rumor payloads.

import { MAX_DOING, MAX_PLACE, MAX_REASON, cutPoints, cutWords, isAlive, isInt, isMet, isRecord, slotOf } from '../domain.js';
import { noop } from './shared.js';

/**
 * Applies a `cast.journey` payload (`{ at?, start?: [{ key, to, arrive, reason }], stop?: [key], land?: [{ key, where, doing }] }`): an unmet person
 * whose goal leads to the party but who is too far sets out (`coming`, a slot written whole, kept only while the link lasts), a journey whose link
 * went is dropped (they stay where they are), and one whose time is up lands: they are at the place the party was, from the minute they arrived.
 * Nobody is met here: a landed person meets the party by place like anyone else. Returns `{ started, stopped, landed }`.
 */
export function applyJourney(cast, payload, env) {
    const { now = null, rev = 0, touch = noop } = env;
    const done = { started: 0, stopped: 0, landed: 0 };
    const unmet = key => {
        const person = Object.hasOwn(cast.people, key) && isRecord(cast.people[key]) ? cast.people[key] : null;
        return person && isAlive(person) && !isMet(person) ? person : null;
    };
    for (const key of payload.stop ?? []) {
        const person = unmet(key);
        if (!person || !person.coming) continue;
        touch(key);
        person.coming = null;
        done.stopped += 1;
    }
    for (const item of payload.land ?? []) {
        const person = unmet(item.key);
        const trip = person ? slotOf(person.coming) : null;
        if (!trip) continue;
        touch(item.key);
        person.where = cutPoints(item.where || trip.to, MAX_PLACE);
        person.doing = cutWords(item.doing || person.doing, MAX_DOING);
        person.since = trip.arrive;
        person.coming = null;
        if (person.known) person.known = null;
        done.landed += 1;
    }
    for (const item of payload.start ?? []) {
        const person = unmet(item.key);
        if (!person || slotOf(person.coming)) continue;
        touch(item.key);
        person.coming = [{ from: person.where, to: cutPoints(item.to, MAX_PLACE), start: isInt(now) ? now : null, arrive: item.arrive, reason: cutPoints(item.reason, MAX_REASON), rev }];
        done.started += 1;
    }
    return done;
}

/**
 * Applies a `cast.withdraw` payload (`{ at, keys }`): the reply did not show these people, so the meeting recorded for it is taken back. They
 * are unmet again (a goal arrival back where they were), the reply's "Paths crossed" card line for them goes, and the pace is not used up.
 * Someone met in the story (`why: 'story'`) is never withdrawn. Returns the keys withdrawn. `env.touchNote(id)` marks a note's removal.
 */
export function applyWithdraw(cast, payload, env) {
    const { touch = noop, touchNote = noop } = env;
    const out = [];
    for (const key of payload.keys ?? []) {
        const person = Object.hasOwn(cast.people, key) && isRecord(cast.people[key]) ? cast.people[key] : null;
        if (!person || !isMet(person) || person.met.why === 'story') continue;
        touch(key);
        if (typeof person.met.was === 'string') person.where = person.met.was;
        person.met = null;
        for (const [id, note] of Object.entries(cast.notes ?? {})) {
            if (isRecord(note) && note.kind === 'met' && note.at === payload.at && note.head === `Paths crossed: ${person.name}`) {
                touchNote(id);
                delete cast.notes[id];
            }
        }
        out.push(key);
    }
    return out;
}

/**
 * Applies a `cast.rumor` payload (`{ at, who: [{ key, where, text }] }`): the reader sought a kind of person who is elsewhere, so the narrator
 * is told of them without a name in this reply (`at`) and the card says "Heard of". The person is marked in a slot written whole, so it is told
 * once, until they are met or move. Nobody is met and the pace is not used. Returns the keys told.
 */
export function applyRumor(cast, payload, env) {
    const { now = null, rev = 0, touch = noop, note = null, packName = pack => pack } = env;
    const told = [];
    for (const item of payload.who ?? []) {
        const person = Object.hasOwn(cast.people, item.key) && isRecord(cast.people[item.key]) ? cast.people[item.key] : null;
        if (!person || !isAlive(person) || isMet(person)) continue;
        touch(item.key);
        person.rumored = [{ on: isInt(now) ? now : null, where: cutPoints(item.where, MAX_PLACE), at: payload.at, rev }];
        told.push(item.key);
        if (typeof note === 'function') {
            const heard = cutPoints(String(item.text ?? '').replace(/^People here know of\s+/i, ''), 180).replace(/\.$/, '');
            note({
                kind: 'heard', head: `Heard of: ${heard}`, tag: `${packName(person.pack)} cast · rumor`,
                rest: 'You sought someone like this. They are not here, so the narrator is told only that people know of them (no name); you may meet them when you find them.',
                line: `Heard of: ${heard}`,
            });
        }
    }
    return told;
}
