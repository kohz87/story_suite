// Building the atlas and trip tail lines and reading the scene's place.

import { mapSettings } from '../../places.js';
import { packPlace, packWorld, worldOf } from '../world.js';
import { parentOf } from '../parent.js';
import { travelTime } from '../travel.js';
import { TRIP_FEATURE, calendarOf, tripLines, tripView } from '../trip.js';
import { TAIL_BUDGET } from './grammar.js';
import { compassWords, kmScale, trustedPoint } from '../where.js';
import { PLACES_TAIL_BUDGET, placesLine } from './places-line.js';
import { anchorOf, packRegions } from '../anchor.js';

// Characters the line may take: Story Block estimates tokens as characters / 4.
const MAX_CHARS = TAIL_BUDGET * 4;

const settingsOf = view => (typeof view?.settings === 'function' ? view.settings() : view?.settings) ?? {};
const packOf = view => packWorld(typeof view?.query === 'function' ? (name, args) => view.query(name, args) : null);
// The world-events switch, read by name (the world module's feature; off when the host cannot say).
function worldEventsOn(view) {
    try { return typeof view?.feature === 'function' && view.feature('story-director.world-events') === true; } catch { return false; }
}

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

// Any point a place has (the default for a caller without the atlas): routesLine's own callers pass the vouched-for one (where.js).
const anyPoint = place => (Number.isFinite(place?.x) && Number.isFinite(place?.y) ? { x: place.x, y: place.y } : null);

/** "Routes from Bluewatch Village: Old Weir (east) by road, 2 h · Thunder Ruins (north) by trail, ≈ 1.5 days." or ''. */
export function routesLine(world, here, { map, pointOf = anyPoint } = {}) {
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
        // The way the far end lies (owner, 22 Nov: the narrator sent the Bluewatch–Auvoth road "east"; Auvoth lies west): none from a guessed point.
        const direction = compassWords(pointOf(from), pointOf(other), map);
        const item = `${other.name}${direction ? ` (${direction})` : ''}${route.kind ? ` by ${route.kind}` : ''}${trip ? `, ${trip.text}` : ''}`;
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
    const pack = packOf(view);
    const world = worldOf(atlas, pack);
    const map = mapSettings(settingsOf(view).map);
    const packHas = name => { const found = packPlace(pack, name); return Number.isFinite(found?.x) && Number.isFinite(found?.y); };
    const pointOf = place => trustedPoint(place, { atlas, world, packHas });
    let line = routesLine(world, here, { map, pointOf });
    // World events on (LAB2-3): a place with no routes of its own the story made (a tavern) gives the routes of the pack place it stands for (anchor.js), as the news and conditions do.
    if (!line && worldEventsOn(view)) {
        const anchor = anchorOf(world, atlas, packOf(view), here, { region: scenePlace(view).region, regions: packRegions(typeof view?.query === 'function' ? (name, args) => view.query(name, args) : null) });
        if (anchor?.name && anchor.via !== 'pack') line = routesLine(world, anchor.name, { map, pointOf });
    }
    // Where places lie (as the crow flies): its own room, after the routes, so it is the first optional line to go when the tail is full.
    const said = [view?.chat?.lastUser, view?.chat?.lastReply].filter(text => typeof text === 'string').join('\n');
    const where = placesLine(world, here, { said, map, pointOf, scale: kmScale(world, map), maxChars: PLACES_TAIL_BUDGET * 4 });
    return { lines: [], optional: [line, where].filter(Boolean) };
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
