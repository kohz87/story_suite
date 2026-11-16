// Story Director v2, world: the links the World map needs, worked out on read from what is known (nothing stored):
// place ids by name, a faction's members, and the open quests tied to a place.

import { lineKey } from '../../../changes.js';
import { parseLocation } from '../../../places.js';
import { queryOf, tryQuery } from './query.js';
import { planned, threadsOf } from './shared-threads.js';
import { cut, isRecord, text } from './shared-text.js';

const keyOf = value => lineKey(text(value));

/** The atlas's places by name key (a town of "Town — Spot" counts): `Map<key, id>`; empty without the atlas. */
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

// The group words of a dossier: faction, group and affiliation, also as custom fields.
function tagsOf(dossier) {
    const custom = isRecord(dossier?.customFields) ? dossier.customFields : {};
    return ['faction', 'group', 'affiliation'].flatMap(name => [dossier?.[name], custom[name]]).flatMap(tag => text(tag).split(',')).map(tag => keyOf(text(tag).replace(/^(?:the|a|an)\s+/i, ''))).filter(Boolean);
}

/**
 * Who belongs to which faction: `(faction) => [{ personId, name }]`, from the known people's dossiers read once (faction, group or
 * affiliation naming the faction or a name it goes by). No one without NPC State Delta.
 */
export function memberFinder(tools) {
    const query = queryOf(tools);
    const known = tryQuery(query, 'npc.known', {}, null);
    const people = [];
    for (const name of Array.isArray(known) ? known : []) {
        const dossier = tryQuery(query, 'npc.dossier', { name }, null);
        if (isRecord(dossier)) people.push({ personId: text(dossier.id) || null, name: cut(name, 80), tags: new Set(tagsOf(dossier)) });
    }
    return faction => {
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
