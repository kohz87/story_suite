// Resolves road code names, inferred modes, travel paces, and accepted pace ranges.

import { DEFAULT_COURIER_MULTIPLIER, LAND_MODES, MODERN_CODES, MODERN_DEFAULT_MODE, ROUTE_CODES, WATER_MODES, normalizeMode, normalizeName } from '../pack.js';

/** What a road code is called ("bastion road", "railway"). */
export function codeName(pack, code) {
    if (pack?.era === 'modern') return MODERN_CODES[code]?.name ?? 'road';
    return ROUTE_CODES[code] ?? 'road';
}

// The mode a leg most likely means when it names only a road code.
export function inferMode(code, pack = null) {
    if (pack?.era === 'modern') {
        return MODERN_DEFAULT_MODE[code] ?? Object.keys(pack.paces?.[code] ?? {})[0] ?? 'foot';
    }
    if (code === 'W') return 'boat';
    if (code === 'S' || code === 'D') return 'ship';
    if (code === 'A') return 'flight';
    return 'foot';
}

function toPace(value) {
    if (typeof value === 'number') return { rate: value, low: value, high: value };
    if (Array.isArray(value)) return { rate: (value[0] + value[1]) / 2, low: value[0], high: value[1] };
    return null;
}

function hasLevee(pack, corridor) {
    if (!corridor) return false;
    const key = normalizeName(corridor);
    const listed = list => (list ?? []).some(name => normalizeName(name) === key);
    // A corridor in both lists has no levee: noLevee is the explicit exception.
    return listed(pack.rules?.leveeRoads) && !listed(pack.rules?.noLevee);
}

function landPace(pack, code, mode) {
    const table = pack.paces?.[code];
    const hasLand = table && LAND_MODES.some(name => table[name] !== undefined);
    // Codes with no land paces (L, G, unknown) go at R pace.
    if (!hasLand) return code === 'R' ? null : landPace(pack, 'R', mode);
    // A land mode the table leaves out goes at the code's foot pace.
    let value = table[mode] === undefined ? 'foot' : table[mode];
    if (value === 'foot') value = table.foot;
    return toPace(value);
}

/**
 * Km per day for `mode` on road `code`, `{ rate, low, high }` (rate = midpoint of a range),
 * or null when the mode cannot use the road. W is boat only, except along a levee road
 * (R pace); S is ship; D is ship or boat at vessel pace; A is flight.
 */
export function paceFor(pack, code, mode, { corridor = null } = {}) {
    const name = normalizeMode(mode, pack);
    if (!pack || !name) return null;
    const key = String(code ?? '').trim().toUpperCase();
    // Modern: the code's own table, km an hour; a mode it leaves out cannot use it.
    if (pack.era === 'modern') return toPace(pack.paces?.[key]?.[name]);

    if (name === 'courier') {
        const ride = paceFor(pack, key, 'ride', { corridor });
        const k = pack.courierMultiplier ?? DEFAULT_COURIER_MULTIPLIER;
        return ride && { rate: ride.rate * k, low: ride.low * k, high: ride.high * k };
    }
    const table = pack.paces?.[key] ?? {};
    if (key === 'W') {
        if (name === 'boat') return toPace(table.boat);
        return LAND_MODES.includes(name) && hasLevee(pack, corridor) ? landPace(pack, 'R', name) : null;
    }
    if (key === 'S') return name === 'ship' ? toPace(table.ship) : null;
    if (key === 'D') return WATER_MODES.includes(name) ? toPace(table.vessel) : null;
    if (key === 'A') return name === 'flight' ? toPace(table.flight) : null;
    return LAND_MODES.includes(name) ? landPace(pack, key, name) : null;
}

// The rates a stated pace may use: the pace's range, and on a river also the upstream and
// downstream ranges (direction is not in the data).
export function acceptedRange(pack, edge, mode) {
    const pace = paceFor(pack, edge.code, mode, { corridor: edge.corridor });
    if (!pace) return null;
    if (mode !== 'boat' || edge.code !== 'W') return pace;
    const ranges = ['boat', 'upstream', 'downstream'].map(key => toPace(pack.paces?.W?.[key])).filter(Boolean);
    return {
        ...pace,
        low: Math.min(...ranges.map(range => range.low)),
        high: Math.max(...ranges.map(range => range.high)),
    };
}
