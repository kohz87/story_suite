import { readFileSync } from 'node:fs';
import { loadWorldPack, parseLeg, validateLeg } from '../../modules/atlas/routes.js';
import { makeCalendar } from '../../modules/time/calendar.js';

export const FIXTURE = readFileSync(new URL('../fixtures/director/world-pack.json', import.meta.url), 'utf8');
export const { pack } = loadWorldPack(FIXTURE);

export const cal = makeCalendar({
    era: 'CY',
    daysPerMonth: 30,
    months: ['Dawnwane', 'Rainmoot', 'Greengale', 'Highsun', 'Goldwane', 'Haywane', 'Emberwane',
        'Nightfall', 'Frostfall', 'Deepwinter', 'Icewane', 'Yearsend'],
});
export const at = text => cal.parse(text).abs;

export const hopsText = route => route.hops.map(hop => `${hop.to} ${hop.km} ${hop.code}`);
export const kinds = findings => findings.map(f => f.kind);
export const check = (text, options = {}) => validateLeg(pack, parseLeg(pack, text), { calendar: cal, ...options });

// A tiny pack for the codes the fixture does not have.
export function tinyPack() {
    return loadWorldPack({
        places: { Ash: {}, Birch: {}, Cedar: {}, Dell: {}, Elm: {} },
        pace_km_per_day: {
            R: { foot: 24, ride: 40, wagon: 22 },
            T: { foot: [14, 22], ride: 'foot', wagon: null },
            M: { foot: [12, 20], ride: 'foot', wagon: null },
            U: { foot: [12, 20], ride: 'foot', wagon: null },
            H: { foot: [8, 15], ride: 'foot', wagon: null },
        },
        edges: [
            { a: 'Ash', b: 'Birch', km: 30, code: 'T' },
            { a: 'Ash', b: 'Cedar', km: 50, code: 'R' },
            { a: 'Cedar', b: 'Birch', km: 40, code: 'R' },
            { a: 'Birch', b: 'Dell', km: 20, code: 'M' },
            { a: 'Dell', b: 'Elm', km: 20, code: 'U' },
        ],
    }).pack;
}
