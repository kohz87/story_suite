// Building the atlas and trip tail lines and reading the scene's place.

import { mapSettings } from '../../places.js';
import { packWorld, worldOf } from '../world.js';
import { parentOf } from '../parent.js';
import { travelTime } from '../travel.js';
import { TRIP_FEATURE, calendarOf, tripLines, tripView } from '../trip.js';
import { TAIL_BUDGET } from './grammar.js';

// Characters the line may take: Story Block estimates tokens as characters / 4.
const MAX_CHARS = TAIL_BUDGET * 4;

const settingsOf = view => (typeof view?.settings === 'function' ? view.settings() : view?.settings) ?? {};

/** The scene's place `{ name, kind, region }` through the `scene.place` query, else the state. */
export function scenePlace(view) {
    let place = null;
    try {
        if (typeof view?.query === 'function') place = view.query('scene.place');
    } catch {
        place = null;
    }
    place ??= view?.state?.domains?.scene?.place ?? null;
    return { name: String(place?.name ?? ''), kind: String(place?.kind ?? ''), region: String(place?.region ?? '') };
}

/** "Routes from Bluewatch Village: Old Weir by road, 2 h · Thunder Ruins by trail, ≈ 1.5 days." or ''. */
export function routesLine(world, here, { map } = {}) {
    const at = world.find(here);
    if (!at) return '';
    // Street legs inside a city ("Highmark Capital / Crown Keep", 0.5 day) tell the narrator nothing: skip a leg whose two ends are the same
    // town's parts (one the other's parent, or both under one parent); legs leaving the town stay.
    const parentId = place => (place.parent ? world.find(place.parent) : parentOf(place.name, world)?.parent)?.id ?? null;
    const insideOf = place => {
        const upId = parentId(place);
        return other => other.id === upId || parentId(other) === place.id || (upId !== null && parentId(other) === upId);
    };
    const otherEnd = (route, id) => world.places.find(place => place.id === (route.from === id ? route.to : route.from));
    // A place with no way out of its own ("Auvoth · Southern Gatehouse"), or only street legs inside its town (a district whose one road
    // is to its city), goes by the town's routes and names it.
    const up = at.parent ? world.find(at.parent) : parentOf(at.name, world)?.parent ?? null;
    const insideAt = insideOf(at);
    const leaves = world.routes.some(route => {
        if (route.from !== at.id && route.to !== at.id) return false;
        const other = otherEnd(route, at.id);
        return other && !insideAt(other);
    });
    const from = !leaves && up && up.id !== at.id ? up : at;
    const inside = insideOf(from);
    const items = world.routes
        .filter(route => route.from === from.id || route.to === from.id)
        .map(route => {
            const other = otherEnd(route, from.id);
            const trip = travelTime({ places: world.places, routes: [route], find: world.find }, from.id, other.id, { map });
            return { other, route, trip };
        })
        .filter(entry => entry.other && !inside(entry.other))
        .sort((a, b) => (a.trip?.days ?? Infinity) - (b.trip?.days ?? Infinity) || a.other.name.localeCompare(b.other.name));
    const head = `Routes from ${from.name}: `;
    let text = '';
    const seen = new Set();
    for (const { other, route, trip } of items) {
        if (seen.has(other.id)) continue;
        seen.add(other.id);
        const item = `${other.name}${route.kind ? ` by ${route.kind}` : ''}${trip ? `, ${trip.text}` : ''}`;
        const next = text ? `${text} · ${item}` : item;
        if ((head + next + '.').length > MAX_CHARS) break;
        text = next;
    }
    return text ? `${head}${text}.` : '';
}

/** `context.tail(view)` → `{ lines, optional }` (SPEC §5). */
export function atlasTail(view) {
    const atlas = view?.state?.domains?.atlas;
    if (!atlas) return { lines: [], optional: [] };
    const here = scenePlace(view).name;
    if (!here.trim()) return { lines: [], optional: [] };
    const world = worldOf(atlas, packWorld(typeof view?.query === 'function' ? (name, args) => view.query(name, args) : null));
    const line = routesLine(world, here, { map: mapSettings(settingsOf(view).map) });
    return { lines: [], optional: line ? [line] : [] };
}

/**
 * The trip's tail lines (a context part under feature `story-director.trip`): while a trip is on, "On the road: …", and when a stage's
 * arrival has passed and the story has not moved the place, the cue to write `~ place` (trip.js `tripLines`). `{ lines, optional }`.
 */
export function tripTail(view) {
    const none = { lines: [], optional: [] };
    const atlas = view?.state?.domains?.atlas;
    if (!atlas?.trips || (typeof view?.feature === 'function' && view.feature(TRIP_FEATURE) === false)) return none;
    const query = typeof view?.query === 'function' ? (name, args) => view.query(name, args) : null;
    let asked = null;
    try { asked = query ? query('director.time', {}) : null; } catch { asked = null; }
    const minutes = Number.isSafeInteger(asked?.minutes) ? asked.minutes : view?.state?.domains?.director?.time?.minutes;
    if (!Number.isSafeInteger(minutes)) return none;
    const shown = tripView(atlas, { now: minutes, here: scenePlace(view).name, calendar: calendarOf(query) });
    return { lines: tripLines(shown), optional: [] };
}
