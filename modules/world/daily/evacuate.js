// World events, the daily step: a placeStatus evacuation (spec §2 placeStatus, B12; §8 With You, v0.14.8 staying behind). A status
// set on a place covers it and its districts, and everyone living in that group moves to the nearest suitable place outside it (not
// class none, not under a placeStatus itself), else the nearest place of any kind outside it; ties by place id. It runs after the
// same event's named moves (ruling 39): someone a named move of that event placed (even into the group) is exempt. Someone with You
// is not moved: a deferred displacement to the same place waits until they part from You (cast-defer.js). An authored event moves
// protected people too; a template does not (it is not placed where a protected person lives, templates-day.js; here it is a warning
// and they stay). Pure (on `ws`).

import { resolveRef } from './geo.js';
import { groupOf } from './geo-scope.js';
import { masked } from './placement.js';
import { placeOf } from './cast-where.js';
import { displace } from './cast.js';
import { titleOf } from './event-title.js';

/** Evacuate the group of `ref` (a place) for the placeStatus `condition` set by `source` on `day`. */
export function evacuate(ws, ref, condition, source, day) {
    const found = resolveRef(ws.geo, ref);
    if (found?.kind !== 'place') return;
    const here = found.place;
    const group = new Set(groupOf(ws.geo, here.name));
    const residents = [...ws.people.values()].filter(person => ws.cast[person.id]?.died === undefined && group.has(placeOf(ws, person.id)));
    if (!residents.length) return;
    const near = list => list.map(place => ({ place, d: (place.x - here.x) ** 2 + (place.y - here.y) ** 2 })).sort((a, b) => a.d - b.d || (a.place.id < b.place.id ? -1 : 1))[0]?.place;
    const others = ws.geo.places.filter(place => !group.has(place.name));
    const to = near(others.filter(place => place.klass !== 'none' && !masked(ws, place, day))) ?? near(others);
    if (!to) return;
    const until = `cleared:${condition}@${here.name}`;
    const shown = place => resolveRef(ws.geo, place)?.name ?? place;
    for (const person of residents) {
        const from = placeOf(ws, person.id);
        if (person.protected && source.kind !== 'event') { ws.warnings.push(`${person.name} is protected and stays at ${shown(from)} (a happening cannot move them).`); continue; }
        // Placed (or, with You, deferred) by a named move of this same event (ruling 39): the named move decides, not the evacuation.
        if (source.kind === 'event' && (ws.cast[person.id]?.displaced?.by === source.id || ws.cast[person.id]?.deferred?.by === source.id)) continue;
        if (ws.withYou.has(person.id)) {
            ws.cast[person.id] = { ...(ws.cast[person.id] ?? {}), deferred: { to: to.name, by: source.id, until, title: source.title ?? source.id } };
            const why = titleOf(source.title, source.id);
            ws.journal.push({ day, text: why ? `${person.name} stays with You — ${why}` : `${person.name} stays with You`, by: source.id, withYou: true });
            continue;
        }
        // The condition in words: the Journal line and the routine ("staying at … because …") are read by the reader.
        const word = condition.replace(/[-_]+/g, ' ');
        displace(ws, person, to.name, { until, title: word, line: `${person.name} fled ${shown(from)} for ${to.name} (${word}).` }, day, source.id);
    }
}
