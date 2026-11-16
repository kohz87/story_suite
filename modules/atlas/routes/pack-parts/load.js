// Loads and validates world packs, reading places, edges, paces, and map warnings.

import { finite, isObject, names, nonNegative, num, positive } from '../util.js';
import { MODERN_CODES, MODERN_MODES, ROUTE_CODES } from './codes.js';
import { DEFAULT_COURIER_MULTIPLIER, DEFAULT_RULES, MODERN_RULES } from './rules.js';
import { normalizeMode } from './mode.js';

// Pace keys of the normalized shape; the reference format writes `downstream_favorable`.
const PACE_KEYS = ['foot', 'ride', 'wagon', 'boat', 'upstream', 'downstream', 'ship', 'vessel', 'flight'];
const PACE_ALIASES = { downstream_favorable: 'downstream' };

/**
 * Reads a world pack (JSON text or an object) in the reference format or the normalized
 * shape. Bad edges are skipped with a warning; an edge endpoint missing from `places` is a
 * warning (once per name) and the edge is kept, so the graph stays whole.
 */
export function loadWorldPack(json) {
    const errors = [];
    const warnings = [];
    const fail = message => ({ pack: null, errors: [...errors, message], warnings });

    let data = json;
    if (typeof json === 'string') {
        try {
            data = JSON.parse(json);
        } catch (error) {
            return fail(`Not valid JSON: ${error.message}`);
        }
    }
    if (!isObject(data)) return fail('A world pack must be a JSON object.');

    const places = readPlaces(data.places, errors);
    if (!places) return fail('The pack has no `places` object.');
    if (!Array.isArray(data.edges)) return fail('The pack has no `edges` list.');

    const edges = [];
    data.edges.forEach((raw, index) => {
        const edge = readEdge(raw);
        if (typeof edge === 'string') warnings.push(`Edge ${index + 1} skipped: ${edge}.`);
        else edges.push(edge);
    });
    if (!edges.length) return fail('The pack has no usable edges.');

    const missing = new Map();
    for (const edge of edges) {
        for (const name of [edge.a, edge.b]) {
            if (!Object.hasOwn(places, name)) missing.set(name, (missing.get(name) ?? 0) + 1);
        }
    }
    for (const [name, count] of missing) {
        warnings.push(`"${name}" is on ${count} ${count === 1 ? 'edge' : 'edges'} but not in places.`);
    }
    const codes = new Set(edges.map(edge => edge.code));
    const modern = isModernPack(data);
    const ownPaces = data.paces ?? data.pace_km_per_hour;
    for (const code of codes) {
        if (modern) {
            if (!Object.hasOwn(MODERN_CODES, code) && !(isObject(ownPaces) && Object.keys(ownPaces).some(key => key.trim().toUpperCase() === code))) {
                warnings.push(`Unknown road code "${code}" with no paces in pace_km_per_hour (nothing can use it).`);
            }
        } else if (!Object.hasOwn(ROUTE_CODES, code)) warnings.push(`Unknown road code "${code}" (R pace used).`);
    }

    warnings.push(...mapWarnings(places, edges, positive(data.scaleKmPerUnit ?? data.scale_km_per_unit)));

    const rules = data.rules ?? data.travel_rules ?? {};
    const pack = {
        name: String(data.name ?? data.source ?? ''),
        era: modern ? 'modern' : 'pre-modern',
        calendar: isObject(data.calendar) ? data.calendar : null,
        scaleKmPerUnit: positive(data.scaleKmPerUnit ?? data.scale_km_per_unit),
        places,
        edges,
        paces: modern ? modernPaces(data.paces ?? data.pace_km_per_hour, warnings) : readPaces(data.paces ?? data.pace_km_per_day, warnings),
        courierMultiplier: positive(data.courierMultiplier ?? data.courier_multiplier) ?? DEFAULT_COURIER_MULTIPLIER,
        rules: modern ? {
            unit: 'hour',
            roundUpTo: nonNegative(rules.roundUpTo ?? rules.round_edge_up_to_hours) ?? MODERN_RULES.roundUpTo,
            driveHoursPerDay: positive(rules.driveHoursPerDay ?? rules.drive_hours_per_day) ?? MODERN_RULES.driveHoursPerDay,
            restDayEvery: 0, crewedWaterRest: false, leveeRoads: [], noLevee: [],
        } : {
            roundUpTo: nonNegative(rules.roundUpTo ?? rules.round_edge_up_to_days) ?? DEFAULT_RULES.roundUpTo,
            restDayEvery: nonNegative(rules.restDayEvery ?? rules.rest_day_every_active_days) ?? DEFAULT_RULES.restDayEvery,
            crewedWaterRest: Boolean(rules.crewedWaterRest ?? rules.crewed_water_rest_days ?? false),
            leveeRoads: names(rules.leveeRoads ?? rules.levee_roads),
            noLevee: names(rules.noLevee ?? rules.no_levee),
        },
    };
    return { pack, errors, warnings };
}

