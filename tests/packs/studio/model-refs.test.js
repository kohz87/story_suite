// The Studio's reference index (studio/model/refs.js): ids defined, every place that names one (plain fields, one-line strings, object keys, gates),
// references by display name, the other pack's name cultures, and garbage that must not throw. Run on Ersveil and a small pack that uses every site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRefs, definedIds, usedBy, walkText } from '../../../studio/model/refs.js';
import { openDoc } from '../../../studio/model/doc.js';
import { SMALL } from './refs-pack.js';
import { buildIndex } from '../../../packs/validate/world-pack-parts/index.js';

const read = rel => JSON.parse(readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8'));
const ERSVEIL = read('examples/packs/ersveil-world/pack.json');

const of = (refs, kind, id) => usedBy(refs, kind, id);
const roles = list => list.map(use => use.role).sort();

test('every kind of id is defined, with its place in the file, and the pickers list them in file order', () => {
    const refs = buildRefs(openDoc({ doc: SMALL() }));
    assert.deepEqual(definedIds(refs, 'place'), [{ id: 'fenhold', name: 'Fenhold' }, { id: 'reedmoor', name: 'Reedmoor' }]);
    assert.deepEqual(refs.defs.place[0].path, ['content', 'places', 0, 'id']);
    assert.equal(refs.defs.place[1].rec, 'places.1');
    for (const [kind, id] of [['region', 'the-fen'], ['realm', 'fen-realm'], ['cast', 'wren'], ['lore', 'lamp-lore'], ['power', 'guild'], ['score', 'dread'], ['condition', 'lamps-out'], ['event', 'flood'], ['template', 'thaw'], ['route', 'Old Causeway'], ['route', 'fenhold–reedmoor']]) {
        assert.ok(refs.defs[kind].some(item => item.id === id), `${kind} ${id}`);
    }
    assert.deepEqual(definedIds(refs, 'fact').map(item => item.id).sort(), ['lit', 'thawed', 'wren-knows']);
    assert.equal(refs.defs.route.find(item => item.id === 'fenhold–reedmoor').path, null);
});

test('plain fields, by id and by name or alias', () => {
    const refs = buildRefs(openDoc({ doc: SMALL() }));
    assert.deepEqual([...new Set(roles(of(refs, 'place', 'fenhold')))], ['from', 'holds', 'likelier', 'menu', 'set', 'start', 'where']);
    assert.equal(of(refs, 'place', 'fenhold').find(use => use.role === 'holds').by, 'name');
    assert.equal(of(refs, 'place', 'reedmoor').filter(use => use.by === 'name').length, 1);
    assert.equal(of(refs, 'region', 'the-fen').filter(use => use.by === 'name').length, 1);
    assert.deepEqual(of(refs, 'cast', 'tam').map(use => use.role).filter(role => role === 'tie' || role === 'bond'), ['tie']);
    assert.ok(of(refs, 'cast', 'wren').some(use => use.role === 'bond' && use.owner.id === 'tam'));
    assert.ok(of(refs, 'region', 'the-fen').some(use => use.role === 'where' && use.path.join('.') === 'content.worldEvents.1.where.region'));
});

test('one-line strings: conditions, anchors, thresholds, weights, gates, with the role and the form', () => {
    const refs = buildRefs(openDoc({ doc: SMALL() }));
    const cond = of(refs, 'condition', 'lamps-out');
    assert.ok(cond.length >= 14);
    assert.ok(cond.every(use => ['text', 'key', 'value'].includes(use.form)));
    assert.ok(of(refs, 'event', 'flood').some(use => use.role === 'after' && use.path.join('.') === 'content.worldEvents.0.window.after'));
    assert.deepEqual([...new Set(of(refs, 'event', 'flood').map(use => use.role))].sort(), ['after', 'ends', 'gate', 'requires']);
    assert.ok(of(refs, 'power', 'guild').some(use => use.role === 'weight') && of(refs, 'power', 'guild').some(use => use.form === 'key'));
    assert.ok(of(refs, 'score', 'dread').some(use => use.role === 'weight') && of(refs, 'score', 'dread').some(use => use.role === 'likelier' && use.form === 'key'));
    assert.ok(of(refs, 'fact', 'lit').some(use => use.role === 'requires') && of(refs, 'fact', 'lit').some(use => use.role === 'gate'));
    assert.ok(of(refs, 'lore', 'lamp-lore').length === 1 && of(refs, 'template', 'thaw').length === 1);
    assert.ok(of(refs, 'cast', 'wren').some(use => use.role === 'gate' && use.owner.part === 'lore') && of(refs, 'cast', 'tam').some(use => use.role === 'gate' && use.owner.part === 'cast'));
    assert.ok(of(refs, 'cast', 'tam').some(use => use.role === 'menu') && of(refs, 'route', 'Old Causeway').length === 1);
    assert.ok(of(refs, 'place', 'reedmoor').some(use => use.role === 'to' && use.by === 'id'));
});

test('the start block: format 4 under content.start, format 3 at the top', () => {
    const v3 = SMALL();
    v3.start = v3.content.start;
    delete v3.content.start;
    const refs = buildRefs(v3);
    assert.ok(of(refs, 'place', 'fenhold').some(use => use.path.join('.') === 'start.place'));
    assert.ok(of(refs, 'condition', 'lamps-out').some(use => use.path[0] === 'start'));
    assert.ok(buildRefs(SMALL()).uses.some(use => use.path.join('.') === 'content.start.world.facts.0' && use.role === 'id'));
});

test("the other pack's name cultures name this world's regions", () => {
    const game = { kind: 'game', content: { names: { fen: { regions: ['the-fen', 'Marsh'], given: ['A'] }, banned: ['x'] } } };
    const refs = buildRefs(SMALL(), game);
    assert.deepEqual(refs.uses.filter(use => use.pack === 'other').map(use => [use.kind, use.id, use.by]), [['region', 'the-fen', 'id'], ['region', 'the-fen', 'name']]);
    assert.equal(buildRefs(SMALL()).uses.some(use => use.pack === 'other'), false);
});

test('walkText replaces only the id span and keeps the rest as written', () => {
    const seen = [];
    const visit = (hint, id) => { seen.push([hint, id]); return id === 'a' ? 'b' : undefined; };
    assert.equal(walkText('fired:a + 3 days', 'entry', visit), 'fired:b + 3 days');
    assert.equal(walkText('a@fenhold: 10 days', 'cond', visit), 'b@fenhold: 10 days');
    assert.equal(walkText('power:a >= 5', 'entry', visit), 'power:b >= 5');
    assert.equal(walkText('200 - power:a', 'weight', visit), '200 - power:b');
    assert.equal(walkText('meter trust >= 40 of a or quote:fired:a and b', 'gate', visit), 'meter trust >= 40 of b or quote:fired:a and b');
    assert.equal(walkText('nothing:here', 'entry', visit), 'nothing:here');
    assert.equal(walkText(5, 'entry', visit), 5);
});

test('Ersveil: every id is defined once and every reference resolves, the way the pack checker resolves it', () => {
    const refs = buildRefs(ERSVEIL);
    assert.equal(refs.defs.place.length, ERSVEIL.content.places.length);
    assert.equal(refs.defs.cast.length, ERSVEIL.content.cast.length);
    assert.equal(refs.defs.event.length, ERSVEIL.content.worldEvents.length);
    assert.ok(refs.uses.length > 2000);
    assert.equal(refs.uses.filter(use => use.dangling).length, 0, JSON.stringify(refs.uses.find(use => use.dangling)));
    // routes name places by display name: those are found too
    assert.ok(refs.uses.filter(use => use.role === 'from' && use.by === 'name').length > 300);
    // the same scopes as the checker's own lookup for every place-ish value
    const index = buildIndex({ ...ERSVEIL.content, places: ERSVEIL.content.places.map(place => ({ ...place, slug: place.id })), deferCalendar: true });
    for (const use of refs.uses.filter(each => each.form === 'value' && ['from', 'to'].includes(each.role)).slice(0, 400)) {
        assert.ok(index.ref(readPath(ERSVEIL, use.path)).has('place'), use.path.join('.'));
    }
});

const readPath = (root, path) => path.reduce((node, key) => node?.[key], root);

test('garbage does not throw', () => {
    for (const bad of [null, undefined, 5, 'text', [], {}, { content: 5 }, { content: { places: 'x', cast: [null, 5, { ties: 'x', secrets: [{ gate: 5 }] }], worldEvents: [{ requires: 'x', outcomes: 5, effects: [] }], templates: [{ open: { menu: { cast: { of: 'figures' } } } }], names: { a: 5 } } }]) {
        const refs = buildRefs(bad, bad);
        assert.ok(Array.isArray(refs.uses));
    }
    assert.deepEqual(usedBy(null, 'place', 'x'), []);
    assert.deepEqual(definedIds(undefined, 'place'), []);
});
