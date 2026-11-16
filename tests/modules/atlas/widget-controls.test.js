import test from 'node:test';
import assert from 'node:assert/strict';

import { KNOWN_LABEL_ZOOM, labelSize } from '../../../modules/atlas/atlas/view.js';
import { PACK, chooseRegion, draw, placeButton, regionNames, regionShown, story } from './widget.helpers.js';
import { query } from './helpers/fake-ctx.js';
test('the controls: search, zoom in and out, fit, centre on me, layers, a focusable map; the bar sits outside the map', () => {
    const { root, stage, $, $$ } = draw();
    const input = $('.sd-map-search input');
    assert.equal(input.getAttribute('type'), 'search');
    assert.match(input.getAttribute('aria-label'), /Find a place/);
    assert.equal($('.sd-map-results').hidden, true);
    for (const [cls, label] of [['zoom-in', 'Zoom in'], ['zoom-out', 'Zoom out'], ['fit', 'Show the whole layer'], ['me', 'Centre on where you are']]) {
        const button = $(`.sd-map-${cls}`);
        assert.ok(button, cls);
        assert.equal(button.tagName, 'BUTTON');
        assert.equal(button.getAttribute('aria-label'), label);
    }
    assert.equal(stage.getAttribute('tabindex'), '0');
    assert.equal(stage.getAttribute('aria-roledescription'), 'map');
    assert.equal(stage.querySelector('.sd-map-tools'), null, 'the controls never cover the map (or the nav under it)');
    // Item 2: All, then only the regions and planes that have places (no Mirelands, no empty chip).
    assert.deepEqual(regionNames(root), ['All', 'Bluewatch Village', 'Core Cities', 'Locks', 'underground']);
    assert.equal(regionShown(root), 'Core Cities');
    // Item 3: the "you are here" ring is drawn after (above) the places and the labels.
    const children = stage.children.map(child => child.className);
    assert.deepEqual(children, ['sd-map-svg', 'sd-map-places', 'sd-map-labels', 'sd-map-here', 'sd-map-marks']);
    assert.equal($('.sd-map-here').hidden, false);
    assert.equal(root.querySelector('.sd-map-legend-card').hidden, false);
});

test('item 1: unvisited places are drawn, marked and small; their names come as the map comes closer, or on hover and focus', () => {
    const { root, $, $$, key, shownLabels, handle } = draw();
    chooseRegion(root, 'all');
    const names = $$('.sd-map-place').map(node => node.getAttribute('title'));
    assert.deepEqual(names, ['Bluewatch Village', 'Inspection Quay', 'Watch Granary', 'Watchhouse', 'Stray Oar', 'Reedmere', 'Coinwater']);
    assert.ok(!names.includes('Smugglers Cellar'), 'a hidden place is not drawn');
    assert.ok(!names.includes('Deep Vault'), 'a plane\'s place is on its own layer');
    const coin = placeButton(root, 'Coinwater');
    assert.equal(coin.getAttribute('data-visited'), 'false');
    assert.match(coin.getAttribute('aria-label'), /Coinwater \(City, Core Cities, not visited\)/);
    assert.equal(coin.classList.contains('sd-map-far'), true, 'far out: a dot');
    assert.ok(!shownLabels().includes('Coinwater'));
    assert.ok(shownLabels().includes('Bluewatch Village'));
    // Hover and focus bring a name back.
    coin.dispatch('pointerover');
    assert.ok(shownLabels().includes('Coinwater'));
    coin.dispatch('pointerout');
    assert.ok(!shownLabels().includes('Coinwater'));
    coin.dispatch('focusin');
    assert.ok(shownLabels().includes('Coinwater'));
    coin.dispatch('focusout');
    // Closer in: icons, then names.
    while (handle.state.view.k / handle.state.fitK < KNOWN_LABEL_ZOOM) key('+');
    assert.equal(coin.classList.contains('sd-map-far'), false);
    root.querySelector('.sd-map-me').click();
    assert.ok(shownLabels().length >= 3, `labels: ${shownLabels()}`);
});

