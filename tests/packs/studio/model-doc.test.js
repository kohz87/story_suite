// The Studio document: the author's text until the first edit (byte for byte, key order kept), 2-space JSON after, frozen all the way
// down, portraits beside it, and a saved draft opens as the document it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloneJson, deepFreeze, derive, openDoc } from '../../../studio/model/doc.js';

const ersveil = readFileSync(new URL('../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8');
const deepFrozen = value => value === null || typeof value !== 'object' || value instanceof Uint8Array || (Object.isFrozen(value) && Object.values(value).every(deepFrozen));

test('an opened pack keeps the author\'s text and key order, and is frozen all the way down', () => {
    const doc = openDoc({ text: ersveil, portraits: [{ name: 'a.png', bytes: new Uint8Array([1]) }] });
    assert.equal(doc.text, ersveil);
    assert.deepEqual(Object.keys(doc.doc), Object.keys(JSON.parse(ersveil)));
    assert.ok(deepFrozen(doc) && Object.isFrozen(doc.portraits[0]));
    assert.throws(() => { 'use strict'; doc.doc.id = 'x'; }, TypeError);
});

test('a document made from a parsed pack is written as 2-space JSON; one from a draft keeps its text', () => {
    assert.equal(openDoc({ doc: { b: 1, a: [2] } }).text, '{\n  "b": 1,\n  "a": [\n    2\n  ]\n}');
    const draft = openDoc({ text: '{"id":"x"}', doc: { id: 'x' }, portraits: [] });
    assert.equal(draft.text, '{"id":"x"}');
    assert.deepEqual(openDoc(JSON.parse(JSON.stringify({ text: draft.text, doc: draft.doc }))), draft);
});

test('a pack that is not JSON opens with no parsed pack', () => {
    assert.equal(openDoc({ text: '{nope' }).doc, null);
});

test('derive: a changed pack is written as 2-space JSON; only portraits changing leaves the text alone', () => {
    const base = openDoc({ text: ersveil });
    const edited = derive(base, { doc: { ...base.doc, name: 'New' } });
    assert.equal(edited.text, JSON.stringify(edited.doc, null, 2));
    assert.notEqual(edited.text, base.text);
    const withImage = derive(base, { portraits: [{ name: 'p.png', bytes: new Uint8Array([9]) }] });
    assert.equal(withImage.text, ersveil);
    assert.equal(withImage.doc, base.doc);
    assert.equal(base.portraits.length, 0);
});

test('cloneJson copies, deepFreeze freezes once and leaves frozen parts alone', () => {
    const source = { a: [{ b: 1 }] };
    const copy = cloneJson(source);
    assert.notEqual(copy.a, source.a);
    assert.deepEqual(copy, source);
    assert.ok(deepFrozen(deepFreeze(copy)));
    assert.ok(!Object.isFrozen(source));
});
