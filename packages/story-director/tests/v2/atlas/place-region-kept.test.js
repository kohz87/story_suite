// A region set on purpose (a landmark line, the reader's edit) stays on a pack place; the mend only fixes a region that repeats the scene's word.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part } from '../../../src/v2/atlas/index.js';
import { at, command, lines, makeState, query, queryFor } from './helpers/fake-ctx.js';

const PACK = { places: [{ name: 'Bluewatch Village', region: 'River', kind: 'settlement', x: 64, y: 110 }], routes: [] };
const NAME = 'Bluewatch Village';

// The scene stands at the place with `region`; the next beforeGenerate's commands run; returns the state and what it sent.
function generate(state, region) {
    const moved = at(state, NAME, { kind: 'settlement', region });
    const out = part.hooks.beforeGenerate({ state: moved, query: (q, args) => queryFor(PACK)(moved, q, args) });
    const sent = (out?.commands ?? []).filter(step => step.type === 'atlas.visit');
    let next = moved;
    for (const step of sent) next = command(next, step.type, step.payload, { pack: PACK }).state;
    return { state: next, sent };
}
const said = (state, region) => ({
    place: query(state, 'atlas.place', { name: NAME }, { pack: PACK }).region,
    here: query(at(state, NAME, { kind: 'settlement', region }), 'atlas.here', {}, { pack: PACK }).region,
    map: query(state, 'atlas.places', {}, { pack: PACK }).find(place => place.name === NAME).region,
});

test('a landmark line sets Lakeshire on a pack place: every reading says it and the next beforeGenerate leaves it', () => {
    const { state } = lines(makeState(), `+ landmark ${NAME} — a market town | region: Lakeshire`, { pack: PACK });
    assert.deepEqual(said(state, 'Lakeshire'), { place: 'Lakeshire', here: 'Lakeshire', map: 'Lakeshire' });
    const next = generate(state, 'Lakeshire');
    assert.deepEqual(next.sent.map(step => step.payload.region), next.sent.map(() => 'Lakeshire'));
    assert.deepEqual(said(next.state, 'Lakeshire'), { place: 'Lakeshire', here: 'Lakeshire', map: 'Lakeshire' });
    assert.equal(Object.values(next.state.domains.atlas.places)[0].regionBy, 'landmark');
    // The landmark already made the place discovered, so beforeGenerate sent no visit: visit it explicitly.
    const visited = command(state, 'atlas.visit', { name: NAME, region: 'River Confederacy' }, { pack: PACK }).state;
    assert.equal(said(visited, 'Lakeshire').place, 'Lakeshire', 'the visit does not overwrite the landmark region');
    assert.equal(Object.values(visited.domains.atlas.places)[0].regionBy, 'landmark');
});

test('a reader edit sets Lakeshire on a pack place: the next beforeGenerate does not put River back', () => {
    const id = query(makeState(), 'atlas.place', { name: NAME }, { pack: PACK }).id;
    const edited = command(makeState(), 'atlas.edit', { place: id, region: 'Lakeshire' }, { pack: PACK }).state;
    assert.equal(said(edited, 'Lakeshire').place, 'Lakeshire');
    const next = generate(edited, 'Lakeshire');
    assert.deepEqual(said(next.state, 'Lakeshire'), { place: 'Lakeshire', here: 'Lakeshire', map: 'Lakeshire' });
    assert.equal(Object.values(next.state.domains.atlas.places)[0].regionBy, 'reader');
});

test('control: a region that only repeats the scene\'s word is still mended to the pack\'s', () => {
    // Saved from the scene before the pack said better: no mark.
    let state = makeState();
    state = command(state, 'atlas.visit', { name: NAME, region: 'Lakeshire' }).state;
    assert.equal(query(state, 'atlas.places', {}).find(place => place.name === NAME).region, 'Lakeshire');
    const next = generate(state, 'Lakeshire');
    assert.equal(next.sent.length, 1);
    assert.deepEqual(said(next.state, 'Lakeshire').place, 'River');
    assert.equal(Object.values(next.state.domains.atlas.places)[0].regionBy, undefined);
});

test('a region cleared to empty drops the mark: the next visit gets the pack\'s region, not the scene\'s wider word', () => {
    const id = query(makeState(), 'atlas.place', { name: NAME }, { pack: PACK }).id;
    let state = command(makeState(), 'atlas.edit', { place: id, region: 'Lakeshire' }, { pack: PACK }).state;
    state = command(state, 'atlas.edit', { place: id, region: '' }, { pack: PACK }).state;
    assert.equal(Object.values(state.domains.atlas.places)[0].regionBy, undefined);
    assert.equal(said(state, 'River Confederacy').place, 'River');
    const next = generate(state, 'River Confederacy');
    assert.equal(said(next.state, 'River Confederacy').place, 'River');
    // A landmark line with an empty region clears the mark the same way.
    const marked = lines(makeState(), `+ landmark ${NAME} — a market town | region: Lakeshire`, { pack: PACK }).state;
    const cleared = lines(marked, `+ landmark ${NAME} — a market town | region:`, { pack: PACK }).state;
    assert.equal(Object.values(cleared.domains.atlas.places)[0].regionBy, undefined);
});
