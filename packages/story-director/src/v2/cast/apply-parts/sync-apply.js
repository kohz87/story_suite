// Creates newcomers and applies cast sync payloads to the cast domain.

import { MAX_DOING, MAX_PEOPLE, cutWords, isInt, isMet, isRecord, personKey, slotOf } from '../domain.js';
import { noop } from './shared.js';

/** A person as the world first holds them: at their start, doing their routine (else working towards their goal). */
export function newcomer(entry, { now, rev }) {
    return {
        pack: entry.pack, eid: entry.id, name: entry.name, ...(entry.aliases.length ? { aliases: [...entry.aliases] } : {}), ver: entry.ver, ...(entry.sig ? { sig: entry.sig } : {}),
        joined: isInt(now) ? now : null, where: entry.place, doing: cutWords(entry.routine || entry.goal, MAX_DOING), since: isInt(now) ? now : null,
        alive: true, met: null, heard: null, rev,
    };
}

/** Applies a `cast.sync` payload to `cast` (a draft or a copy). Returns `{ added, updated, dropped }`. */
export function applySync(cast, payload, env) {
    const { now = null, rev = 0, touch = noop, note = null, packName = pack => pack } = env;
    const done = { added: 0, updated: 0, dropped: 0 };
    for (const item of payload.add ?? []) {
        const key = personKey(item.pack, item.id);
        if (Object.hasOwn(cast.people, key) || Object.keys(cast.people).length >= MAX_PEOPLE) continue;
        cast.people[key] = newcomer({ ...item, aliases: item.aliases ?? [], routine: item.doing, goal: '' }, { now, rev });
        done.added += 1;
    }
    for (const item of payload.update ?? []) {
        if (!Object.hasOwn(cast.people, item.key) || !isRecord(cast.people[item.key])) continue;
        touch(item.key);
        const person = cast.people[item.key];
        person.ver = item.ver;
        if (item.sig) person.sig = item.sig;
        // A met person keeps the words they were met with; the entry's new ones are not copied over a dossier.
        if (!isMet(person)) {
            person.name = item.name;
            if (item.aliases?.length) person.aliases = [...item.aliases];
            else delete person.aliases;
        }
        done.updated += 1;
    }
    for (const key of payload.drop ?? []) {
        if (!Object.hasOwn(cast.people, key) || isMet(cast.people[key])) continue;
        delete cast.people[key];
        done.dropped += 1;
    }
    // `first` (every new chat): the story's first minute the cast knew, kept as the day moves, for people whose own `since` was never set (world.js `placedOf`).
    if (payload.init && !slotOf(cast.day) && isInt(now)) cast.day = [{ at: now, rev, ...(payload.first === true ? { first: now } : {}) }];
    if (typeof note === 'function') {
        for (const item of payload.updated ?? []) {
            if (!(item.n > 0)) continue;
            const name = packName(item.pack);
            const people = item.n === 1 ? '1 new person now lives' : `${item.n} new people now live`;
            const changed = item.changed > 0 ? ` ${item.changed === 1 ? '1 unmet person\'s entry' : `${item.changed} unmet people's entries`} changed (kept where they are).` : '';
            note({
                kind: 'updated', head: `${name} pack updated`, tag: item.from && item.to && item.from !== item.to ? `${item.from} → ${item.to}` : 'new people',
                rest: `${people} in the world from today, hidden until you meet them.${changed} People you have met keep their dossiers as they are.`,
                line: `${name} pack updated: ${people} in the world`,
            });
        }
    }
    return done;
}
