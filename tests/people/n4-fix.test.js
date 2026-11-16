import test from 'node:test';
import assert from 'node:assert/strict';
import { readStub, withStubs } from '../../modules/people/meters/npc-lines-parts/stub.js';
import { factFields } from '../../modules/people/meters/npc-lines-parts/facts.js';
import { fillPolicy, FILL_REASON } from '../../modules/people/meters/npc-lines-parts/fill-in.js';
import { normalizeAutomaticBackfillRequest } from '../../modules/people/calls/scan-context-parts/backfill-queue.js';

// N4 fix round: an empty role keeps its slot; the label readers run only in lines mode; a model error gets one queue retry.
test('an empty role keeps its slot: the look is not stored as the role', () => {
    assert.deepEqual(readStub({ raw: '+ npc Ilse || eyes: grey', name: 'Ilse' }), { name: 'Ilse', role: '', look: 'eyes: grey', problems: [] });
    assert.deepEqual(readStub({ name: 'Ilse', text: '; eyes: grey' }).look, 'eyes: grey');
    assert.equal(readStub({ name: 'Ilse', text: '; eyes: grey' }).role, '');
});

test('factFields reads gender, age and birthday only when asked; off keeps the line\'s text as written (as on main)', () => {
    const fields = { gender: 'woman', age: 'young' };
    assert.deepEqual(factFields(fields, {}, false), { set: { gender: 'woman', age: 'young' }, problems: [] });
    assert.deepEqual(factFields(fields, {}, true).set, { gender: 'female' });
    assert.deepEqual(factFields({ gender: 'Female' }, {}, false).set, { gender: 'Female' });
});

test('withStubs marks a line for the label readers only while lines mode is on', () => {
    const ctx = { read: key => (key === 'people' ? { npcs: { npc_oren: { name: 'Oren' } } } : {}), fail: (code, text) => { throw new Error(text); } };
    const seen = [];
    const handler = (c, line) => { seen.push(line.linesOn === true); return {}; };
    const line = { kind: 'npc', op: '~', name: 'Oren', raw: '~ npc Oren | gender: woman' };
    withStubs(handler, { hooks: {}, linesMode: () => false, baseline: () => ({}), note() {} })(ctx, line);
    withStubs(handler, { hooks: {}, linesMode: () => true, baseline: () => ({}), note() {} })(ctx, line);
    assert.deepEqual(seen, [false, true]);
});

test('a model error gets one queue retry, an answer that was not JSON does not; the queue keeps the kind', () => {
    assert.equal(fillPolicy({ reason: FILL_REASON }).max, 1);
    assert.equal(fillPolicy({ reason: FILL_REASON, lastError: 'json' }).max, 1);
    assert.equal(fillPolicy({ reason: FILL_REASON, lastError: 'call' }).max, 2);
    assert.equal(fillPolicy({ reason: 'new-admission', lastError: 'call' }).max, 3, 'the old reasons are unchanged');
    const raw = { queueVersion: 1, reason: FILL_REASON, npcId: 'npc_wiz', label: 'Wiz', lastError: 'call' };
    assert.equal(normalizeAutomaticBackfillRequest(raw).lastError, 'call');
    assert.equal('lastError' in normalizeAutomaticBackfillRequest({ ...raw, lastError: undefined }), false);
});
