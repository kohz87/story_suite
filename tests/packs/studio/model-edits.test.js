// The four ops and the portrait step: pure (the input is never touched), all-or-nothing, refusals say why, key order is kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openDoc } from '../../../studio/model/doc.js';
import { apply, setPortrait } from '../../../studio/model/edits.js';

const ersveil = readFileSync(new URL('../../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8');
const base = () => openDoc({ doc: { id: 'p', name: 'P', list: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], tag: { x: 1, y: 2 } } });
const ok = (doc, patches) => { const r = apply(doc, patches); assert.ok(r.ok, r.refusal); return r.doc; };

test('set changes a field in place, adds a new key at the end, and never touches the input', () => {
    const doc = base();
    const before = JSON.stringify(doc);
    const next = ok(doc, [{ op: 'set', path: ['tag', 'x'], value: 9 }, { op: 'set', path: ['tag', 'z'], value: [1] }, { op: 'set', path: ['list', 1, 'id'], value: 'B' }]);
    assert.deepEqual(next.doc.tag, { x: 9, y: 2, z: [1] });
    assert.deepEqual(Object.keys(next.doc.tag), ['x', 'y', 'z']);
    assert.equal(next.doc.list[1].id, 'B');
    assert.equal(JSON.stringify(doc), before);
    assert.equal(next.doc.list[0], doc.doc.list[0], 'what did not change is shared');
});

test('insert, remove and move work on lists, and remove on object keys', () => {
    const ids = d => d.doc.list.map(item => item.id);
    let doc = ok(base(), [{ op: 'insert', path: ['list', 3], value: { id: 'd' } }, { op: 'insert', path: ['list', 0], value: { id: 'z' } }]);
    assert.deepEqual(ids(doc), ['z', 'a', 'b', 'c', 'd']);
    doc = ok(doc, [{ op: 'move', path: ['list', 0], to: 4 }]);
    assert.deepEqual(ids(doc), ['a', 'b', 'c', 'd', 'z']);
    doc = ok(doc, [{ op: 'move', path: ['list', 4], to: 1 }, { op: 'remove', path: ['list', 0] }, { op: 'remove', path: ['tag', 'x'] }]);
    assert.deepEqual(ids(doc), ['z', 'b', 'c', 'd']);
    assert.deepEqual(doc.doc.tag, { y: 2 });
});

test('a later patch sees the earlier one, and one refusal leaves the whole document as it was', () => {
    const doc = base();
    const r = apply(doc, [{ op: 'set', path: ['name'], value: 'Q' }, { op: 'remove', path: ['list', 7] }]);
    assert.equal(r.ok, false);
    assert.match(r.refusal, /nothing at 7/);
    assert.equal(doc.doc.name, 'P');
    assert.equal(ok(doc, [{ op: 'insert', path: ['list', 0], value: { id: 'n' } }, { op: 'set', path: ['list', 0, 'id'], value: 'm' }]).doc.list[0].id, 'm');
});

test('refusals: bad op, empty, no path, missing parent, not a list, out of range, not JSON, unsafe keys', () => {
    const doc = base();
    const bad = patches => assert.equal(apply(doc, patches).ok, false, JSON.stringify(patches));
    bad([]);
    bad(null);
    bad([{ op: 'swap', path: ['name'] }]);
    bad([{ op: 'set', path: [], value: 1 }]);
    bad([{ op: 'set', path: ['nope', 'x'], value: 1 }]);
    bad([{ op: 'set', path: ['name', 'x'], value: 1 }]);
    bad([{ op: 'set', path: ['list', 9], value: 1 }]);
    bad([{ op: 'set', path: ['list', '1'], value: 1 }]);
    bad([{ op: 'insert', path: ['tag', 'k'], value: 1 }]);
    bad([{ op: 'insert', path: ['list', 4], value: 1 }]);
    bad([{ op: 'move', path: ['list', 0], to: 3 }]);
    bad([{ op: 'move', path: ['tag', 'x'], to: 0 }]);
    bad([{ op: 'remove', path: ['tag', 'q'] }]);
    bad([{ op: 'set', path: ['name'], value: undefined }]);
    bad([{ op: 'set', path: ['name'], value: () => 1 }]);
    bad([{ op: 'set', path: ['name'], value: NaN }]);
    bad([{ op: 'set', path: ['__proto__'], value: 1 }]);
    bad([{ op: 'set', path: ['tag'], value: JSON.parse('{"__proto__":{"x":1}}') }]);
    assert.equal(apply({ doc: null }, [{ op: 'set', path: ['a'], value: 1 }]).ok, false);
    assert.equal({}.x, undefined);
});

test('a value is copied in: changing the caller\'s object later changes nothing', () => {
    const value = { id: 'n', keys: ['k'] };
    const doc = ok(base(), [{ op: 'insert', path: ['list', 0], value }]);
    value.keys.push('late');
    assert.deepEqual(doc.doc.list[0].keys, ['k']);
    assert.ok(Object.isFrozen(doc.doc.list[0].keys));
});

test('the same edit on the same document gives the same text; an unedited pack stays byte for byte', () => {
    const doc = openDoc({ text: ersveil });
    assert.equal(doc.text, ersveil);
    const patch = [{ op: 'set', path: ['name'], value: 'Renamed' }];
    const one = ok(doc, patch);
    assert.equal(one.text, ok(doc, patch).text);
    assert.equal(one.text, JSON.stringify({ ...JSON.parse(ersveil), name: 'Renamed' }, null, 2));
    assert.deepEqual(Object.keys(one.doc), Object.keys(JSON.parse(ersveil)));
    assert.equal(doc.text, ersveil);
});

test('portraits: add, replace in place, remove; pack.json text is not touched; bad names and bytes are refused', () => {
    const doc = openDoc({ text: ersveil, portraits: [{ name: 'a.png', bytes: new Uint8Array([1]) }] });
    let next = setPortrait(doc, 'b.png', new Uint8Array([2])).doc;
    next = setPortrait(next, 'a.png', new Uint8Array([3])).doc;
    assert.deepEqual(next.portraits.map(file => [file.name, file.bytes[0]]), [['a.png', 3], ['b.png', 2]]);
    assert.equal(next.text, ersveil);
    assert.equal(next.doc, doc.doc);
    assert.deepEqual(setPortrait(next, 'a.png', null).doc.portraits.map(file => file.name), ['b.png']);
    assert.equal(doc.portraits[0].bytes[0], 1);
    for (const [name, bytes] of [['', new Uint8Array([1])], ['x/y.png', new Uint8Array([1])], ['.hid', new Uint8Array([1])], ['c.png', []], ['c.png', new Uint8Array(0)]]) assert.equal(setPortrait(doc, name, bytes).ok, false);
    assert.match(setPortrait(doc, 'nope.png', null).refusal, /no portrait named/);
});
