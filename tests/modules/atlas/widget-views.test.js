import test from 'node:test';
import assert from 'node:assert/strict';

import { atlasMapWidget, forgetViews, onLayer, readView } from '../../../modules/atlas/atlas/widget.js';
import { iconFor } from '../../../modules/atlas/atlas/map.js';
import { installFakeDom } from '../../helpers/director/ui-fake-dom.js';
import { PACK, chooseRegion, draw, placeButton, regionNames, story } from './widget.helpers.js';
import { at, command, query } from './helpers/fake-ctx.js';
test('updated selection commands stay live, keep the API receiver and remove listeners on destroy', () => {
    forgetViews();
    const state = story();
    const data = query(state, 'atlas.view', {}, { pack: PACK });
    const doc = installFakeDom();
    const added = [];
    const removed = [];
    doc.addEventListener = (...args) => added.push(args);
    doc.removeEventListener = (...args) => removed.push(args);
    const el = doc.createElement('div');
    doc.body.appendChild(el);
    const calls = [];
    const api = {
        query(name, args) {
            calls.push(['query', name, args.id, this === api]);
            return query(state, name, args, { pack: PACK });
        },
        command(name, args) { calls.push(['command', name, args.node, this === api]); },
    };
    const handle = atlasMapWidget.render(el, { value: data, onSelect: 'atlas.first' }, api);
    const root = el.querySelector('.sd-map');
    chooseRegion(root, 'all');
    let coin = placeButton(root, 'Coinwater');
    const id = coin.getAttribute('data-id');
    coin.click();
    assert.deepEqual(calls, [['query', 'atlas.place', id, true], ['command', 'atlas.first', id, true]]);

    handle.update({ value: data, onSelect: 'atlas.second' });
    calls.length = 0;
    coin = placeButton(root, 'Coinwater');
    coin.click();
    assert.deepEqual(calls, [['query', 'atlas.place', id, true], ['command', 'atlas.second', id, true]]);

    handle.update({ value: data, onSelect: '' });
    calls.length = 0;
    coin = placeButton(root, 'Coinwater');
    coin.click();
    assert.deepEqual(calls, [['query', 'atlas.place', id, true]]);
    const stage = root.querySelector('.sd-map-stage');
    const listening = root.descendants().filter(node => node.listeners.length);
    const before = handle.state.view;
    handle.destroy();
    assert.ok(listening.every(node => node.listeners.length === 0));
    assert.deepEqual(removed, added);
    calls.length = 0;
    coin.click();
    stage.dispatch('wheel', { deltaY: -200, clientX: 100, clientY: 100 });
    assert.deepEqual(calls, []);
    assert.deepEqual(handle.state.view, before);
});

test('destroy after search and pick leaves no listener on doc/win', () => {
    const added = [];
    const removed = [];
    const win = {
        addEventListener: (...args) => added.push(['win', ...args]),
        removeEventListener: (...args) => removed.push(['win', ...args]),
        matchMedia: () => ({ matches: false }),
    };
    forgetViews();
    const doc = installFakeDom();
    doc.defaultView = win;
    doc.addEventListener = (...args) => added.push(['doc', ...args]);
    doc.removeEventListener = (...args) => removed.push(['doc', ...args]);
    const el = doc.createElement('div');
    doc.body.appendChild(el);
    const state = story();
    const api = { query: (name, args) => query(state, name, args, { pack: PACK }) };
    const handle = atlasMapWidget.render(el, { value: query(state, 'atlas.view', {}, { pack: PACK }) }, api);
    const root = el.querySelector('.sd-map');
    const input = root.querySelector('.sd-map-search input');
    input.value = 'granery';
    input.dispatch('input');
    root.querySelectorAll('.sd-map-result')[0].click();
    assert.ok(handle.state.picked, 'a place was picked');
    root.querySelector('.sd-map-stage').dispatch('wheel', { deltaY: -200, clientX: 100, clientY: 100 });
    handle.destroy();
    const left = added.filter(entry => !removed.some(gone => gone.length === entry.length && gone.every((part, n) => part === entry[n])));
    assert.ok(added.length > 0, 'doc or win listeners were added');
    assert.deepEqual(left, [], 'every listener added on doc or win was removed');
});