// A modern pack says so, or gives its paces per hour.
function isModernPack(data) {
    const era = String(data?.era ?? '').trim().toLowerCase();
    if (era) return era === 'modern';
    if (data?.unit === 'hour' || data?.rules?.unit === 'hour') return true;
    return isObject(data?.pace_km_per_hour);
}

// The modern table with the pack's own paces merged over it: { CODE: { mode: pace } }. A pace
// of null takes a mode off a code.
function modernPaces(source, warnings) {
    const paces = Object.fromEntries(Object.entries(MODERN_CODES).map(([code, info]) => [code, { ...info.paces, ...(info.board ? { boardHours: info.board } : {}) }]));
    if (!isObject(source)) return paces;
    for (const [rawCode, table] of Object.entries(source)) {
        const code = rawCode.trim().toUpperCase();
        if (!isObject(table)) continue;
        paces[code] ??= {};
        for (const [rawKey, value] of Object.entries(table)) {
            if (rawKey === 'board_hours' || rawKey === 'boardHours') {
                if (nonNegative(value) === null) warnings.push(`Pace ${code}.${rawKey} is not a number of hours.`);
                else paces[code].boardHours = value;
                continue;
            }
            const key = normalizeMode(rawKey, { era: 'modern' });
            if (!key) {
                warnings.push(`Pace ${code}.${rawKey}: "${rawKey}" is not a modern mode (${MODERN_MODES.join(', ')}).`);
                continue;
            }
            const pace = readPace(value);
            if (pace === undefined || pace === 'foot') warnings.push(`Pace ${code}.${rawKey} is not a number, range or null.`);
            else if (pace === null) delete paces[code][key];
            else paces[code][key] = pace;
        }
    }
    return paces;
}

function readPlaces(source, errors) {
    const entries = Array.isArray(source)
        ? source.map(place => [place?.name, place])
        : isObject(source) ? Object.entries(source) : null;
    if (!entries) return null;
    const places = {};
    for (const [rawName, value] of entries) {
        const name = typeof rawName === 'string' ? rawName.trim() : '';
        if (!name) {
            errors.push('A place without a name was skipped.');
            continue;
        }
        const info = isObject(value) ? value : {};
        places[name] = {
            x: finite(info.x),
            y: finite(info.y),
            region: typeof info.region === 'string' ? info.region : null,
        };
    }
    return places;
}

// Returns the edge, or why it cannot be used.
function readEdge(raw) {
    if (!isObject(raw)) return 'not an object';
    const a = typeof raw.a === 'string' ? raw.a.trim() : '';
    const b = typeof raw.b === 'string' ? raw.b.trim() : '';
    if (!a || !b) return 'an endpoint is missing';
    if (a === b) return `"${a}" links to itself`;
    const km = positive(Number(raw.km));
    if (km === null) return `${a} – ${b} has no km`;
    const code = typeof raw.code === 'string' ? raw.code.trim().toUpperCase() : '';
    if (!code) return `${a} – ${b} has no road code`;
    if (!/^[A-Z]{1,3}$/.test(code)) return `${a} – ${b} has the road code "${raw.code}" (one to three letters)`;
    return {
        a, b, km, code,
        corridor: typeof raw.corridor === 'string' && raw.corridor.trim() ? raw.corridor.trim() : null,
        notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes : null,
        bearing: typeof raw.bearing === 'string' && raw.bearing.trim() ? raw.bearing.trim().toUpperCase() : null,
    };
}

