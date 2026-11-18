// Undo and redo over snapshots: the same objects come back, a new edit drops the redo steps, the depth is capped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDoc } from '../../../studio/model/doc.js';
import { apply } from '../../../studio/model/edits.js';
import { createHistory, record, redo, undo } from '../../../studio/model/history.js';

const edit = (doc, name) => apply(doc, [{ op: 'set', path: ['name'], value: name }]).doc;

test('undo and redo walk the snapshots and hand back the very same objects', () => {
    const a = openDoc({ text: '{"name":"A"}' });
    const b = edit(a, 'B');
    const c = edit(b, 'C');
    let h = record(record(createHistory(a), b), c);
    assert.deepEqual([h.present, h.canUndo, h.canRedo], [c, true, false]);
    h = undo(undo(h));
    assert.equal(h.present, a);
    assert.equal(h.present.text, '{"name":"A"}', 'undoing every edit gives the author\'s text again');
    assert.deepEqual([h.canUndo, h.canRedo], [false, true]);
    assert.equal(redo(redo(h)).present, c);
});

test('undo with nothing before and redo with nothing after change nothing', () => {
    const h = createHistory(openDoc({ doc: { name: 'A' } }));
    assert.equal(undo(h), h);
    assert.equal(redo(h), h);
});

test('a new edit after an undo drops the redo steps; recording the same snapshot is no step', () => {
    const a = openDoc({ doc: { name: 'A' } });
    let h = record(createHistory(a), edit(a, 'B'));
    h = undo(h);
    assert.equal(record(h, a), h);
    h = record(h, edit(a, 'Z'));
    assert.equal(h.canRedo, false);
    assert.equal(h.present.doc.name, 'Z');
    assert.equal(undo(h).present, a);
});

test('a history is frozen and the oldest steps go past the limit', () => {
    const a = openDoc({ doc: { name: 'A' } });
    let h = createHistory(a, 3);
    for (const n of ['1', '2', '3', '4', '5']) h = record(h, edit(h.present, n));
    assert.ok(Object.isFrozen(h) && Object.isFrozen(h.past));
    assert.equal(h.past.length, 3);
    assert.equal(undo(undo(undo(h))).present.doc.name, '2');
});