test('item 3: shown labels never overlap one another, in the knot of places, at every zoom step', () => {
    const { root, $, $$, key, handle } = draw();
    chooseRegion(root, 'all');
    $('.sd-map-me').click();
    for (let step = 0; step < 12; step += 1) {
        const boxes = $$('.sd-map-label').filter(label => !label.hidden).map(label => ({
            text: label.textContent, x: parseFloat(label.style.left), y: parseFloat(label.style.top), ...labelSize(label.textContent),
        }));
        for (const [i, a] of boxes.entries()) {
            for (const b of boxes.slice(i + 1)) {
                const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
                assert.ok(!overlap, `"${a.text}" and "${b.text}" overlap at zoom ${handle.state.view.k}`);
            }
        }
        key(step < 6 ? '-' : '+');
    }
});

test('keyboard: + and − zoom, the arrows pan, 0 fits; other keys are left alone', () => {
    const { key, handle, stage } = draw();
    const start = handle.state.view;
    key('+');
    assert.ok(Math.abs(handle.state.view.k - start.k * 1.5) < 1e-9);
    key('-');
    assert.ok(Math.abs(handle.state.view.k - start.k) < 1e-9);
    key('=');
    key('_');
    assert.ok(Math.abs(handle.state.view.k - start.k) < 1e-9);
    key('+');
    key('ArrowRight');
    assert.ok(handle.state.view.cx > start.cx, 'the right arrow shows what is to the right');
    key('ArrowUp');
    assert.ok(handle.state.view.cy < start.cy, 'the up arrow shows what is above');
    key('0');
    assert.deepEqual(handle.state.view, start, '0 fits the layer again');
    key('Home');
    assert.deepEqual(handle.state.view, start);
    const other = stage.dispatch('keydown', { key: 'q' });
    assert.equal(other.defaultPrevented, false);
    assert.equal(stage.dispatch('keydown', { key: '+' }).defaultPrevented, true);
    // Zoom stays inside its limits however often it is pressed.
    for (let i = 0; i < 40; i += 1) key('-');
    assert.equal(handle.state.view.k, handle.state.limits.min);
    for (let i = 0; i < 200; i += 1) key('+');
    assert.equal(handle.state.view.k, handle.state.limits.max);
    // And panning never leaves the world.
    for (let i = 0; i < 500; i += 1) key('ArrowLeft');
    const left = handle.state.view.cx;
    key('ArrowLeft');
    assert.equal(handle.state.view.cx, left);
});

test('buttons: zoom in and out about the centre, fit all, centre on me (zoomed to set it apart, with its details)', () => {
    const { $, handle } = draw();
    const fit = handle.state.view;
    $('.sd-map-zoom-in').click();
    assert.equal(handle.state.view.cx, fit.cx);
    assert.ok(handle.state.view.k > fit.k);
    $('.sd-map-zoom-out').click();
    $('.sd-map-zoom-out').click();
    assert.ok(handle.state.view.k < fit.k);
    $('.sd-map-fit').click();
    assert.deepEqual(handle.state.view, fit);
    $('.sd-map-me').click();
    const here = $('.sd-map-here');
    assert.equal(here.hidden, false);
    assert.equal(parseFloat(here.style.left), 320, 'centred on the current place (640 × 480 stage)');
    assert.equal(parseFloat(here.style.top), 240);
    assert.ok(handle.state.view.k >= fit.k * 2);
    assert.equal(handle.state.picked, $('.sd-map-place[aria-current="location"]').getAttribute('data-id'));
    assert.match($('.sd-map-details').textContent, /You are here\./);
});

