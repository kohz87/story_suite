// Story Director v2, part **cast**: building the hook frame, copying the cast slice, and querying pack places.

import { cutPoints, isInt, keysOfPerson } from '../domain.js';
import { castOf, partyPlace, presentKeys, ask } from '../entries.js';
import { settingsOf } from '../settings.js';

export const queryOf = view => (typeof view?.query === 'function' ? (name, args) => view.query(name, args) : null);

const minutesOf = view => {
    const value = view?.state?.domains?.director?.time?.minutes;
    return isInt(value) ? value : null;
};

// What both hooks read: the cast the packs list, the state's slice, the scene, who is pinned.
export function frameOf(view) {
    const query = queryOf(view);
    const cast = castOf(query);
    const slice = view?.state?.domains?.cast;
    const now = minutesOf(view);
    const pinned = new Set();
    const keyPeople = ask(query, 'director.keyPeople', {}, null);
    for (const entry of Array.isArray(keyPeople) ? keyPeople : []) {
        if (entry && typeof entry === 'object' && !entry.removed) for (const key of keysOfPerson(entry)) pinned.add(key);
    }
    return {
        query, cast, slice, now, pinned,
        present: presentKeys(query, view?.state),
        party: partyPlace(query, view?.state),
        settings: settingsOf(view?.settings),
        calendar: ask(query, 'time.now', {}, null),
    };
}

export const copyOf = slice => {
    const own = structuredClone(slice && typeof slice === 'object' ? slice : {});
    return { people: own.people ?? {}, notes: own.notes ?? {}, day: own.day ?? null, meeting: own.meeting ?? null };
};

export const placesOf = query => {
    const list = ask(query, 'packs.content', { kind: 'places' }, null);
    return (Array.isArray(list) ? list : []).map(place => cutPoints(place?.name, 80)).filter(Boolean);
};
