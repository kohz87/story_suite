import assert from 'node:assert/strict';

import { PRESETS, makeCalendar } from '../../../src/calendar.js';
import { atlasMapWidget, forgetViews } from '../../../src/v2/atlas/widget.js';
import { installFakeDom } from '../../ui-fake-dom.js';
import { at, command, deepFreeze, line, makeState, query } from './helpers/fake-ctx.js';

// The screenshot's knot (Ersveil's Bluewatch Village: places a hundredth of a unit apart) inside a
// wider world, a hidden cellar, and a town on another layer.
export const PACK = {
    places: [
        { name: 'Bluewatch Village', region: 'Core Cities', kind: 'settlement', x: 64, y: 110 },
        { name: 'Inspection Quay', region: 'Bluewatch Village', kind: 'quay', x: 64.0, y: 109.99, aliases: ['the quay'] },
        { name: 'Watch Granary', region: 'Bluewatch Village', kind: 'storehouse', x: 64.02, y: 109.99, aliases: ['the granary'] },
        { name: 'Watchhouse', region: 'Bluewatch Village', kind: 'watch-fort', x: 64.01, y: 110.02 },
        { name: 'Stray Oar', region: 'Bluewatch Village', kind: 'inn', x: 63.99, y: 110.0 },
        { name: 'Reedmere', region: 'Locks', kind: 'town', x: 50, y: 90 },
        { name: 'Coinwater', region: 'Core Cities', kind: 'city', x: 40, y: 100 },
        { name: 'Smugglers Cellar', region: 'Bluewatch Village', kind: 'cellar', x: 64.015, y: 110.015, hidden: true },
        { name: 'Deep Vault', region: 'Bluewatch Village', layer: 'underground', kind: 'vault', x: 64, y: 110 },
    ],
    routes: [
        { from: 'Bluewatch Village', to: 'Inspection Quay', kind: 'street', km: 0.2, hours: 0.1 },
        { from: 'Bluewatch Village', to: 'Reedmere', kind: 'river', km: 90 },
        { from: 'Coinwater', to: 'Reedmere', kind: 'river', km: 60 },
        { from: 'Bluewatch Village', to: 'Smugglers Cellar', kind: 'stair', km: 0.1 },
    ],
};

export function story() {
    let state = makeState({ place: 'Bluewatch Village', kind: 'settlement', region: 'River Confederacy' });
    state = command(state, 'atlas.visit', { name: 'Bluewatch Village', kind: 'settlement', region: 'River Confederacy' }, { pack: PACK }).state;
    state = command(at(state, 'Inspection Quay'), 'atlas.visit', { name: 'Inspection Quay' }, { pack: PACK }).state;
    return at(state, 'Bluewatch Village', { kind: 'settlement', region: 'River Confederacy' });
}

export function draw({ state = story(), props = {}, api = null, win = null, value } = {}) {
    forgetViews();
    const doc = installFakeDom();
    if (win) doc.defaultView = win;
    const el = doc.createElement('div');
    doc.body.appendChild(el);
    const queries = [];
    const theApi = api ?? { query: (name, args) => { queries.push({ name, args }); return query(state, name, args, { pack: PACK }); } };
    const data = value === undefined ? query(state, 'atlas.view', {}, { pack: PACK }) : value;
    const handle = atlasMapWidget.render(el, { value: data, label: 'Map', ...props }, theApi);
    const root = el.querySelector('.sd-map');
    const stage = root.querySelector('.sd-map-stage');
    const $ = selector => root.querySelector(selector);
    const $$ = selector => root.querySelectorAll(selector);
    const key = name => stage.dispatch('keydown', { key: name });
    const pointer = (type, id, x, y, extra = {}) => stage.dispatch(type, { pointerId: id, clientX: x, clientY: y, pointerType: 'touch', ...extra });
    const shownLabels = () => $$('.sd-map-label').filter(label => !label.hidden).map(label => label.textContent);
    return { doc, el, root, stage, handle, $, $$, key, pointer, shownLabels, queries, state, data };
}

// Story Block's phone line (a narrow screen or a coarse pointer): the dots' 44px tap areas and the nearest-dot tap.
export const PHONE_LINE = '(pointer: coarse)';
export const placeButton = (root, name) => root.querySelectorAll('.sd-map-place').find(node => node.getAttribute('title') === name);
// The Region list: its choices, the chosen one's name, and a choice made (as the browser does: the value, then a change event).
export const regionNames = root => root.querySelectorAll('.sd-map-region option').map(option => option.textContent);
export const regionShown = root => {
    const select = root.querySelector('.sd-map-region select');
    return select.querySelectorAll('option').find(option => option.getAttribute('value') === select.value)?.textContent;
};
export function chooseRegion(root, value) {
    const select = root.querySelector('.sd-map-region select');
    select.value = value;
    select.dispatch('change');
}

// A dense cluster: three places a few pixels apart at the fit zoom, with a far one so the fit stays small.
export const CLUSTER = {
    places: [
        { name: 'Alpha', region: 'Dense', kind: 'town', x: 0, y: 0 },
        { name: 'Bravo', region: 'Dense', kind: 'town', x: 12, y: 0 },
        { name: 'Charlie', region: 'Dense', kind: 'inn', x: 6, y: 6 },
        { name: 'Far Away', region: 'Dense', kind: 'city', x: 400, y: 0 },
    ],
    routes: [],
};

export function clusterDraw(win) {
    const state = makeState({ place: 'Alpha', kind: 'town', region: 'Dense' });
    return draw({ state, win, value: query(state, 'atlas.view', {}, { pack: CLUSTER }) });
}

const GREGORIAN = makeCalendar(PRESETS.gregorian);
export const TRIP_T0 = GREGORIAN.toAbs({ year: 1200, month: 2, day: 3, minutes: 8 * 60 });
export const TRIP_DAY = 1440;

// Bluewatch Village → Reedmere (90 km by river) → Coinwater (60 km), set out March 3; `days` later, with a courier on the first road.
export function tripDraw({ days = 1, place = 'Bluewatch Village', props = {}, withMover = true } = {}) {
    const first = line(story(), '~ trip Coinwater | by: foot', { pack: PACK, time: TRIP_T0 });
    assert.ok(first.ok, first.message);
    const threads = withMover ? {
        th_courier: {
            id: 'th_courier', key: 'Guild courier', kind: 'event', status: 'active', summary: 'news of the Seal tremor',
            fields: { leg: 'Reedmere → Bluewatch Village', arrive: 'March 9' }, track: { legSince: { turn: 1, time: TRIP_T0 } },
        },
    } : {};
    const state = deepFreeze({
        ...first.state,
        domains: { ...first.state.domains, scene: { place: { name: place, kind: '', region: '' }, present: [] }, director: { time: { minutes: TRIP_T0 + days * TRIP_DAY }, threads } },
    });
    const trip = query(state, 'atlas.trip', {}, { pack: PACK });
    return { ...draw({ state, props: { trip, ...props } }), trip };
}
