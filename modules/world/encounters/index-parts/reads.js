// What a roll reads from the head state and the queries: the scene's place as the pack knows it (id, kind, engine class, place group),
// the pack's backdrop rows, the met cast who are here, who is in the scene, and the world conditions that hold here (only with World
// events on).

import { sceneOf, ask } from '../../../time/tracker/scene.js';
import { peopleOf, isMet, isAlive } from '../../../cast/cast/domain.js';
import { placeGroupOf } from '../../pulse/tables.js';
import { readWorld } from '../../chronicle/world-daily/read-world.js';
import { worldEventsOn } from '../../chronicle/conditions/feature.js';
import { normalizeBackdrops } from './backdrops.js';

const CLASSES = new Set(['capital', 'city', 'town', 'village', 'outpost', 'site', 'none']);
const low = value => String(value ?? '').trim().toLowerCase();
const heads = name => [name, ...String(name).split(/\s*\/\s*/).reverse()].map(part => String(part).trim()).filter(Boolean);
const namesOf = place => [place.id, place.slug, place.name, ...(Array.isArray(place.aliases) ? place.aliases : [])].map(low).filter(Boolean);

// Tests only: the pack kind is not in pack format 4 yet (owner question), so a test hands its backdrop list in here.
let override = null;

/** Tests only: the packs' backdrop list is `fn(list read from the packs)` until the returned function is called. */
export function overrideBackdrops(fn) {
    override = typeof fn === 'function' ? fn : null;
    return () => { override = null; };
}

function packPlace(places, name) {
    for (const head of heads(name)) {
        const found = places.find(place => place && namesOf(place).includes(low(head)));
        if (found) return found;
    }
    return null;
}

/**
 * `hereOf(query, state, tools)` → null (no place) or `{ place: { key, name, aliases, kind, klass, group }, pack, problems, cast, present,
 * conditions }`. `tools`: what can say whether World events is on (a ctx or a view).
 */
export function hereOf(query, state, tools) {
    const scene = sceneOf(query, state);
    if (!scene.place) return null;
    const world = readWorld(query);
    const found = packPlace(world.places, scene.place);
    const kind = String(found?.kind ?? ask(query, 'scene.place', {}, null)?.kind ?? '').trim();
    const mapped = world.placeKinds?.[kind];
    const klass = CLASSES.has(mapped) ? mapped : CLASSES.has(low(kind)) ? low(kind) : 'town';
    const name = String(found?.name ?? scene.place);
    const place = { key: low(found?.id ?? found?.slug ?? name), name, aliases: Array.isArray(found?.aliases) ? found.aliases : [], kind, klass, group: placeGroupOf(kind) };
    const listed = ask(query, 'packs.content', { kind: 'backdrops' }, null) ?? undefined;
    const { rows: pack, problems } = normalizeBackdrops(override ? override(listed) : listed);
    const present = new Set(scene.people.flatMap(person => [person.name, ...(person.names ?? [])]).map(low).filter(Boolean));
    const here = new Set([low(place.key), low(name), ...heads(scene.place).map(low)]);
    const cast = peopleOf(state?.domains?.cast).filter(person => isMet(person) && isAlive(person) && heads(person.where ?? '').some(head => here.has(low(head))))
        .map(person => ({ key: person.key, name: String(person.name ?? person.key) }));
    const conditions = worldEventsOn(tools) ? (ask(query, 'chronicle.conditions', { at: name }, []) ?? []).map(entry => entry?.name).filter(Boolean) : [];
    return { place, pack, problems, cast, present, conditions };
}
