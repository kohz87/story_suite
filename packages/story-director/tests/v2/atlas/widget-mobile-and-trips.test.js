import test from 'node:test';
import assert from 'node:assert/strict';

import { MAP_CSS, onLayer, readTrip, readView } from '../../../src/v2/atlas/widget.js';
import { PACK, PHONE_LINE, TRIP_DAY, TRIP_T0, chooseRegion, clusterDraw, draw, regionShown, story, tripDraw } from './widget.helpers.js';
import { at, command, deepFreeze, query } from './helpers/fake-ctx.js';
test('phone taps: the dot keeps its size, its tap area is 44px (CSS), and in a dense cluster the tap picks the nearest dot', () => {
    const phone = { matchMedia: q => ({ matches: q === PHONE_LINE }) };
    const { doc, root, handle } = clusterDraw(phone);
    const css = MAP_CSS;
    // 44px on the screen: over Story Block's zoom when it draws the screen zoomed (--ss-zoomed), else 44px.
    assert.match(css, /@media \(pointer: coarse\) \{\s*\.sd-map \.sd-map-place::before \{[^}]*width: calc\(44px \/ var\(--ss-zoomed, 1\)\); height: calc\(44px \/ var\(--ss-zoomed, 1\)\);/);
    // The dots themselves are unchanged on a phone (no size rule inside the phone block).
    assert.doesNotMatch(css.slice(css.indexOf('@media (pointer: coarse)')), /\.sd-map-place \{[^}]*width/);

    const dot = name => root.querySelectorAll('.sd-map-place').find(node => node.getAttribute('title') === name);
    const at = node => ({ x: parseFloat(node.style.left), y: parseFloat(node.style.top) });
    const alpha = dot('Alpha');
    const bravo = dot('Bravo');
    const a = at(alpha);
    const b = at(bravo);
    const gap = Math.hypot(a.x - b.x, a.y - b.y);
    assert.ok(gap > 0 && gap < 44, `the fixture is a dense cluster (${gap.toFixed(1)}px apart)`);

    // The browser gave the tap to Alpha's square, but the tap is 3px from Bravo's dot: Bravo.
    const towardAlpha = { x: b.x + 3 * (a.x - b.x) / gap, y: b.y + 3 * (a.y - b.y) / gap };
    alpha.dispatch('click', { clientX: towardAlpha.x, clientY: towardAlpha.y });
    assert.equal(handle.state.picked, bravo.getAttribute('data-id'));
    // And the reverse: given to Bravo's square, 3px from Alpha's dot: Alpha.
    const towardBravo = { x: a.x + 3 * (b.x - a.x) / gap, y: a.y + 3 * (b.y - a.y) / gap };
    bravo.dispatch('click', { clientX: towardBravo.x, clientY: towardBravo.y });
    assert.equal(handle.state.picked, alpha.getAttribute('data-id'));
    // A tap on a dot's own centre picks that dot, whichever square got it.
    bravo.dispatch('click', { clientX: b.x, clientY: b.y });
    assert.equal(handle.state.picked, bravo.getAttribute('data-id'));
});

test('desktop: no tap area, a click picks the place it landed on, as before', () => {
    const fine = { matchMedia: q => ({ matches: false }) };
    const { root, handle } = clusterDraw(fine);
    const dot = name => root.querySelectorAll('.sd-map-place').find(node => node.getAttribute('title') === name);
    const alpha = dot('Alpha');
    const bravo = dot('Bravo');
    const a = { x: parseFloat(alpha.style.left), y: parseFloat(alpha.style.top) };
    const b = { x: parseFloat(bravo.style.left), y: parseFloat(bravo.style.top) };
    const gap = Math.hypot(a.x - b.x, a.y - b.y);
    const towardBravo = { x: a.x + 3 * (b.x - a.x) / gap, y: a.y + 3 * (b.y - a.y) / gap };
    alpha.dispatch('click', { clientX: towardBravo.x, clientY: towardBravo.y });
    assert.equal(handle.state.picked, alpha.getAttribute('data-id'));
});

test('the Region list: a native select between the search box and the zoom buttons, All first, the shown layer chosen; a choice filters as the chips did', () => {
    const { root, $, $$, handle } = draw();
    const bar = $('.sd-map-bar');
    assert.deepEqual(bar.children.map(child => child.className), ['sd-map-search', 'sd-map-region', 'sd-map-tools']);
    const select = $('.sd-map-region select');
    assert.equal(select.tagName, 'SELECT');
    assert.equal(select.getAttribute('aria-label'), 'Region');
    assert.equal($('.sd-map-region-cap').textContent, 'Region');
    assert.equal($('.sd-map-region').tagName, 'LABEL', 'the caption names the list');
    assert.deepEqual($$('.sd-map-region option').map(option => option.getAttribute('value')), ['all', 'region:bluewatch village', 'region:core cities', 'region:locks', 'plane:underground']);
    assert.equal(select.value, 'region:core cities');
    assert.equal($('.sd-map-region option[selected]').textContent, 'Core Cities');
    const drawn = () => $$('.sd-map-place').map(node => node.getAttribute('title'));
    const places = readView({ value: query(story(), 'atlas.view', {}, { pack: PACK }) }).places;
    // Each choice shows that layer's places, as its chip did (onLayer); All shows every place off the planes.
    for (const [value, layer, name] of [['region:locks', 'region:locks', 'Locks'], ['plane:underground', 'plane:underground', 'underground'], ['all', '', 'All']]) {
        chooseRegion(root, value);
        assert.equal(handle.state.layer, layer);
        assert.deepEqual(drawn(), places.filter(place => onLayer(place, layer)).map(place => place.name), value);
        assert.equal(regionShown(root), name);
    }
    assert.deepEqual(drawn(), ['Bluewatch Village', 'Inspection Quay', 'Watch Granary', 'Watchhouse', 'Stray Oar', 'Reedmere', 'Coinwater']);
    // A search that lands on another layer moves the list with it.
    const input = $('.sd-map-search input');
    input.value = 'deep vault';
    input.dispatch('input');
    input.dispatch('keydown', { key: 'Enter' });
    assert.equal(select.value, 'plane:underground');
});

test('a zoomed stage (Story Block draws its screens at 80%): sizes, drags, wheel and taps are worked out in the stage\'s own pixels', () => {
    // The same map twice: drawn at 100%, and drawn at 80% (the browser reports drawn pixels: a 640 × 480 stage measures 512 × 384).
    const plain = draw();
    const zoomed = draw();
    chooseRegion(plain.root, 'all');
    chooseRegion(zoomed.root, 'all');
    plain.stage.getBoundingClientRect = () => ({ left: 100, top: 50, width: 640, height: 480 });
    zoomed.stage.getBoundingClientRect = () => ({ left: 100, top: 50, width: 512, height: 384 });
    zoomed.stage.currentCSSZoom = 0.8;
    plain.$('.sd-map-fit').click();
    zoomed.$('.sd-map-fit').click();
    assert.deepEqual(zoomed.handle.state.size, { width: 640, height: 480 }, 'the stage\'s own size, not the drawn one');
    assert.deepEqual(zoomed.handle.state.view, plain.handle.state.view);
    // A drag of 40 own pixels is 32 drawn ones.
    plain.pointer('pointerdown', 1, 200, 200);
    plain.pointer('pointermove', 1, 220, 200);
    plain.pointer('pointermove', 1, 240, 200);
    plain.pointer('pointerup', 1, 240, 200);
    zoomed.pointer('pointerdown', 1, 180, 170);
    zoomed.pointer('pointermove', 1, 196, 170);
    zoomed.pointer('pointermove', 1, 212, 170);
    zoomed.pointer('pointerup', 1, 212, 170);
    for (const key of ['cx', 'cy', 'k']) assert.ok(Math.abs(zoomed.handle.state.view[key] - plain.handle.state.view[key]) < 1e-9, key);
    // The wheel zooms about the same spot of the map.
    plain.stage.dispatch('wheel', { deltaY: -200, deltaMode: 0, clientX: 100 + 200, clientY: 50 + 100 });
    zoomed.stage.dispatch('wheel', { deltaY: -200, deltaMode: 0, clientX: 100 + 160, clientY: 50 + 80 });
    for (const key of ['cx', 'cy', 'k']) assert.ok(Math.abs(zoomed.handle.state.view[key] - plain.handle.state.view[key]) < 1e-9, key);
    // Without a currentCSSZoom the zoom is the drawn width over the own one.
    delete zoomed.stage.currentCSSZoom;
    zoomed.stage.offsetWidth = 640;
    zoomed.$('.sd-map-fit').click();
    assert.deepEqual(zoomed.handle.state.size, { width: 640, height: 480 });
});

test('a zoomed stage on a phone: the tap lands on the dot drawn under it, and the 44px tap area is 44 drawn pixels', () => {
    const phone = { matchMedia: q => ({ matches: q === PHONE_LINE }) };
    const { root, stage, handle } = clusterDraw(phone);
    stage.getBoundingClientRect = () => ({ left: 30, top: 20, width: 512, height: 384 });
    stage.currentCSSZoom = 0.8;
    root.querySelector('.sd-map-fit').click();
    const dot = name => root.querySelectorAll('.sd-map-place').find(node => node.getAttribute('title') === name);
    const drawnAt = node => ({ x: 30 + parseFloat(node.style.left) * 0.8, y: 20 + parseFloat(node.style.top) * 0.8 });
    const alpha = dot('Alpha');
    const bravo = dot('Bravo');
    assert.equal(alpha.getAttribute('data-ss-hit'), '', 'the dot draws its own tap area');
    // The browser gave the tap to Alpha's square; it landed on Bravo's dot as drawn: Bravo.
    alpha.dispatch('click', { clientX: drawnAt(bravo).x, clientY: drawnAt(bravo).y });
    assert.equal(handle.state.picked, bravo.getAttribute('data-id'));
    alpha.dispatch('click', { clientX: drawnAt(alpha).x, clientY: drawnAt(alpha).y });
    assert.equal(handle.state.picked, alpha.getAttribute('data-id'));
    // 21 drawn pixels from Far Away's dot: inside its 44px square on the screen (26 of the stage's own pixels, more than 22), so a tap
    // there picks Far Away whichever square the browser gave it to.
    const far = dot('Far Away');
    alpha.dispatch('click', { clientX: drawnAt(far).x - 21, clientY: drawnAt(far).y });
    assert.equal(handle.state.picked, far.getAttribute('data-id'));
});

test('a phone: a click from the keyboard (Enter or Space on a focused place, detail 0) picks that place, never the nearest dot', () => {
    const phone = { matchMedia: q => ({ matches: q === PHONE_LINE }) };
    const { root, handle } = clusterDraw(phone);
    const dot = name => root.querySelectorAll('.sd-map-place').find(node => node.getAttribute('title') === name);
    const alpha = dot('Alpha');
    const bravo = dot('Bravo');
    const b = { x: parseFloat(bravo.style.left), y: parseFloat(bravo.style.top) };
    // A browser's keyboard click carries the pointer position 0, 0 or, as here, one that lies on Bravo's dot: Alpha still.
    alpha.dispatch('click', { detail: 0, clientX: b.x, clientY: b.y });
    assert.equal(handle.state.picked, alpha.getAttribute('data-id'));
    alpha.dispatch('click', { detail: 0, clientX: 0, clientY: 0 });
    assert.equal(handle.state.picked, alpha.getAttribute('data-id'));
    // The same position from a finger (detail 1) is Bravo's: the nearest dot.
    alpha.dispatch('click', { detail: 1, clientX: b.x, clientY: b.y });
    assert.equal(handle.state.picked, bravo.getAttribute('data-id'));
});

test('a trip: its legs drawn thick over the known routes, a "You" marker on the current leg, the movers as diamonds, and the panel beside the map', () => {
    const { root, stage, $, $$, trip, handle } = tripDraw({ days: 1 });
    // The trip is a list of two river legs by foot: 90 km (the boat's 35 a day, 3 days), then 60 km.
    assert.equal(trip.on, true);
    assert.deepEqual(trip.legs.map(leg => leg.km), [90, 60]);
    // The route runs into another region (Bluewatch Village is on Core Cities, Reedmere on Locks): the map opens on All to show it whole.
    assert.equal(regionShown(root), 'All');
    assert.ok(handle.state.view.k > handle.state.fitK, 'the map opens fitted to the trip\'s stops, not to the whole layer');
    // On a layer where a stage's ends are not both shown, that stage is not drawn (and "You" is not either).
    chooseRegion(root, 'region:core cities');
    assert.equal($$('.sd-map-trip-leg').length, 0);
    assert.equal($$('.sd-map-you').length, 0);
    chooseRegion(root, 'all');
    const legs = $$('.sd-map-trip-leg');
    assert.deepEqual(legs.map(node => node.getAttribute('data-state')), ['now', 'next']);
    assert.equal(legs.every(node => node.getAttribute('data-from') && node.getAttribute('data-to')), true);
    // "You": a marker and a pin on the first leg, at the share of the road done (1 day of 3), and a diamond for the courier.
    assert.equal($$('.sd-map-you').length, 1);
    assert.equal($('.sd-map-pin-you').textContent, 'You · 30 of 90 km');
    assert.equal($$('.sd-map-mover').length, 1);
    assert.match($('.sd-map-pin-mover').textContent, /Guild courier · March 9/);
    const [youLeft, youTop] = [parseFloat($('.sd-map-you').style.left), parseFloat($('.sd-map-you').style.top)];
    assert.ok(Number.isFinite(youLeft) && Number.isFinite(youTop));
    // The panel: destination, pace, each leg with its km, days and arrival, a progress bar on the current one, the movers.
    assert.equal($('.sd-map-road').hidden, false);
    assert.equal($('.sd-map-road').getAttribute('aria-label'), 'On the road');
    assert.equal($('.sd-map-road h4').textContent, 'On the road');
    assert.equal($('.sd-map-road-to').textContent, 'Bluewatch Village → Coinwater');
    assert.equal($('.sd-map-road-by').textContent, 'on foot, 20 km/day · set out March 3');
    const rows = $$('.sd-map-road-legs li').map(item => [item.querySelector('.sd-map-road-name').textContent, item.querySelector('.sd-map-road-when').textContent, item.getAttribute('data-state')]);
    assert.deepEqual(rows, [
        ['1 · Bluewatch Village → Reedmere', '90 km · 3 days · March 6', 'now'],
        ['2 · Reedmere → Coinwater', '60 km · 2 days · March 8', 'next'],
    ]);
    const movers = $$('.sd-map-road-movers li').map(item => [item.querySelector('.sd-map-road-name').textContent, item.querySelector('.sd-map-road-when').textContent]);
    assert.deepEqual(movers, [['Guild courier: news of the Seal tremor', 'Reedmere → Bluewatch Village · arrive March 9']]);
    const bar = $('.sd-map-road-bar');
    assert.equal(bar.getAttribute('role'), 'progressbar');
    assert.deepEqual([bar.getAttribute('aria-valuenow'), bar.querySelector('span').style.width], ['33', '33%']);
    assert.equal($$('.sd-map-road-bar').length, 1, 'only the current leg has a bar');
    // The panel sits in the frame with the map (over its corner on a wide screen; under it on a phone: MAP_CSS).
    assert.equal($('.sd-map-frame').children.map(child => child.className).join(' '), 'sd-map-stage sd-map-road');
    assert.match(MAP_CSS, /@container \(max-width: 759\.98px\) \{\s*\.sd-map \.sd-map-road \{ position: static; width: auto;/);
    assert.match(MAP_CSS, /\.sd-map \.sd-map-road \{ position: absolute;/);
    // The legend names them.
    const legend = $$('.sd-map-legend .ss-listcard-title').map(node => node.textContent);
    assert.ok(legend.includes('Your trip') && legend.includes('Moving that you know of'), legend.join('|'));
    // Panning moves "You" with the map.
    stage.dispatch('keydown', { key: 'ArrowLeft' });
    assert.notEqual(parseFloat($('.sd-map-you').style.left), youLeft);
    handle.destroy();
});

test('a trip: the marker follows the story time, arrival is said, and a state update takes the trip away', () => {
    const early = tripDraw({ days: 0 });
    assert.equal(early.$('.sd-map-pin-you').textContent, 'You · 0 of 90 km');
    const arrived = tripDraw({ days: 6, place: 'Coinwater', withMover: false });
    assert.equal(arrived.trip.phase, 'arrived');
    assert.equal(arrived.$('.sd-map-road-by').textContent, 'Arrived at Coinwater, March 8');
    assert.equal(arrived.$$('.sd-map-you').length, 0, 'no "You" once arrived');
    assert.equal(arrived.$$('.sd-map-road-bar').length, 0);
    // A state update: the same widget, no trip any more.
    const live = tripDraw({ days: 1 });
    assert.equal(live.$$('.sd-map-trip-leg').length, 2);
    live.handle.update({ value: live.data, trip: null });
    assert.equal(live.$$('.sd-map-trip-leg').length, 0);
    assert.equal(live.$$('.sd-map-you').length, 0);
    assert.equal(live.$('.sd-map-road').hidden, true);
    live.handle.update({ value: live.data, trip: live.trip });
    assert.equal(live.$('.sd-map-road').hidden, false);
});

test('movers alone (no trip) still show: the panel lists them and their diamonds are drawn; nothing without either', () => {
    const { root, $, $$, trip } = (() => {
        const base = story();
        const threads = { th_courier: { id: 'th_courier', key: 'Guild courier', kind: 'event', status: 'active', summary: 'news', fields: { leg: 'Reedmere → Bluewatch Village', arrive: 'March 9' }, track: { legSince: { turn: 1, time: TRIP_T0 } } } };
        const state = deepFreeze({ ...base, domains: { ...base.domains, director: { time: { minutes: TRIP_T0 + TRIP_DAY }, threads } } });
        const tripOnly = query(state, 'atlas.trip', {}, { pack: PACK });
        return { ...draw({ state, props: { trip: tripOnly } }), trip: tripOnly };
    })();
    assert.equal(trip.on, false);
    chooseRegion(root, 'all');
    assert.equal($('.sd-map-road').hidden, false);
    assert.equal($('.sd-map-road-to'), null, 'no trip: no destination line');
    assert.equal($('.sd-map-road h5').textContent, 'Moving that you know of');
    assert.match($('.sd-map-road-movers li').textContent, /^Guild courier: news/);
    assert.equal($$('.sd-map-mover').length, 1);
    assert.equal($$('.sd-map-trip-leg').length, 0);
    // No trip prop at all (the feature is off): nothing drawn, the panel hidden, the frame as before.
    const plain = draw();
    assert.equal(plain.$('.sd-map-road').hidden, true);
    assert.equal(plain.$$('.sd-map-trip-leg').length + plain.$$('.sd-map-you').length + plain.$$('.sd-map-mover').length, 0);
});

test('the trip prop is cleaned: junk, a missing end and a leg id the map lacks draw nothing and break nothing', () => {
    assert.equal(readTrip(null), null);
    assert.equal(readTrip('trip'), null);
    assert.equal(readTrip({ on: true, legs: [] }), null);
    assert.equal(readTrip({ on: false, movers: [{ name: 'x', fromId: '', toId: 'b' }] }), null);
    const cleaned = readTrip({ on: true, phase: 'arrived', to: 'X', legs: [{ from: 'A', to: 'B', km: 'far', state: 'odd', fromId: 'a', toId: 'b' }, 7, null], you: { fromId: 'a', toId: '', t: 3 }, movers: [{ name: 'M', fromId: 'a', toId: 'b', t: -1 }], delays: [{ text: '1 day' }, {}] });
    assert.deepEqual([cleaned.phase, cleaned.legs.length, cleaned.legs[0].km, cleaned.legs[0].state, cleaned.you, cleaned.movers[0].t, cleaned.delays], ['arrived', 1, null, 'next', null, 0, ['1 day']]);
    const { $$, $ } = draw({ props: { trip: { on: true, legs: [{ index: 1, from: 'A', to: 'B', fromId: 'nope', toId: 'also-nope', state: 'now' }], you: { fromId: 'nope', toId: 'also-nope', t: 0.5 }, movers: [{ name: 'Lost', fromId: 'nope', toId: 'also-nope', t: 0.5 }] } } });
    assert.equal($$('.sd-map-trip-leg').length + $$('.sd-map-you').length + $$('.sd-map-mover').length, 0);
    assert.equal($('.sd-map-road').hidden, false, 'the panel still tells the trip');
});

test('places inside a town: small dots round it, "N places inside" on its label, its details list them, the row under the map only for places with no coordinates', () => {
    let state = story();
    for (const name of ['Bluewatch Village / Guild Office', 'Bluewatch Village (River Quay)', 'Bluewatch Watchhouse Cellar']) {
        state = command(at(state, name), 'atlas.visit', { name, parents: true }, { pack: PACK }).state;
    }
    state = at(state, 'Bluewatch Village');
    const { $$, shownLabels, data } = draw({ state });
    const kids = data.places.filter(place => place.parent);
    assert.ok(kids.length >= 2, 'the children carry their parent');
    const town = data.places.find(place => place.name === 'Bluewatch Village');
    assert.equal(town.inside, kids.filter(kid => kid.parent === town.id).length);
    assert.ok(kids.every(kid => Number.isFinite(kid.x) && Math.hypot(kid.x - 64, kid.y - 110) < 1), 'saved coordinates beside the parent');
    assert.equal($$('.sd-map-place').filter(node => node.getAttribute('data-child') === 'true').length, kids.length);
    // The town's label counts its places (a crowded map may shorten it to its first word, as every label).
    assert.ok(shownLabels().some(text => new RegExp(`^Bluewatch( V…| Village) · ${town.inside} (places? )?inside$`).test(text)), shownLabels().join('|'));
    assert.ok(!shownLabels().some(text => /River Quay/.test(text)), 'a child has no label until it is picked');
    // Tapping the town lists its places; a tap on one goes to it.
    const again = draw({ state });
    again.$('.sd-map-me').dispatch('click', {});   // the town is where you are: its details open
    assert.match(again.$('.sd-map-details').textContent, /places? inside/);
    const items = again.$$('.sd-map-inside-item');
    assert.equal(items.length, town.inside);
    items[0].dispatch('click', {});
    assert.equal(again.$('.sd-map-details').getAttribute('data-id'), items[0].getAttribute('data-id'));
    assert.match(again.$('.sd-map-name').textContent, /^Bluewatch Village · /);
    assert.equal(again.$('.sd-map-tidy').hidden, true, 'nothing to tidy');
});

test('"Tidy the map" shows while a visited place has no coordinates and sends one atlas.edit { tidy: true }', () => {
    const state = command(at(story(), 'Camp Nine'), 'atlas.visit', { name: 'Camp Nine' }, { pack: PACK }).state;
    const sent = [];
    const { $ } = draw({ state, api: { query: (name, args) => query(state, name, args, { pack: PACK }), command: (type, payload) => { sent.push([type, payload]); } } });
    const tidy = $('.sd-map-tidy');
    assert.equal(tidy.hidden, false);
    tidy.dispatch('click', {});
    assert.deepEqual(sent, [['atlas.edit', { tidy: true }]]);
    assert.equal(tidy.hidden, true);
});

test('a town\'s details list the first eight places by their own part, then "+N more"; its label keeps the count; child dots are amber', () => {
    let state = story();
    for (let n = 1; n <= 10; n += 1) state = command(state, 'atlas.visit', { name: `Bluewatch Village / Spot ${String(n).padStart(2, '0')}`, parents: true }, { pack: PACK }).state;
    const { $, $$, shownLabels } = draw({ state });
    $('.sd-map-me').click();
    const items = $$('.sd-map-inside-item');
    assert.deepEqual(items.map(item => item.textContent), Array.from({ length: 8 }, (_, n) => `Spot 0${n + 1}`));
    assert.match($('.sd-map-details').textContent, /10 places inside/);
    assert.match($('.sd-map-details').textContent, /\+2 more/);
    assert.ok(shownLabels().some(text => /^Bluewatch( V…| Village) · 10 (places )?inside$/.test(text)), shownLabels().join('|'));
    assert.match(MAP_CSS, /\[data-child\][^}]*#e0a94b/);
});

test('the map opens on the town of the current place at a zoom that sets its places apart; Fit shows everything; a town named only as a parent has its label from the start', () => {
    let state = story();
    for (const name of ['Bluewatch Village / Guild Office', 'Bluewatch Village / River Quay', 'Reedmere (Old Dock)']) state = command(state, 'atlas.visit', { name, parents: true }, { pack: PACK }).state;
    state = at(state, 'Bluewatch Village / Guild Office');
    const { $, handle } = draw({ state });
    const opened = handle.state.view;
    assert.equal(opened.cx, 64);
    assert.equal(opened.cy, -110);
    $('.sd-map-fit').click();
    assert.ok(opened.k > handle.state.view.k, 'Fit is wider than the opening view');
    const wide = draw({ state: at(state, 'Reedmere (Old Dock)') });
    assert.ok(wide.shownLabels().some(text => /^Reedmere/.test(text)), wide.shownLabels().join('|'));
});