test('touch and mouse: a drag pans, a tap picks, a drag ending on a place does not pick, a pinch zooms about its middle', () => {
    const { root, stage, pointer, handle, $ } = draw();
    chooseRegion(root, 'all');
    const fit = handle.state.view;
    // A drag of 40 px to the right.
    pointer('pointerdown', 1, 100, 100);
    pointer('pointermove', 1, 120, 100);
    pointer('pointermove', 1, 140, 100);
    assert.ok(Math.abs(handle.state.view.cx - (fit.cx - 40 / fit.k)) < 1e-9);
    assert.equal(stage.classList.contains('sd-map-dragging'), true);
    pointer('pointerup', 1, 140, 100);
    assert.equal(stage.classList.contains('sd-map-dragging'), false);
    // The click that ends a drag on a place picks nothing.
    const reed = placeButton(root, 'Reedmere');
    reed.click();
    assert.equal(handle.state.picked, '');
    // A tap (a few pixels of jitter) picks and does not pan.
    const before = handle.state.view;
    pointer('pointerdown', 2, 300, 300);
    pointer('pointermove', 2, 302, 301);
    pointer('pointerup', 2, 302, 301);
    assert.deepEqual(handle.state.view, before);
    reed.click();
    assert.equal(handle.state.picked, reed.getAttribute('data-id'));
    assert.equal($('.sd-map-details').hidden, false);
    // A pinch: two fingers moving apart about (320, 240) zoom in by their spread, the middle staying put.
    $('.sd-map-fit').click();
    pointer('pointerdown', 3, 300, 240);
    pointer('pointerdown', 4, 340, 240);
    pointer('pointermove', 4, 380, 240);
    pointer('pointermove', 3, 260, 240);
    assert.ok(Math.abs(handle.state.view.k / fit.k - 3) < 1e-6, `pinched to ${handle.state.view.k / fit.k}`);
    // A third finger changes nothing and breaks nothing; lifting all of them ends it.
    pointer('pointerdown', 5, 10, 10);
    const pinched = handle.state.view;
    pointer('pointermove', 5, 50, 50);
    assert.deepEqual(handle.state.view, pinched);
    for (const id of [3, 4, 5]) pointer('pointercancel', id, 0, 0);
    // A move with no finger down, a right mouse button: ignored.
    pointer('pointermove', 9, 500, 500);
    assert.deepEqual(handle.state.view, pinched);
    pointer('pointerdown', 6, 100, 100, { pointerType: 'mouse', button: 2 });
    pointer('pointermove', 6, 300, 300, { pointerType: 'mouse' });
    assert.deepEqual(handle.state.view, pinched);
});

test('wheel: zooms about the pointer and stops the page from scrolling; huge deltas stay inside the limits', () => {
    const { stage, handle } = draw();
    const fit = handle.state.view;
    const event = stage.dispatch('wheel', { deltaY: -200, deltaMode: 0, clientX: 320, clientY: 240 });
    assert.equal(event.defaultPrevented, true);
    assert.ok(handle.state.view.k > fit.k);
    assert.ok(Math.abs(handle.state.view.cx - fit.cx) < 1e-9, 'about the pointer at the centre');
    stage.dispatch('wheel', { deltaY: -1e7, deltaMode: 0, clientX: 10, clientY: 10 });
    assert.equal(handle.state.view.k, handle.state.limits.max);
    stage.dispatch('wheel', { deltaY: 1e7, deltaMode: 1, clientX: 10, clientY: 10 });
    assert.equal(handle.state.view.k, handle.state.limits.min);
    stage.dispatch('wheel', { deltaY: 'nonsense', clientX: 10, clientY: 10 });
    assert.equal(handle.state.view.k, handle.state.limits.min);
});

