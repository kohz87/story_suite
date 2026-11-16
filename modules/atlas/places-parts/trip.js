// Story Director: coordinate-based travel time estimation and trip formatting.

import { DEFAULT_RULES, MODERN_RULES, durationText, legDays, overnights, restDaysFor } from '../routes.js';
import { DEFAULT_MAP, DEFAULT_PACES, MODERN_PACES, mapSettings } from './settings.js';
import { bearing, distanceKm } from './geometry.js';

const MODERN_BOARD_HOURS = { train: 0.25, ferry: 0.5, ship: 1, plane: 2 };
const STRAIGHT_MODES = ['boat', 'ship', 'flight', 'ferry', 'plane'];

/**
 * A trip estimated from coordinates: { from, to, straightKm, roadKm, mode, rate, days,
 * restDays, unit, stops, direction } or null without coordinates. Road km is the straight
 * line times the road factor; days round up like a road (to the half day) and add a rest day
 * after every six days on land, except for couriers. A modern map (`map.era`) counts in km an
 * hour to the quarter hour, adds boarding, and stops for the night on long drives.
 */
export function estimateTrip(from, to, { map = DEFAULT_MAP, mode = 'foot', rate = null, rules = null } = {}) {
    const straightKm = distanceKm(from, to, map);
    if (straightKm === null) return null;
    const settings = mapSettings(map);
    const modern = settings.era === 'modern';
    const paces = modern ? MODERN_PACES : DEFAULT_PACES;
    const travel = Object.hasOwn(paces, mode) ? mode : modern && mode === 'flight' ? 'plane' : 'foot';
    const pace = rate > 0 ? rate : paces[travel];
    const use = modern ? (rules?.unit === 'hour' ? rules : MODERN_RULES) : (rules?.unit === 'hour' ? DEFAULT_RULES : rules ?? DEFAULT_RULES);
    // Water and air go straight; roads wind.
    const winding = STRAIGHT_MODES.includes(travel) ? 1 : settings.roadFactor;
    const roadKm = straightKm * winding;
    const board = modern ? (MODERN_BOARD_HOURS[travel] ?? 0) / 24 : 0;
    const active = (legDays(roadKm, pace, use) ?? 0) + board;
    const restDays = restDaysFor(travel, active, use);
    return {
        from, to, straightKm, roadKm, mode: travel, rate: pace, days: active + restDays, restDays,
        unit: modern ? 'hour' : 'day', stops: modern ? overnights(travel, active, use) : 0, direction: bearing(from, to, map),
    };
}

const round = (value, digits = 0) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

/** "Shorn → Auvoth ≈ 176 km NE (≈ 141 km straight × 1.25) · foot 20/day · 9.5 days (1 rest)". */
export function formatTrip(trip, { map = DEFAULT_MAP } = {}) {
    if (!trip) return '';
    const settings = mapSettings(map);
    const straight = STRAIGHT_MODES.includes(trip.mode);
    const distance = straight
        ? `${round(trip.straightKm)} km ${trip.direction}`.trim()
        : `≈ ${round(trip.roadKm)} km ${trip.direction} (≈ ${round(trip.straightKm)} km straight × ${settings.roadFactor})`.replace(/ {2,}/g, ' ');
    if (trip.unit === 'hour') {
        const nights = trip.stops ? ` (${trip.stops} ${trip.stops === 1 ? 'night' : 'nights'} on the way)` : '';
        return `${trip.from.name} → ${trip.to.name} ${distance} · ${trip.mode} ${round(trip.rate, 1)} km/h · ${durationText(trip.days, 'hour')}${nights}`;
    }
    const rest = trip.restDays ? ` (${trip.restDays} rest)` : '';
    return `${trip.from.name} → ${trip.to.name} ${distance} · ${trip.mode} ${round(trip.rate, 1)}/day · ${trip.days} ${trip.days === 1 ? 'day' : 'days'}${rest}`;
}
