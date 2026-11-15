// Parses and applies route and landmark change lines for the atlas.

import { parseLocation } from '../../../places.js';
import {
    MAX_NAME, cleanName, cleanWord, findPlace, keyOf, newId, routesBetween,
} from '../domain.js';
import { packPlace, packWorld } from '../world.js';
import { MAX_PLACES, MAX_ROUTES, NEW_PER_REPLY } from './limits.js';
import { ensurePlace } from './places.js';
import { asText, queryOf } from './shared-helpers.js';

const ARROW = /\s*(?:→|⟶|➔|->|=>)\s*/u;
const AMOUNT = /^(\d+(?:\.\d+)?)\s*(h|hrs?|hours?|d|days?)?$/i;

// The reply a story line comes from: its record ID (ctx.carrier.sid, which stays with it when an earlier
// message is deleted), else its "index:swipe" key; null outside a reply's capture.
function replyOf(ctx) {
    const carrier = ctx?.carrier;
    if (ctx?.cause !== 'story' || !carrier || typeof carrier !== 'object') return null;
    for (const value of [carrier.sid, carrier.key]) if (typeof value === 'string' && value && value.length <= MAX_NAME) return value;
    return null;
}

// The packs' places and routes, read once per reply's capture rather than once per line (each query
// gives a copy): kept while the lines of one reply follow one another (the same reply and text, later
// lines, later receipts), read again otherwise.
let packCache = null;
function packWorldFor(ctx, line) {
    const reply = replyOf(ctx);
    const index = Number.isSafeInteger(line?.index) ? line.index : -1;
    const rev = Number.isSafeInteger(ctx?.rev) ? ctx.rev : -1;
    const text = typeof ctx?.chat?.reply === 'string' ? ctx.chat.reply : null;
    const cached = packCache;
    if (reply && cached && cached.reply === reply && cached.text === text && index > cached.index && rev > cached.rev) {
        packCache = { ...cached, index, rev };
        return cached.world;
    }
    const world = packWorld(queryOf(ctx));
    packCache = reply ? { reply, text, index, rev, world } : null;
    return world;
}

/**
 * Why `adding` more places and `routes` more routes do not fit (one reply's NEW_PER_REPLY, the atlas's
 * MAX_PLACES and MAX_ROUTES), or ''. A reply's own are counted by `made` (domain.js).
 */
function noRoom(atlas, reply, { places = 0, routes = 0 }) {
    const count = (table, extra) => {
        if (!extra) return { all: 0, mine: 0 };
        const list = Object.values(atlas[table]);
        return { all: list.length + extra, mine: reply ? list.filter(entry => entry?.made === reply).length + extra : 0 };
    };
    const p = count('places', places);
    const r = count('routes', routes);
    if (p.mine > NEW_PER_REPLY) return `one reply adds at most ${NEW_PER_REPLY} new places to the map`;
    if (r.mine > NEW_PER_REPLY) return `one reply adds at most ${NEW_PER_REPLY} new routes to the map`;
    if (p.all > MAX_PLACES) return `the map keeps at most ${MAX_PLACES} places`;
    if (r.all > MAX_ROUTES) return `the map keeps at most ${MAX_ROUTES} routes`;
    return '';
}

// Whether `name` is a place the atlas has (by its name or the pack's name for it).
const onMap = (atlas, pack, name) => Boolean(findPlace(atlas, name) ?? findPlace(atlas, packPlace(pack, name)?.name));

/** A whole-number route time from `days:` / `hours:` labels: `{ time }` (maybe `{}`) or `{ error }`. */
export function routeTime(labels = {}) {
    const read = (value, unit) => {
        if (value === undefined) return { value: undefined };
        const match = asText(value).trim().match(AMOUNT);
        if (!match) return { error: `"${unit}: ${value}" is not a number of ${unit}.` };
        const said = match[2]?.toLowerCase() ?? '';
        const amount = Number(match[1]);
        const inUnit = said.startsWith('d') ? 'days' : said.startsWith('h') ? 'hours' : unit;
        return { value: inUnit === unit ? amount : unit === 'days' ? amount / 24 : amount * 24 };
    };
    const days = read(labels.days, 'days');
    const hours = read(labels.hours, 'hours');
    if (days.error || hours.error) return { error: days.error ?? hours.error };
    if (days.value === undefined && hours.value === undefined) return { time: {} };
    const total = (days.value ?? 0) * 24 + (hours.value ?? 0);
    if (!(total > 0)) return { error: 'A route takes some time: give hours or days above 0.' };
    const whole = [days.value, hours.value].every(value => value === undefined || Number.isInteger(value));
    if (!whole) return { time: { hours: Math.max(1, Math.round(total)) } };
    const time = {};
    if (days.value) time.days = days.value;
    if (hours.value) time.hours = hours.value;
    return { time };
}

/** "2 h", "1 day", "1 day 6 h" for a route's own time ('' when none). */
export function routeTimeText(route) {
    const parts = [];
    if (route?.days) parts.push(`${route.days} ${route.days === 1 ? 'day' : 'days'}`);
    if (route?.hours) parts.push(`${route.hours} h`);
    return parts.join(' ');
}

function lineText(line) {
    const labels = Object.entries(line?.labels ?? {}).map(([label, value]) => ` | ${label}: ${value}`).join('');
    return `${line?.op ?? ''} ${line?.kind ?? ''} ${line?.name ?? ''}${line?.text ? ` — ${line.text}` : ''}${labels}`.trim();
}

// The two ends a route line names: `A — B`, `A → B`, or `A | to: B`.
function routeEnds(line) {
    let from = cleanName(line?.name);
    let to = cleanName(line?.text) || cleanName(line?.labels?.to);
    if (!to && ARROW.test(from)) [from, to] = from.split(ARROW).map(cleanName);
    return { from, to };
}