test('reduced motion: moves jump; otherwise they ease over animation frames to the same place', () => {
    const frames = [];
    const motion = { matches: false };
    const win = {
        requestAnimationFrame: fn => frames.push(fn),
        cancelAnimationFrame: () => {},
        matchMedia: query => (query.includes('reduced-motion') ? motion : { matches: false }),
    };
    const eased = draw({ win });
    eased.$('.sd-map-me').click();
    assert.ok(frames.length > 0, 'an eased move asks for frames');
    for (let time = 0, guard = 0; frames.length && guard < 100; guard += 1, time += 50) frames.shift()(time);
    const target = eased.handle.state.view;
    motion.matches = true;
    frames.length = 0;
    const still = draw({ win });
    still.$('.sd-map-me').click();
    assert.equal(frames.length, 0, 'no frames under reduced motion');
    assert.deepEqual(still.handle.state.view, target, 'the same place, reached at once');
});

test('the view is the reader\'s: kept per layer while the page lives, kept across state updates, never in the state', () => {
    const state = story();
    const first = draw({ state });
    first.key('+');
    first.key('ArrowRight');
    const mine = first.handle.state.view;
    // Another layer and back: each keeps its own view.
    chooseRegion(first.root, 'all');
    assert.notDeepEqual(first.handle.state.view, mine);
    chooseRegion(first.root, 'region:core cities');
    assert.deepEqual(first.handle.state.view, mine);
    // A state update (the story visits the granary) keeps the layer, pan and zoom.
    const next = command(at(state, 'Watch Granary'), 'atlas.visit', { name: 'Watch Granary' }, { pack: PACK }).state;
    first.handle.update({ value: query(next, 'atlas.view', {}, { pack: PACK }), label: 'Map' });
    assert.equal(first.handle.state.layer, 'region:core cities');
    assert.ok(Math.abs(first.handle.state.view.k - mine.k) < 1e-9);
    assert.ok(Math.abs(first.handle.state.view.cx - mine.cx) < 1e-9);
    // The granary (now where you are) is on its own region's layer: no ring on this one.
    assert.equal(first.root.querySelector('.sd-map-place[aria-current="location"]'), null);
    assert.equal(first.root.querySelector('.sd-map-here').hidden, true);
    // Nothing of it reached the story state.
    assert.deepEqual(next.domains.atlas.focus, null);
    assert.deepEqual(state.domains.atlas.focus, null);
    // Destroyed and drawn again on this page: the same view comes back (forgetViews runs in draw(), so redo by hand).
    const doc = first.doc;
    first.handle.destroy();
    assert.equal(first.el.querySelector('.sd-map'), null);
    const el = doc.createElement('div');
    const again = atlasMapWidget.render(el, { value: query(state, 'atlas.view', {}, { pack: PACK }) }, {});
    assert.equal(again.state.layer, 'region:core cities');
    assert.ok(Math.abs(again.state.view.k - mine.k) < 1e-9);
    const other = atlasMapWidget.render(el, { value: query(state, 'atlas.view', {}, { pack: PACK }), viewKey: 'elsewhere' }, {});
    assert.notDeepEqual(other.state.view, mine);
});

