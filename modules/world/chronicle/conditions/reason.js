// The reason the World tab shows for a condition: the happening's or the pack's own words, never the id of the event or template that set it. Pure.
// Read-side, so entries already stored with an id as their `why` read right too.

import { readWorld } from '../world-daily/read-world.js';
import { unfiredSummary } from '../../daily/event-title.js';
import { buildGeo } from '../../daily/geo.js';
import { ancestors } from '../../daily/geo-scope.js';
import { regionLabel } from '../../daily/region-label.js';

const plain = text => String(text ?? '').replace(/\s+/g, ' ').trim().replace(/[.!?…]+$/, '');
const newest = (events, since) => events.find(event => event.since === since) ?? [...events].sort((a, b) => (b.since ?? 0) - (a.since ?? 0))[0];
// (a condition set when a happening ended is filed with its end line, "Ended: …")
const wordsOf = event => (plain(event?.summary) || plain(event?.name?.replace(/ · [^·]*$/, ''))).replace(/^Ended:\s*/, '');

const packWords = (row, id) => plain(unfiredSummary(row?.summary, id));
const low = text => String(text ?? '').trim().toLowerCase();

/** Whether a happening at `place` lies inside a region's or realm's condition; `ref` is as the card shows it (a region by its display name). */
function inside(geo, place, ref) {
    return ancestors(geo, place).some(level => low(level) === low(ref) || low(regionLabel(geo, level)) === low(ref));
}

/**
 * `reasonReader(query, events)` → `entry => reason` ('' for none), `events` being the chronicle's. A condition the daily step set by a
 * spec event (`by: event:<id>`) says the happening's summary. A template's (`by: code`, `why` its id) says that day's happening at that
 * place, or for a wider condition inside its region or realm. With no happening, an id is replaced by the pack's summary or dropped; any other words the story or the pack gave are kept.
 */
export function reasonReader(query, events) {
    let world = null;
    let geo = null;
    const worldNow = () => (world ??= readWorld(query));
    const rowOf = (kind, key, id) => worldNow()[kind].find(row => row?.[key] === id);
    // A place condition's happening is at that place; a wider one's must lie inside it, so another region's words are never given.
    const here = (event, entry) => (entry.scope === 'place' ? event.place === entry.ref : inside((geo ??= buildGeo(worldNow())), event.place, entry.ref));
    return entry => {
        const why = typeof entry.why === 'string' ? entry.why : '';
        const id = /^event:(?!pack\.|world\.)(.+)$/.exec(String(entry.by ?? ''))?.[1];
        if (id) {
            const said = wordsOf(newest(events.filter(event => event?.by === `event:world.${id}` || event?.by === `event:world.template.${id}`), entry.since));
            if (said && said !== id) return said;
            return why === id ? packWords(rowOf('events', 'id', id), id) : why;
        }
        if (entry.by !== 'code' || !why) return why;
        const said = wordsOf(events.find(event => event?.by === `event:world.template.${why}` && event.since === entry.since && here(event, entry)));
        if (said && said !== why) return said;
        const template = rowOf('templates', 'template', why);
        return template ? packWords(template, why) : why;
    };
}
