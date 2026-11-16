import { applySync, planSync, syncPayload } from '../../../../modules/cast/cast/apply.js';
import { initialCast } from '../../../../modules/cast/cast/domain.js';
import { castOf, locator, partyPlace } from '../../../../modules/cast/cast/entries.js';
import { packWorld, worldOf } from '../../../../modules/atlas/atlas/world.js';
import { travelTime } from '../../../../modules/atlas/atlas/travel.js';
import { queries as atlasQueries } from '../../../../modules/atlas/atlas/queries.js';
import { keyOf as atlasKey } from '../../../../modules/atlas/atlas/domain.js';
import { entry } from './helpers.js';
export const castFor = (...entries) => castOf((name, args) => (name === 'packs.content' ? (args?.kind === 'cast' ? entries.map(item => structuredClone(item)) : []) : name === 'packs.list' ? [{ id: 'ersveil', name: 'Ersveil', version: '1.1.0', enabled: true }] : null));
export const HOUR = 60;
export const DAY = 1440;

export const SYNC_NOW = 7 * DAY;
export function synced(entries, mutate = () => {}) {
    const cast = castFor(...entries);
    const slice = initialCast();
    const plan = planSync(slice, cast, { now: SYNC_NOW });
    applySync(slice, syncPayload(plan), { now: SYNC_NOW, rev: 1 });
    mutate(slice);
    return { slice, cast };
}

export function crowd(specs, now) {
    const entries = specs.map(([id, place, routine, drawnTo = []]) => entry(id, { start: { place, goal: `${id} goal`, routine }, drawnTo }));
    const { slice, cast } = synced(entries);
    slice.day = [{ at: now, rev: 1 }];
    return { slice, cast };
}

export const refs = new Map([['fenna', 'ersveil:fenna'], ['sera', 'ersveil:sera'], ['brom', 'ersveil:brom']]);
export const allow = { come: new Set(['ersveil:sera']), die: new Set(['ersveil:brom']) };

export const MAP = {
    places: [{ name: 'Auvoth', region: 'North', kind: 'city', x: 0, y: 0 }, { name: 'Bluewatch Village', region: 'North', kind: 'town', x: 50, y: 0 }, { name: 'Shackles City', region: 'South', kind: 'city' }],
    routes: [{ from: 'Auvoth', to: 'Bluewatch Village', km: 400, kind: 'river' }],
};
export const mapWorld = worldOf({ places: {}, routes: {}, keys: {}, focus: null }, packWorld((name, { kind } = {}) => (name === 'packs.content' ? structuredClone(MAP[kind] ?? []) : undefined)));
// The atlas's trip in days (Shackles City has no route: unknown).
export const travel = (from, to) => travelTime(mapWorld, from, to)?.days ?? null;
export const BLUEWATCH = { place: 'Bluewatch Village / Guild Office', region: '' };
export const START = 316931440;

export function farWorld() {
    const entries = [
        entry('rika', { start: { place: 'Auvoth / Pale Market', goal: 'A Guild licence and a crew.', routine: '' }, drawnTo: ['Master Albrecht Somner', 'Church Inquest agents'] }),
        entry('ysmeth', { start: { place: 'Shackles City / Chainmarket', goal: 'Pay off the debt the Ledger holds her on.', routine: '' }, drawnTo: ['the Broken Chain', 'the River Council'] }),
        entry('temiwa', { start: { place: 'Bluewatch Village', goal: 'tend the dying', routine: '' }, drawnTo: ['the Ashen Veil'] }),
    ];
    const cast = castFor(...entries);
    const slice = initialCast();
    applySync(slice, syncPayload(planSync(slice, cast, { now: START })), { now: START, rev: 1 });
    for (const person of Object.values(slice.people)) person.since = START;
    return { slice, cast };
}
export const named = giver => ({ threads: [{ key: 'Errand', fields: { giver } }], items: [] });
export const keysOf = list => list.map(item => item.key.split(':')[1]);

