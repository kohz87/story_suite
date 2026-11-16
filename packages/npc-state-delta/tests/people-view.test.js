import test from 'node:test';
import assert from 'node:assert/strict';
import { PEOPLE_KEYS, peopleState, peopleView, stripVolatile } from '../src/people/view.js';

// J07 step 3: rules of the people view (which keys, which clock fields, ids, determinism).

const rec = (id, extra = {}) => ({ id, name: id.toUpperCase(), ...extra });

test('people view: the kept keys are exact', () => {
    assert.deepEqual([...PEOPLE_KEYS], ['npcs', 'candidates', 'dismissed', 'userDismissedGroups', 'socialGraph', 'portraitAssets', 'turn']);
    const state = {
        npcs: [rec('a')], candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {}, turn: 3,
        checkpoints: [1], lineage: [1], branchParent: 'x', branchLineageVersion: 2, rollbackJournal: [1], rollbackJournalVersion: 1,
        pendingBackfills: [1], readAhead: [1], lastScanAt: 9, lastScannedMessageId: 4, assistantSinceScan: 2, scanCount: 5,
        inlineCards: [1], timeline: { np_1: {} }, npc: { meters: {} },
    };
    const view = peopleView(state);
    assert.deepEqual(Object.keys(view).sort(), ['v', 'order', ...PEOPLE_KEYS].sort());
    const back = peopleState(view);
    assert.deepEqual(Object.keys(back).sort(), [...PEOPLE_KEYS].sort());
    assert.equal(back.turn, 3);
});

test('people view: only number or null clock keys are removed, at any depth', () => {
    const out = stripVolatile({
        updatedAt: 5, createdAt: null, archivedAt: 1, correctedAt: 2, at: 3,
        keep: { at: 'noon', updatedAt: '2026-01-01', deep: [{ at: 7, x: 1 }, { at: null }] },
        at2: 1, list: [{ createdAt: 9, id: 'k' }],
    });
    assert.deepEqual(out, { keep: { at: 'noon', updatedAt: '2026-01-01', deep: [{ x: 1 }, {}] }, at2: 1, list: [{ id: 'k' }] });
});

test('people view: strip drops undefined and copies (no shared references)', () => {
    const source = { a: undefined, b: { c: [1, { d: 2 }] } };
    const out = stripVolatile(source);
    assert.deepEqual(out, { b: { c: [1, { d: 2 }] } });
    out.b.c[1].d = 9;
    assert.equal(source.b.c[1].d, 2);
});

test('people view: records are keyed by id in order, input is untouched', () => {
    const state = { npcs: [rec('b', { updatedAt: 1 }), rec('a')], turn: 4 };
    const before = structuredClone(state);
    const view = peopleView(state);
    assert.deepEqual(view.order, ['b', 'a']);
    assert.deepEqual(view.npcs.b, { id: 'b', name: 'B' });
    assert.deepEqual(state, before);
    assert.equal(view.v, 1);
    assert.deepEqual(view.candidates, []);
    assert.deepEqual(view.socialGraph, {});
});

test('people view: deterministic output', () => {
    const state = { npcs: [rec('a', { z: 1, y: [1, 2] }), rec('b')], candidates: [{ name: 'q' }], turn: 2 };
    assert.equal(JSON.stringify(peopleView(state)), JSON.stringify(peopleView(structuredClone(state))));
});

test('people view: a missing or duplicate id gives null and a warning', () => {
    for (const npcs of [[rec('a'), { name: 'no id' }], [rec('a'), rec('a')], [rec('')], [null], [{ id: 5 }]]) {
        const warnings = [];
        assert.equal(peopleView({ npcs }, { warn: message => warnings.push(message) }), null);
        assert.equal(warnings.length, 1);
    }
    const warnings = [];
    assert.equal(peopleView(null, { warn: message => warnings.push(message) }), null);
    assert.equal(warnings.length, 1);
    assert.equal(peopleView({ npcs: [{}] }), null, 'no warn option needed');
});

test('people view: an empty or odd state gives an empty view', () => {
    const view = peopleView({ npcs: 'x', socialGraph: [], turn: NaN });
    assert.deepEqual(view, { v: 1, order: [], npcs: {}, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {}, turn: 0 });
});

test('people view: a malformed view gives null', () => {
    const good = peopleView({ npcs: [rec('a'), rec('b')] });
    assert.ok(peopleState(good));
    assert.equal(peopleState(null), null);
    assert.equal(peopleState({ ...good, v: 2 }), null);
    assert.equal(peopleState({ ...good, order: ['a'] }), null);
    assert.equal(peopleState({ ...good, order: ['a', 'a'] }), null);
    assert.equal(peopleState({ ...good, order: ['a', 'c'] }), null);
    assert.equal(peopleState({ ...good, npcs: [] }), null);
});

test('people view: state round-trips through the view in order', () => {
    const state = { npcs: [rec('b'), rec('a', { aliases: ['x'] })], candidates: [{ name: 'c' }], dismissed: ['d'], userDismissedGroups: [['g']], socialGraph: { edges: [1] }, portraitAssets: { a: 'f' }, turn: 7 };
    assert.deepEqual(peopleState(peopleView(state)), state);
});