// A pack made by hand or by a model can contradict itself (0.8.8): a road shorter than the
// straight line between its places, or a road's stated bearing ("SW/NE": b lies SW of a) that
// its coordinates do not give. Coordinates are read with y growing north; when the bearings
// fit y growing south instead, one warning says to set North is to Down.
const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const STRAIGHT_SLACK = 0.9;

function mapWarnings(places, edges, scale) {
    const warnings = [];
    const off = { up: [], down: [] };
    let stated = 0;
    for (const edge of edges) {
        const a = places[edge.a];
        const b = places[edge.b];
        if (![a?.x, a?.y, b?.x, b?.y].every(value => value !== null && value !== undefined)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (scale) {
            const straight = Math.hypot(dx, dy) * scale;
            if (edge.km < straight * STRAIGHT_SLACK) warnings.push(`${edge.a} – ${edge.b} is ${num(edge.km)} km, but the places are ${Math.round(straight)} km apart in a straight line.`);
        }
        const want = COMPASS_16.indexOf(String(edge.bearing ?? '').split('/')[0].trim());
        if (want < 0 || (dx === 0 && dy === 0)) continue;
        stated += 1;
        for (const north of ['up', 'down']) {
            const degrees = (Math.atan2(dx, north === 'up' ? dy : -dy) * 180 / Math.PI + 360) % 360;
            const gap = Math.abs(((degrees - want * 22.5) % 360 + 540) % 360 - 180);
            // Within one 8-point step (45°) agrees; coordinates are rounded and roads bend.
            if (gap > 45 + 1e-9) off[north].push({ edge, given: COMPASS_16[want], got: COMPASS_16[Math.round(degrees / 22.5) % 16] });
        }
    }
    if (stated && off.down.length < off.up.length && off.up.length > stated / 2) {
        warnings.unshift('The roads\' bearings fit a map whose y grows southwards (an image): set Map & travel → North is to Down.');
    } else {
        for (const { edge, given, got } of off.up) warnings.push(`${edge.a} – ${edge.b} says ${edge.b} lies ${given} of ${edge.a}, but the coordinates put it ${got}.`);
    }
    return warnings;
}

function readPaces(source, warnings) {
    const paces = {};
    if (!isObject(source)) return paces;
    for (const [rawCode, table] of Object.entries(source)) {
        const code = rawCode.trim().toUpperCase();
        paces[code] = {};
        if (!isObject(table)) continue;
        for (const [rawKey, value] of Object.entries(table)) {
            const key = PACE_ALIASES[rawKey] ?? rawKey;
            if (!PACE_KEYS.includes(key)) continue;   // notes, units
            const pace = readPace(value);
            if (pace === undefined) warnings.push(`Pace ${code}.${rawKey} is not a number, range, "foot" or null.`);
            else paces[code][key] = pace;
        }
    }
    return paces;
}

// number | [low, high] | 'foot' | null; undefined when unreadable.
function readPace(value) {
    if (value === null || value === 'foot') return value;
    if (positive(value) !== null) return value;
    if (Array.isArray(value) && value.length === 2 && value.every(n => positive(n) !== null)) {
        return [Math.min(...value), Math.max(...value)];
    }
    return undefined;
}

export function packSummary(pack) {
    if (!pack) return 'no world pack';
    const places = Object.keys(pack.places ?? {}).length;
    const routes = (pack.edges ?? []).length;
    return `${places} ${places === 1 ? 'place' : 'places'} · ${routes} ${routes === 1 ? 'route' : 'routes'}${pack.era === 'modern' ? ' · modern' : ''}`;
}
