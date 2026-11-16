// B1.9: a marked `~ place Name` takes the kind and region the line leaves out from the map or a pack; unmarked replies keep today's rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness, line } from '../../inventory/helpers/fake-ctx.js';
import { core, stocked } from '../../inventory/fixtures.js';

// The rows are Story Director's `atlas.places` rows (`placeOut`: no aliases) and `atlas.place` (`placeDetail`: with aliases, resolves a name or alias).
const out = { id: 'a1', name: 'Bluewatch Village', region: 'Lakeshire', kind: 'settlement', layer: 'surface', x: 1, y: 1, discovered: true, source: 'story' };
const ATLAS = [out];
const detail = (_state, { name }) => (['bluewatch village', 'bluewatch'].includes(String(name).toLowerCase()) ? { ...out, aliases: ['Bluewatch'], parent: null, here: false, trip: null, routes: [] } : null);
const PACK = [{ name: 'Cold Ford', aliases: ['Ford Crossing'], kind: 'wild' }];
const queries = { 'atlas.places': () => ATLAS, 'atlas.place': detail, 'packs.content': (_state, { kind }) => (kind === 'places' ? PACK : []) };
const MARK = { extra: { carrier: { rules: ['placeFromMap'] } } };

function setup() {
    const module = core({});
    Object.assign(module.queries, queries);
    return createHarness([module], { state: stocked(module) });
}
const place = h => h.state.domains.scene.place;

test('SB12: the place grammar asks for kind and region only for a new place', async () => {
    const { CORE_KINDS } = await import('../../../../modules/scene/domains/core/kinds.js');
    assert.match(CORE_KINDS.place.grammar, /kind and region only for a place not yet on the map/);
});

test('an atlas place by name or alias gets its kind and region, and the summary says so', () => {
    for (const name of ['Bluewatch Village', 'bluewatch']) {
        const h = setup();
        const result = h.capture(line('~', 'place', name), MARK);
        assert.equal(result.ok, true, result.message);
        assert.deepEqual(place(h), { name, kind: 'settlement', region: 'Lakeshire' });
        assert.match(result.result.summary, /\(settlement, Lakeshire, from the map\)/);
    }
});

test('a pack place gives its kind; with no region of its own the region stays', () => {
    const h = setup();
    h.capture(line('~', 'place', 'Bluewatch Village'), MARK);
    h.capture(line('~', 'place', 'Ford Crossing'), MARK);
    assert.deepEqual(place(h), { name: 'Ford Crossing', kind: 'wild', region: 'Lakeshire' });
});

test('an unknown place keeps today\'s rule: no kind, the old region', () => {
    const h = setup();
    h.capture(line('~', 'place', 'Bluewatch Village'), MARK);
    const result = h.capture(line('~', 'place', 'Nowhere Hollow'), MARK);
    assert.deepEqual(place(h), { name: 'Nowhere Hollow', kind: '', region: 'Lakeshire' });
    assert.doesNotMatch(result.result.summary, /from the map/);
});

test('an explicit label wins over the map', () => {
    const h = setup();
    h.capture(line('~', 'place', 'Bluewatch Village', { kind: 'ruin', region: 'Elsewhere' }), MARK);
    assert.deepEqual(place(h), { name: 'Bluewatch Village', kind: 'ruin', region: 'Elsewhere' });
    h.capture(line('~', 'place', 'Cold Ford', { region: 'The Marches' }), MARK);
    assert.deepEqual(place(h), { name: 'Cold Ford', kind: 'wild', region: 'The Marches' });
});

test('R0: a reply without the mark still inherits the region and takes only a pack kind', () => {
    const h = setup();
    h.capture(line('~', 'place', 'Old Quay', { kind: 'settlement', region: 'River' }));
    h.capture(line('~', 'place', 'Bluewatch Village'));
    assert.deepEqual(place(h), { name: 'Bluewatch Village', kind: '', region: 'River' });
    h.capture(line('~', 'place', 'Cold Ford'));
    assert.deepEqual(place(h), { name: 'Cold Ford', kind: 'wild', region: 'River' });
});

test('staying put keeps the stored labels (no fill on the same place)', () => {
    const h = setup();
    h.capture(line('~', 'place', 'Bluewatch Village'), MARK);
    h.capture(line('~', 'place', 'Bluewatch Village', { with: 'Wessel' }), MARK);
    assert.deepEqual(place(h), { name: 'Bluewatch Village', kind: 'settlement', region: 'Lakeshire' });
});

test('the atlas\'s region wins over a pack\'s for a known place (a landmark or the reader set it on purpose)', () => {
    Object.assign(queries, { 'packs.content': (_state, { kind }) => (kind === 'places' ? [...PACK, { name: 'Bluewatch Village', kind: 'town', region: 'River' }] : []) });
    try {
        const h = setup();
        h.capture(line('~', 'place', 'Bluewatch'), MARK);
        assert.deepEqual(place(h), { name: 'Bluewatch', kind: 'settlement', region: 'Lakeshire' });
    } finally {
        Object.assign(queries, { 'packs.content': (_state, { kind }) => (kind === 'places' ? PACK : []) });
    }
});

test('a line with one label: only the filled one is said to come from the map', () => {
    const h = setup();
    const result = h.capture(line('~', 'place', 'Bluewatch Village', { region: 'The Marches' }), MARK);
    assert.match(result.result.summary, /\(kind settlement, from the map\)/);
    assert.doesNotMatch(result.result.summary, /Marches/);
});
