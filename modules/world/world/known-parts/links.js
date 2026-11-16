// Story Director v2, world: the links the World map needs, worked out on read from what is known (nothing stored):
// place ids by name, a faction's members, and the open quests tied to a place.

import { lineKey } from '../../changes.js';
import { parseLocation } from '../../../atlas/places.js';
import { queryOf, tryQuery } from './query.js';
import { planned, threadsOf } from './shared-threads.js';
import { cut, isRecord, text } from './shared-text.js';

const keyOf = value => lineKey(text(value));

/** The atlas's places by whole name key: `Map<key, id>`; empty without the atlas. (placeIdOf adds the "Town — Spot" town fallback.) */
export function placeIds(tools) {
    const out = new Map();
    const places = tryQuery(queryOf(tools), 'atlas.places', {}, null);
    for (const place of Array.isArray(places) ? places : []) {
        const key = keyOf(place?.name);
        if (key && text(place.id) && !out.has(key)) out.set(key, text(place.id));
    }
    return out;
}

/** The id of the place a free-text name points at ("Bluewatch — Guild Office" is Bluewatch), or null. */
export function placeIdOf(ids, name) {
    const whole = keyOf(name);
    if (!whole) return null;
    return ids.get(whole) ?? ids.get(keyOf(parseLocation(text(name)).name)) ?? null;
}

// The group words of a dossier. NPC State has no faction field: the only source is a custom field the owner configured named
// Faction, Group or Affiliation (kept as typed, so matched case-insensitively), as `npc.dossier` returns it in `customFields`.
const GROUP_FIELDS = new Set(['faction', 'group', 'affiliation']);
function tagsOf(dossier) {
    const custom = isRecord(dossier?.customFields) ? dossier.customFields : {};
    return Object.entries(custom).filter(([name]) => GROUP_FIELDS.has(text(name).toLowerCase())).flatMap(([, tag]) => text(tag).split(','))
        .map(tag => keyOf(text(tag).replace(/^(?:the|a|an)\s+/i, ''))).filter(Boolean);
}

/**
 * Who belongs to which faction: `(faction) => [{ personId, name }]`. Lazy: the known people's dossiers are read once, on the first
 * call (so a World read with no factions reads none). Members appear only when the owner added a Faction, Group or Affiliation
 * custom field in NPC State (no built-in source until the people store); no one without NPC State.
 */
export function memberFinder(tools) {
    let people = null;
    const load = () => {
        const query = queryOf(tools);
        const known = tryQuery(query, 'npc.known', {}, null);
        people = [];
        for (const name of Array.isArray(known) ? known : []) {
            const dossier = tryQuery(query, 'npc.dossier', { name }, null);
            if (isRecord(dossier)) people.push({ personId: text(dossier.id) || null, name: cut(name, 80), tags: new Set(tagsOf(dossier)) });
        }
    };
    return faction => {
        if (!people) load();
        const wanted = [faction.name, ...(faction.aka ?? [])].map(keyOf).filter(Boolean);
        return people.filter(person => wanted.some(tag => person.tags.has(tag))).map(({ personId, name }) => ({ personId, name }));
    };
}

/** The open quests {{user}} took that name a place: `[{ id, name, place, placeId }]` (an arc planner's or a hidden name is left out). */
export function placeQuests(state, { hidden, ids }) {
    const out = [];
    for (const thread of threadsOf(state)) {
        if (thread.kind !== 'quest' || thread.status !== 'active' || thread.ended || thread.offer || planned(thread)) continue;
        if (hidden.words.has(lineKey(text(thread.key)))) continue;
        const place = cut(thread.fields?.place, 80);
        if (place) out.push({ id: text(thread.id), name: cut(thread.key, 80), place, placeId: placeIdOf(ids, place) });
    }
    return out;
}
