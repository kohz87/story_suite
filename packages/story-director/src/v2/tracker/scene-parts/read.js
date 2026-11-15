// Story Director v2, tracker part (scene): reads the scene (place, region, people present) from the queries.

import { lineKey } from '../../../changes.js';
import { MIN_NAME, NAME_POINTS } from './shared-limits.js';
import { cutPoints, flat } from './shared-text.js';

const PEOPLE_SHOWN = 12;

/** Asks a query; `fallback` when there is none, it throws or it answers undefined. */
export function ask(query, name, args = {}, fallback = null) {
    if (typeof query !== 'function') return fallback;
    try {
        const value = query(name, args);
        return value === undefined ? fallback : value;
    } catch {
        return fallback;
    }
}

/**
 * The scene as the tail reads it: `{ place, region, people: [{ name, names }], known, nsd }`.
 * `place`/`region`: the atlas's place (`atlas.here`) else Story Block's `scene.place`. `people`: Story
 * Block's present list (`scene.present`, else the scene domain) and NPC State Delta's (`npc.present`), one
 * entry per person (folded name), with every name they go by (NSD's dossier name and aliases when NSD
 * answers `npc.dossier`). `known`: whether there is a scene to filter by at all.
 */
export function sceneOf(query, state) {
    const atlas = ask(query, 'atlas.here', {}, null);
    const scenePlace = ask(query, 'scene.place', {}, null) ?? state?.domains?.scene?.place ?? null;
    const place = cutPoints(flat(atlas?.name) || flat(scenePlace?.name), NAME_POINTS);
    const region = cutPoints(flat(atlas?.region) || flat(scenePlace?.region), NAME_POINTS);
    const listed = ask(query, 'scene.present', {}, null) ?? state?.domains?.scene?.present ?? [];
    const nsdPresent = ask(query, 'npc.present', {}, null);
    const nsd = Array.isArray(ask(query, 'npc.known', {}, null));
    const people = [];
    const byKey = new Map();
    for (const entry of [...(Array.isArray(listed) ? listed : []), ...(Array.isArray(nsdPresent) ? nsdPresent : [])]) {
        const name = cutPoints(typeof entry === 'string' ? entry : entry?.name, NAME_POINTS);
        if (!lineKey(name) || people.length >= PEOPLE_SHOWN) continue;
        const dossier = nsd ? ask(query, 'npc.dossier', { name }, null) : null;
        const own = cutPoints(dossier?.name, NAME_POINTS) || name;
        const key = lineKey(own);
        const aliases = Array.isArray(dossier?.aliases) ? dossier.aliases : typeof dossier?.aliases === 'string' ? dossier.aliases.split(',') : [];
        const all = [own, name, ...aliases.map(alias => cutPoints(alias, NAME_POINTS))].filter(word => word.length >= MIN_NAME);
        if (byKey.has(key)) {
            const person = byKey.get(key);
            for (const word of all) if (!person.names.includes(word)) person.names.push(word);
            continue;
        }
        const person = { name: own, key, names: [...new Set(all)], dossier };
        byKey.set(key, person);
        people.push(person);
    }
    return { place, region, people, nsd, known: Boolean(place || region || people.length) };
}
