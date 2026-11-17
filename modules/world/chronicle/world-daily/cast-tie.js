// World events, the daily step on the host: the step and the cast store (spec v0.14.9 §8; seam audit E1, E5, E9, E10). Before the
// step: who is with You at the tick (the party's members who have not left, by `party.levels`, and the scene's present people, by
// `scene.present`), each pack person's place and latest base (`cast.people[key].where` and `.base`), and who has been met. After it:
// the step's moves, releases and deaths are written into the cast store (never the dossier, E9): a move sets `where`, `doing`, the
// `base` slot { at, since, routine, by: "event:<id>" }, `since` = now, and clears `coming` and `known` (E1); a release clears a base
// it set; an unmet death sets `alive` false. People are matched by their pack id (`eid`); a cast key is `<pack>:<id>` (E10).

import { slotValue } from '../../../rpg/slot.js';
import { MAX_DOING, MAX_PLACE, cutPoints, cutWords } from '../../../cast/cast/domain.js';

const low = text => String(text ?? '').trim().toLowerCase();
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const personPath = key => `/people/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;
const ask = (ctx, name, args = {}) => { try { return ctx.query(name, args); } catch { return null; } };

/** eid → cast key (the first key, sorted, when two packs carry the same id). */
function keysOf(people) {
    const out = new Map();
    for (const key of Object.keys(people).sort()) {
        const person = people[key];
        if (isRecord(person) && typeof person.eid === 'string' && !out.has(person.eid)) out.set(person.eid, key);
    }
    return out;
}

/** The names a person goes by (cast store and world cast), lower case → eid. */
function namesOf(people, keys, worldCast) {
    const out = new Map();
    for (const [eid, key] of keys) for (const name of [people[key].name, ...(Array.isArray(people[key].aliases) ? people[key].aliases : [])]) if (low(name)) out.set(low(name), eid);
    for (const entry of Array.isArray(worldCast) ? worldCast : []) {
        if (typeof entry?.id !== 'string') continue;
        for (const name of [entry.name, entry.id, ...(Array.isArray(entry.aliases) ? entry.aliases : [])]) if (low(name) && !out.has(low(name))) out.set(low(name), entry.id);
    }
    return out;
}

/** `{ withYou, positions, met, keys }` for the step at the tick (from the draft cast store, the party and the scene). */
export function tickInputs(ctx, cast, worldCast) {
    const people = isRecord(cast?.people) ? cast.people : {};
    const keys = keysOf(people);
    const names = namesOf(people, keys, worldCast);
    const withYou = new Set();
    const party = ask(ctx, 'party.levels');
    for (const member of Array.isArray(party) ? party : []) if (member && !member.left && names.has(low(member.name))) withYou.add(names.get(low(member.name)));
    const present = ask(ctx, 'scene.present');
    for (const item of Array.isArray(present) ? present : []) {
        const name = typeof item === 'string' ? item : item?.name;
        if (names.has(low(name))) withYou.add(names.get(low(name)));
    }
    const positions = {};
    const met = [];
    for (const [eid, key] of keys) {
        const person = people[key];
        const base = slotValue(person.base);
        if (typeof person.where === 'string' && person.where) positions[eid] = { at: person.where, base: typeof base?.at === 'string' ? base.at : null };
        if (isRecord(person.met)) met.push(eid);
    }
    return { withYou: [...withYou].sort(), positions, met: met.sort(), keys };
}

/** Writes the step's `moves`, `released` and `deaths` (report) into the cast draft at minute `now`. */
export function mirrorCast(ctx, cast, report, keys, now) {
    const people = isRecord(cast?.people) ? cast.people : null;
    if (!people) return;
    const touch = key => { if (typeof ctx.ifThere === 'function') ctx.ifThere('cast', personPath(key)); };
    for (const move of report.moves ?? []) {
        const key = keys.get(move.id);
        if (!key || !isRecord(people[key]) || people[key].alive === false) continue;
        touch(key);
        const person = people[key];
        person.where = cutPoints(String(move.to), MAX_PLACE);
        person.doing = cutWords(String(move.routine ?? ''), MAX_DOING);
        person.since = now;
        person.base = [{ at: person.where, since: now, routine: person.doing, by: `event:${move.by}` }];
        if (person.coming != null) person.coming = null;
        if (person.known != null) person.known = null;
    }
    for (const gone of report.released ?? []) {
        const key = keys.get(gone.id);
        const base = key && isRecord(people[key]) ? slotValue(people[key].base) : null;
        if (!base || base.by !== `event:${gone.by}` || base.at !== gone.to) continue;
        touch(key);
        people[key].base = null;
    }
    for (const death of report.deaths ?? []) {
        const key = keys.get(death.id);
        if (!key || !isRecord(people[key]) || isRecord(people[key].met)) continue;
        touch(key);
        people[key].alive = false;
        people[key].doing = '';
    }
}
