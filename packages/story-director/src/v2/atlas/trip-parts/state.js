// Reads the current trip record and computes party position along its legs.

import { isRecord } from '../domain.js';
import { KEY } from '../trip-shape.js';
import { isInt } from './shared-constants.js';
import { entryOrder } from '../../reply-keys.js';

// The records' order: by story time, then revision, then the key's count (reply-keys.js), never by key: a key names the reply.
const byRecord = entryOrder(record => [record?.at, record?.rev]);
const order = (a, b) => byRecord([a.key, a.record], [b.key, b.record]);

// The records in order and the newest go among them (null when none).
function readTrips(atlas) {
    const entries = Object.entries(isRecord(atlas?.trips) ? atlas.trips : {}).filter(([key, record]) => KEY.test(key) && isRecord(record))
        .map(([key, record]) => ({ key, record })).sort(order);
    const goes = entries.filter(entry => entry.record.kind === 'go' && Array.isArray(entry.record.legs) && entry.record.legs.length);
    return { entries, go: goes.at(-1) ?? null };
}

/** The key of the trip's `go` record (the one tripOf reads), or null: a delay names it (`go`), trip-capture.js. */
export const goKeyOf = atlas => readTrips(atlas).go?.key ?? null;

/**
 * The trip as it stands: the newest `go` record with the delays after it applied, or null. `{ to, by, mode, pace, unit, mount, short,
 * setOut, legs, delays }`; each leg has `holds` (`[{ at, minutes }]`, a delay that stopped it on the road) with its `arrive` moved. A
 * delay moves every arrival still ahead of it: the leg being travelled is held where it is, the later ones start later.
 */
export function tripOf(atlas) {
    const { entries, go } = readTrips(atlas);
    if (!go) return null;
    const trip = {
        ...structuredClone({ to: go.record.to, by: go.record.by, mode: go.record.mode, pace: go.record.pace, unit: go.record.unit, mount: go.record.mount, short: go.record.short, setOut: go.record.setOut }),
        legs: structuredClone(go.record.legs).map(leg => ({ ...leg, holds: [] })),
        delays: [],
    };
    // A delay written while an earlier hold still runs waits for it: its hold starts where that one ends, so the holds never overlap and
    // the party is held for the sum of the delays (the arrivals have always moved by that sum).
    // A delay names the go it delays (`go`, its key): that key stays when the go's reply is Re-read with more lines (a go is always
    // its reply's first record, `<sid>.0`), where its revision moves past a later reply's stored delay's; and a delay an edited
    // reply left behind for another trip never delays this one. A delay from an older state (no `go`) counts when it sorts after the go.
    const ours = item => (typeof item.record.go === 'string' ? item.record.go === go.key : order(go, item) < 0);
    let heldUntil = -Infinity;
    for (const entry of entries.filter(item => item.record.kind === 'delay' && ours(item))) {
        const { minutes, because } = entry.record;
        if (!isInt(minutes) || minutes < 1 || entry.record.at >= trip.legs.at(-1).arrive) continue;
        const at = Math.max(entry.record.at, heldUntil);
        for (const leg of trip.legs) {
            if (leg.arrive <= at) continue;
            if (leg.start <= at) {
                leg.holds.push({ at, minutes });
                heldUntil = at + minutes;
            } else leg.start += minutes;
            leg.arrive += minutes;
        }
        trip.delays.push({ minutes, because: typeof because === 'string' ? because : '' });
    }
    return trip;
}

/**
 * Where the party is at story minute `now`: `{ index, leg, along, of, fraction, node, mid, arrived }`. `index` and `leg` the leg being
 * travelled (or, once arrived, the last); `along` the km down its road (`of` long) counted from the road's end behind the traveller,
 * `fraction` the share of the leg's own travel done, `node` the place name when the party stands at a place (before setting out
 * on a leg, between two, or arrived), `mid` whether it is somewhere between two places, `arrived` whether the last leg is over.
 */
export function positionOf(trip, now) {
    const legs = trip.legs;
    const last = legs.length - 1;
    if (now >= legs[last].arrive) return { index: last, leg: legs[last], along: legs[last].km, of: legs[last].km, fraction: 1, node: legs[last].to, mid: false, arrived: true };
    const index = legs.findIndex(leg => now < leg.arrive);
    const leg = legs[index];
    const skip = leg.skip ?? 0;
    if (now < leg.start) return { index, leg, along: skip, of: leg.km, fraction: 0, node: skip ? null : leg.from, mid: skip > 0, arrived: false };
    const holds = Array.isArray(leg.holds) ? leg.holds : [];
    let held = 0;
    for (const hold of holds) held += Math.max(0, Math.min(now, hold.at + hold.minutes) - Math.max(leg.start, hold.at));
    const heldAll = holds.reduce((sum, hold) => sum + hold.minutes, 0);
    const travel = leg.arrive - leg.start - heldAll;
    const fraction = travel > 0 ? Math.min(1, Math.max(0, (now - leg.start - held) / travel)) : 1;
    const along = Math.min(leg.km, Math.max(0, Math.round(skip + (leg.km - skip) * fraction)));
    const atEnd = along >= leg.km;
    const atStart = along <= 0;
    return { index, leg, along, of: leg.km, fraction, node: atStart ? leg.from : atEnd ? leg.to : null, mid: !atStart && !atEnd, arrived: false };
}

/** Every place the trip names: where it started, each stop, and where it ends. */
export const nodesOf = trip => [...new Set(trip.legs.flatMap(leg => [leg.from, leg.to]))];
