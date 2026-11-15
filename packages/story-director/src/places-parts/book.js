// Story Director: location parsing and place-book construction and lookup.

const COORDS = /[[(]\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*[\])]/;

// Apostrophes are dropped, so "Hollins Reach" in a reply is the pack's "Hollin's Reach".
const keyOf = name => String(name ?? '').normalize('NFKC').replace(/['’‘`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
// How far (map units) a reply's coordinates may sit from the pack's before it counts as a disagreement.
const COORDS_SLACK = 1;
const finite = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * "Auvoth | Seventh Seal Terrace | [59.0, 110.0]" →
 * { name: 'Auvoth', spot: 'Seventh Seal Terrace', parts, coords: { x: 59, y: 110 } }.
 */
export function parseLocation(text) {
    const source = String(text ?? '').replace(/\*\*/g, '');
    const match = COORDS.exec(source);
    const coords = match ? { x: Number(match[1]), y: Number(match[2]) } : null;
    const parts = (match ? source.replace(match[0], '') : source)
        .split(/\s*(?:\||·|—|–)\s*/)
        .map(part => part.replace(/\[[^\]]*\]/g, '').trim())
        .filter(Boolean);
    return { name: parts[0] ?? '', spot: parts.slice(1).join(' · '), parts, coords };
}

/**
 * The place book from the scene's locations, in chat order:
 * visits = [{ message, time, text }] → { places, current }.
 * A place: { key, name, coords, coordsFrom: 'story' | 'pack' | null, storyCoords, visits,
 * firstTime, lastTime, firstMessage, lastMessage, spots: [latest first] }. The pack's coordinates win;
 * `storyCoords` is the reply's latest when it is more than a map unit away from them, else null. `places` is most recently visited first;
 * places only a world pack knows (`visits: 0`) come last.
 */
export function buildPlaceBook(visits, { pack = null } = {}) {
    const byKey = new Map();
    let previous = null;
    let current = null;
    for (const visit of Array.isArray(visits) ? visits : []) {
        const location = parseLocation(visit?.text);
        if (!location.name) continue;
        const key = keyOf(location.name);
        let place = byKey.get(key);
        if (!place) {
            place = { key, name: location.name, coords: null, coordsFrom: null, storyCoords: null, visits: 0, firstTime: null, lastTime: null, firstMessage: null, lastMessage: null, spots: [] };
            byKey.set(key, place);
        }
        // A stay over several replies is one visit.
        if (previous !== key) place.visits += 1;
        previous = key;
        current = key;
        if (location.coords) {
            place.coords = location.coords;
            place.coordsFrom = 'story';
        }
        const time = finite(visit?.time);
        if (time !== null) {
            place.firstTime ??= time;
            place.lastTime = time;
        }
        // (0.9.19) The reply that first named it, for the Journal's "first visit".
        place.firstMessage ??= visit?.message ?? null;
        place.lastMessage = visit?.message ?? place.lastMessage;
        if (location.spot) {
            place.spots = [location.spot, ...place.spots.filter(spot => keyOf(spot) !== keyOf(location.spot))];
        }
    }
    // A world pack's coordinates win over the story's, fill in the ones it never wrote, and add
    // the rest of the map.
    for (const [name, info] of Object.entries(pack?.places ?? {})) {
        const x = finite(info?.x);
        const y = finite(info?.y);
        if (x === null || y === null) continue;
        const key = keyOf(name);
        const place = byKey.get(key);
        if (place) {
            const story = place.coords;
            place.name = name;   // the pack's spelling
            place.coords = { x, y };
            place.coordsFrom = 'pack';
            place.storyCoords = story && Math.hypot(story.x - x, story.y - y) > COORDS_SLACK ? story : null;
        } else {
            byKey.set(key, { key, name, coords: { x, y }, coordsFrom: 'pack', storyCoords: null, visits: 0, firstTime: null, lastTime: null, firstMessage: null, lastMessage: null, spots: [] });
        }
    }
    const places = [...byKey.values()].sort((a, b) => {
        if (!a.visits !== !b.visits) return a.visits ? -1 : 1;
        return (b.lastMessage ?? -1) - (a.lastMessage ?? -1) || a.name.localeCompare(b.name);
    });
    return { places, current };
}

/** The place for a name: exact first, then one whose name the text starts with. */
export function findBookPlace(book, text) {
    const key = keyOf(parseLocation(text).name || text);
    if (!key) return null;
    const places = book?.places ?? [];
    return places.find(place => place.key === key)
        ?? places.filter(place => key.startsWith(place.key) || place.key.startsWith(key))
            .sort((a, b) => b.key.length - a.key.length)[0]
        ?? null;
}