/** `route` lines (`+`/`~` a route, `-` a route gone). */
export function applyRouteLine(ctx, line) {
    const op = line?.op;
    if (!['+', '~', '-'].includes(op)) return ctx.fail('INVALID', `"${lineText(line)}": route lines use +, ~ or -.`);
    const { from, to } = routeEnds(line);
    if (!keyOf(from) || !keyOf(to)) return ctx.fail('INVALID', `"${lineText(line)}" needs two places: + route Place — Other Place.`);
    if (keyOf(from) === keyOf(to)) return ctx.fail('INVALID', `"${lineText(line)}" leads from a place to itself.`);
    const kind = cleanWord(line?.labels?.kind, { lower: true });
    const atlas = ctx.draft('atlas');
    const pack = packWorldFor(ctx, line);

    if (op === '-') {
        const a = findPlace(atlas, from) ?? findPlace(atlas, packPlace(pack, from)?.name);
        const b = findPlace(atlas, to) ?? findPlace(atlas, packPlace(pack, to)?.name);
        const gone = a && b ? routesBetween(atlas, a.id, b.id).filter(route => !kind || route.kind === kind) : [];
        if (!gone.length) return ctx.fail('NOT_FOUND', `There is no route between ${from} and ${to} on the map.`);
        for (const route of gone) delete atlas.routes[route.id];
        return { summary: `The way between ${a.name} and ${b.name} is gone.`, narrate: false, data: { removed: gone.map(route => route.id) } };
    }

    const time = routeTime(line?.labels);
    if (time.error) return ctx.fail('INVALID', `"${lineText(line)}": ${time.error}`);
    const reply = replyOf(ctx);
    const newPlaces = [from, to].filter(name => !onMap(atlas, pack, name)).length;
    const knownA = findPlace(atlas, from) ?? findPlace(atlas, packPlace(pack, from)?.name);
    const knownB = findPlace(atlas, to) ?? findPlace(atlas, packPlace(pack, to)?.name);
    const already = knownA && knownB ? routesBetween(atlas, knownA.id, knownB.id) : [];
    const newRoute = !(kind ? already.some(entry => entry.kind === kind) : already.length);
    const full = noRoom(atlas, reply, { places: newPlaces, routes: newRoute ? 1 : 0 });
    if (full) return ctx.fail('REFUSED', `"${lineText(line)}" was not used: ${full}.`);
    const made = (entry, created) => {
        if (created && reply) entry.made = reply;
        return entry;
    };
    const ends = [from, to].map(name => ensurePlace(atlas, ctx, pack, name, { discovered: false }));
    const [a, b] = ends.map(end => made(end.place, end.created));
    const between = routesBetween(atlas, a.id, b.id);
    let route = (kind ? between.find(entry => entry.kind === kind) : between[0]) ?? null;
    const created = !route;
    if (created) {
        const id = newId(ctx, 'rt', atlas.routes);
        route = made({ id, from: a.id, to: b.id, kind }, true);
        atlas.routes[id] = route;
    } else route = atlas.routes[route.id];
    if (Object.keys(time.time).length) {
        delete route.days;
        delete route.hours;
        Object.assign(route, time.time);
    }
    const when = routeTimeText(route);
    const what = route.kind || 'route';
    return {
        summary: `${created ? 'A' : 'The'} ${what} joins ${a.name} and ${b.name}${when ? ` (${when})` : ''}.`,
        narrate: false,
        data: { route: route.id, created },
    };
}

// `at: 12, 40` (or `[12, 40]`) on a landmark: its coordinates.
function coordsOf(text) {
    const match = asText(text).match(/(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)/);
    return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

/** `landmark` lines (`+`/`~`): a place the story describes, with its region, kind and plane. */
export function applyLandmarkLine(ctx, line) {
    const op = line?.op;
    if (op === '-') return ctx.fail('REFUSED', `"${lineText(line)}": places stay on the map; the reader can rename them on the Map.`);
    if (!['+', '~'].includes(op)) return ctx.fail('INVALID', `"${lineText(line)}": landmark lines use + or ~.`);
    const location = parseLocation(line?.name);
    const name = cleanName(location.name);
    if (!keyOf(name)) return ctx.fail('INVALID', `"${lineText(line)}" names no place.`);
    const labels = line?.labels ?? {};
    const atlas = ctx.draft('atlas');
    const pack = packWorldFor(ctx, line);
    const known = onMap(atlas, pack, name);
    const reply = replyOf(ctx);
    const full = known ? '' : noRoom(atlas, reply, { places: 1 });
    if (full) return ctx.fail('REFUSED', `"${lineText(line)}" was not used: ${full}.`);
    const aliases = asText(labels.aka ?? labels.alias).split(/\s*[,;]\s*/).map(cleanName).filter(Boolean);
    // A label left out keeps what the place has; one written empty (`| kind: `) clears it.
    const said = (value, options) => (value === undefined || value === null ? undefined : cleanWord(value, options));
    const kind = said(labels.kind, { lower: true });
    const { place, created } = ensurePlace(atlas, ctx, pack, name, {
        discovered: true,
        region: said(labels.region),
        kind: kind === undefined && !known && !packPlace(pack, name) ? 'landmark' : kind,
        layer: said(labels.plane ?? labels.layer),
        coords: coordsOf(labels.at) ?? location.coords,
        aliases,
        overwrite: true,
    });
    if (created && reply) place.made = reply;
    const about = [place.kind, place.region].filter(Boolean).join(', ');
    return { summary: `${place.name}${about ? ` (${about})` : ''} is on the map.`, narrate: false, data: { place: place.id, created } };
}