test('odd data: nothing, junk, duplicates, missing coordinates, dangling routes, a current place not drawn', () => {
    // Nothing usable: drawn without a throw, as an empty map with its note.
    for (const value of [null, [], 'map', 7, {}, { places: 'x', routes: 3, layers: {}, current: 9 }]) {
        const { $, handle } = draw({ value });
        assert.ok(handle, String(value));
        assert.equal($('.sd-map-empty').hidden, false);
    }
    const empty = draw({ value: { places: [] } });
    assert.equal(empty.$('.sd-map-empty').hidden, false);
    assert.equal(empty.$('.sd-map-stage').hidden, true);
    assert.equal(empty.$('.sd-map-region').hidden, true);
    empty.$('.sd-map-me').click();
    empty.key('+');
    const odd = draw({
        value: {
            places: [
                { id: 'a', name: 'Alpha', x: 0, y: 0, visited: true }, { id: 'a', name: 'Alpha again', x: 9, y: 9 },
                { id: '', name: 'No id' }, null, 5, { id: 'b', name: '', x: NaN, y: 3 }, { id: 'c', name: 'Gamma', x: 'far', y: null },
                { id: 'd', name: 'Delta', x: 0, y: 0, visited: true, icon: 'javascript:alert(1)' },
            ],
            routes: [{ from: 'a', to: 'b' }, { from: 'a', to: 'zz' }, { from: 'a', to: 'a' }, null],
            layers: [{ id: 'region:ghost', name: 'Ghost' }, { id: '' }],
            current: 'nowhere',
            layer: 'region:ghost',
            orient: 'sideways',
        },
    });
    assert.deepEqual(odd.$$('.sd-map-place').map(node => node.getAttribute('title')), ['Alpha', 'b', 'Gamma', 'Delta']);
    assert.deepEqual(regionNames(odd.root), ['All']);
    assert.equal(odd.$('.sd-map-region').hidden, true, 'no region with places: no list');
    assert.equal(odd.$('.sd-map-here').hidden, true);
    assert.equal(odd.$$('.sd-map-route').length, 1);
    assert.match(odd.$$('.sd-map-place i').at(-1).className, /fa-location-dot/, 'an unsafe icon falls back');
    // Two places on one spot, everything zoomable and pannable without a NaN anywhere.
    odd.key('+');
    odd.key('ArrowDown');
    odd.$('.sd-map-me').click();
    for (const value of Object.values(odd.handle.state.view)) assert.ok(Number.isFinite(value));
    for (const node of odd.$$('.sd-map-place')) assert.doesNotMatch(node.style.left, /NaN/);
    // readView and onLayer on their own.
    assert.deepEqual(readView(null).places, []);
    assert.equal(onLayer({ plane: '', layer: 'region:x' }, ''), true);
    assert.equal(onLayer({ plane: 'deep', layer: 'plane:deep' }, ''), false);
    assert.equal(onLayer({ plane: 'deep', layer: 'plane:deep' }, 'plane:deep'), true);
    assert.equal(iconFor('quay'), 'fa-anchor');
});

test('a huge pack: 2000 places draw, and 50 pans and zooms repaint, in reasonable time', () => {
    const places = Array.from({ length: 2000 }, (_, i) => ({ id: `p${i}`, name: `Place ${i}`, x: (i % 50) * 2, y: Math.floor(i / 50) * 2, visited: i % 10 === 0, kind: 'village', icon: 'fa-house', layer: '', plane: '', region: '', aliases: [] }));
    const routes = Array.from({ length: 1999 }, (_, i) => ({ from: `p${i}`, to: `p${i + 1}`, kind: 'road', known: false }));
    const started = process.hrtime.bigint();
    const { key, $$, $, handle } = draw({ value: { places, routes, layers: [], current: 'p0' } });
    for (let i = 0; i < 25; i += 1) {
        key('+');
        key('ArrowLeft');
    }
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    assert.equal($$('.sd-map-place').length, 2000);
    assert.ok(ms < 15000, `took ${ms} ms`);
    const input = $('.sd-map-search input');
    input.value = 'place 1999';
    input.dispatch('input');
    assert.equal($('.sd-map-result-name').textContent, 'Place 1999');
    assert.ok(handle.state.view.k > handle.state.fitK);
});