export const ERSVEIL = {
    places: [
        { name: 'Bluewatch Village', region: 'River Confederacy: Bluewatch', kind: 'village', x: 64, y: 110 },
        { name: 'Bluewatch Village / Guild Office', region: 'River Confederacy: Bluewatch', kind: 'guild office', x: 64, y: 110 },
        { name: 'Auvoth', region: 'Auvoth Compact', kind: 'city', x: 59, y: 110 },
        { name: 'Auvoth / Pale Market', region: 'Auvoth Compact', kind: 'district', x: 59.4, y: 109.6 },
    ],
    routes: [{ from: 'Auvoth', to: 'Bluewatch Village', kind: 'frontier road', km: 70 }],
};
export const RUN_ATLAS = {
    places: {
        pl_dmu7s0ab: { id: 'pl_dmu7s0ab', name: 'Bluewatch Village / Guild Office', region: 'River Confederacy: Bluewatch', kind: 'guild office', layer: '', discovered: true, rev: 10 },
        pl_55i67iir: { id: 'pl_55i67iir', name: 'The Drowned Bell', region: 'bluewatch', kind: 'tavern', layer: '', discovered: true, rev: 22, made: 'sw_f43e3206a119' },
        pl_c57qz36z: { id: 'pl_c57qz36z', name: 'Bluewatch Village', region: 'River Confederacy: Bluewatch', kind: 'settlement', layer: '', discovered: true, rev: 37 },
        pl_yo7o67fj: { id: 'pl_yo7o67fj', name: 'Adventurers\' Guild back room', region: 'bluewatch', kind: 'settlement', layer: '', discovered: true, rev: 53, x: 64.266, y: 109.576, auto: true },
        pl_yz6zp4i3: { id: 'pl_yz6zp4i3', name: 'Wharf smithy', region: 'bluewatch', kind: 'settlement', layer: '', discovered: true, rev: 124, x: 63.972, y: 109.516, auto: true },
        pl_llyj22ck: { id: 'pl_llyj22ck', name: 'Drowned Bell taproom', region: 'bluewatch', kind: 'settlement', layer: '', discovered: true, rev: 140, x: 63.759, y: 109.371, auto: true },
    },
    keys: { 'bluewatch village / guild office': 'pl_dmu7s0ab', 'the drowned bell': 'pl_55i67iir', 'bluewatch village': 'pl_c57qz36z', 'adventurers guild back room': 'pl_yo7o67fj', 'wharf smithy': 'pl_yz6zp4i3', 'drowned bell taproom': 'pl_llyj22ck' },
    placeRefs: { pl_dmu7s0ab: 'pack.ersveil/bluewatch-village-guild-office', pl_55i67iir: 'pl_55i67iir', pl_c57qz36z: 'pack.ersveil/bluewatch-village', pl_yo7o67fj: 'pl_yo7o67fj', pl_yz6zp4i3: 'pl_yz6zp4i3', pl_llyj22ck: 'pl_llyj22ck' },
    routes: {}, tripRest: true, focus: null,
};
export const runWorld = worldOf(structuredClone(RUN_ATLAS), packWorld((name, { kind } = {}) => (name === 'packs.content' ? structuredClone(ERSVEIL[kind] ?? []) : undefined)));
export const runTrip = (from, to) => travelTime(runWorld, from, to);
// What rule 1 read (entries.js travelOf: the atlas's days, whatever their source) and what rule 2 reads (roadsOf: road trips only).
export const anyTrip = (from, to) => runTrip(from, to)?.days ?? null;
export const roadTrip = (from, to) => (runTrip(from, to)?.source === 'routes' ? runTrip(from, to).days : null);
// Reply 14: the clock 1730 minutes after the first reply, the party in the taproom (atlas.here: the place, region "bluewatch", no town).
export const REPLY14 = 316933170;
export const TAPROOM = { place: 'Drowned Bell taproom', region: 'bluewatch', town: '' };
export const GUILD = { place: 'Bluewatch Village / Guild Office', region: 'River Confederacy: Bluewatch', town: 'Bluewatch Village' };

export function runCast() {
    const cast = castFor(
        entry('rika', { start: { place: 'Auvoth / Pale Market', goal: 'A Guild licence and a crew.', routine: '' }, drawnTo: ['Master Albrecht Somner'] }),
        entry('torka', { start: { place: 'Bluewatch Village', goal: 'a good fight', routine: '' }, drawnTo: ['a good fight'] }),
        entry('ysmeth', { start: { place: 'Shackles City / Chainmarket', goal: 'Pay off the debt.', routine: '' }, drawnTo: ['the Broken Chain'] }),
    );
    const slice = initialCast();
    applySync(slice, syncPayload(planSync(slice, cast, { now: START })), { now: START, rev: 1 });
    // As stored at reply 14: everyone placed at the first minute, the cast's day moved to the clock with the first minute kept.
    for (const person of Object.values(slice.people)) person.since = START;
    slice.day = [{ at: REPLY14, rev: 158, first: START }];
    return { slice, cast };
}

export const RUN_PACK = { ...ERSVEIL, places: ERSVEIL.places.map(place => (place.name === 'Bluewatch Village' ? { ...place, aliases: ['Bluewatch'] } : place)) };
export const queryOver = (atlas, pack) => {
    const state = { domains: { atlas: structuredClone(atlas) } };
    const tools = { query: (asked, { kind } = {}) => (asked === 'packs.content' ? structuredClone(pack[kind] ?? []) : undefined) };
    return (name, args) => atlasQueries[name]?.(state, args, tools);
};
export const atlasOf = (places, base = { places: {}, keys: {} }) => ({
    ...structuredClone(base), routes: {}, tripRest: true, focus: null,
    places: { ...structuredClone(base.places), ...Object.fromEntries(places.map((place, at) => [`pl_t${at}`, { id: `pl_t${at}`, layer: '', discovered: true, rev: 500 + at, ...place }])) },
    keys: { ...base.keys, ...Object.fromEntries(places.map((place, at) => [atlasKey(place.name), `pl_t${at}`])) },
});
export const RUN_QUERY = queryOver(RUN_ATLAS, RUN_PACK);
export const located = (party, query = RUN_QUERY) => ({ ...party, locate: locator(query) });
export const LOCATED_TAPROOM = located(TAPROOM);
export const LOCATED_GUILD = located(GUILD);
// The run's own places as if the atlas had saved them a parent, the village (atlas `parent`, as parent.js saves it); in the run it saved none.
export const LINKED = ['pl_yo7o67fj', 'pl_yz6zp4i3', 'pl_llyj22ck'];
export const LINKED_ATLAS = { ...structuredClone(RUN_ATLAS), places: Object.fromEntries(Object.entries(RUN_ATLAS.places).map(([id, place]) => [id, LINKED.includes(id) ? { ...place, parent: 'pl_c57qz36z' } : place])) };
export const LINKED_QUERY = queryOver(LINKED_ATLAS, RUN_PACK);
export const linked = party => located(party, LINKED_QUERY);
export const LINKED_TAPROOM = linked(TAPROOM);

export function partyOf(query, place) {
    const here = query('atlas.place', { name: place });
    return partyPlace((name, args) => (name === 'atlas.here' ? { name: here?.name ?? place, line: query('atlas.line', { name: place }), kind: here?.kind ?? '', placeKind: here?.kind ?? '', region: here?.region ?? '' } : query(name, args)), {});
}