test('search: tolerant, unvisited places marked "not visited", hidden ones never found; picking moves, switches layer and shows details', () => {
    const { root, $, $$, handle } = draw();
    const input = $('.sd-map-search input');
    input.value = 'GRANERY';
    input.dispatch('input');
    assert.equal($('.sd-map-results').hidden, false);
    assert.deepEqual($$('.sd-map-result').map(row => row.textContent), ['Watch GranaryBluewatch Village · not visited']);
    input.value = 'the quay';
    input.dispatch('input');
    assert.deepEqual($$('.sd-map-result-name').map(row => row.textContent), ['Inspection Quay']);
    input.value = 'cellar';
    input.dispatch('input');
    assert.deepEqual($$('.sd-map-result'), []);
    assert.match($('.sd-map-results').textContent, /No place by that name/);
    // Enter takes the best hit: Reedmere is on another layer (Locks), so the map goes there.
    input.value = 'reedmer';
    input.dispatch('input');
    const enter = input.dispatch('keydown', { key: 'Enter' });
    assert.equal(enter.defaultPrevented, true);
    assert.equal(handle.state.layer, 'region:locks');
    assert.equal(regionShown(root), 'Locks');
    const reed = $$('.sd-map-place').find(node => node.getAttribute('title') === 'Reedmere');
    assert.equal(handle.state.picked, reed.getAttribute('data-id'));
    assert.equal(reed.classList.contains('sd-map-picked'), true);
    assert.equal($('.sd-map-results').hidden, true);
    assert.match($('.sd-map-details').textContent, /Reedmere.*Town · Locks.*Not visited yet\..*From Bluewatch Village: 90 km, .* by river\./);
    // A result clicked: the knot's granary, zoomed so its neighbours stand apart; on "All" it stays on All.
    chooseRegion(root, 'all');
    input.value = 'granary';
    input.dispatch('input');
    $('.sd-map-result').click();
    assert.equal(handle.state.layer, '');
    assert.ok(handle.state.view.k > handle.state.fitK * 100, 'deep enough to part the village\'s streets');
    // Escape clears the box.
    input.dispatch('keydown', { key: 'Escape' });
    assert.equal(input.value, '');
    assert.equal($('.sd-map-results').hidden, true);
    // Enter with nothing found does nothing.
    input.value = 'zzzz';
    input.dispatch('input');
    assert.equal(input.dispatch('keydown', { key: 'Enter' }).defaultPrevented, false);
});

test('details: the trip from the query (sync or async), "No known route" without one, nothing without a query; Close and Escape', async () => {
    const { root, $, queries } = draw();
    chooseRegion(root, 'all');
    placeButton(root, 'Reedmere').click();
    assert.deepEqual(queries.at(-1), { name: 'atlas.place', args: { id: placeButton(root, 'Reedmere').getAttribute('data-id') } });
    assert.match($('.sd-map-trip').textContent, /From Bluewatch Village: 90 km/);
    placeButton(root, 'Coinwater').click();
    assert.match($('.sd-map-trip').textContent, /From Bluewatch Village: 150 km/);
    $('.sd-map-close').click();
    assert.equal($('.sd-map-details').hidden, true);
    // A layer with no route from here.
    chooseRegion(root, 'region:bluewatch village');
    placeButton(root, 'Watchhouse').click();
    assert.equal($('.sd-map-trip').textContent, 'No known route from where you are.');
    root.querySelector('.sd-map-stage').dispatch('keydown', { key: 'Escape' });
    assert.equal($('.sd-map-details').hidden, true);
    // An async query, a throwing one, none at all.
    const state = story();
    const slow = draw({ api: { query: (name, args) => Promise.resolve(query(state, name, args, { pack: PACK })) } });
    placeButton(slow.root, 'Coinwater').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(slow.$('.sd-map-trip').textContent, /From Bluewatch Village: 150 km/);
    const broken = draw({ api: { query: () => { throw new Error('down'); } } });
    placeButton(broken.root, 'Coinwater').click();
    assert.equal(broken.$('.sd-map-trip').textContent, 'No known route from where you are.');
    const bare = draw({ api: {} });
    placeButton(bare.root, 'Coinwater').click();
    assert.match(bare.$('.sd-map-details').textContent, /Coinwater/);
});

test('a pick writes nothing unless the screen asks: then onSelect runs with { node }', () => {
    const ran = [];
    const state = story();
    const { root } = draw({ props: { onSelect: 'atlas.focus' }, api: { command: (type, payload) => { ran.push({ type, payload }); return Promise.reject(new Error('refused')); }, query: (n, a) => query(state, n, a, { pack: PACK }) } });
    placeButton(root, 'Coinwater').click();
    assert.deepEqual(ran, [{ type: 'atlas.focus', payload: { node: placeButton(root, 'Coinwater').getAttribute('data-id') } }]);
    const quiet = draw();
    placeButton(quiet.root, 'Coinwater').click();
    assert.equal(quiet.handle.state.picked, placeButton(quiet.root, 'Coinwater').getAttribute('data-id'));
});
