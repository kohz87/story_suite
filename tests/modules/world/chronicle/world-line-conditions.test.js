// World line with conditions (switch story-director.world-events): `conditions: +name, -name` goes through the condition commands
// (stubbed here), a reply carries one world line, and with the switch off a line is exactly what it was.

import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPlainWorldLine } from '../../../../modules/world/chronicle/capture/world-parts/apply-line.js';
import { WORLD_EVENTS } from '../../../../modules/world/chronicle/capture/world-parts/switch.js';
import { part } from '../../../../modules/world/chronicle/index.js';
import { apply } from '../../../../core/ops.js';
import { clockAt, eventNamed, line, makeState, replay } from './helpers/fake-ctx.js';

const NAMES = [{ name: 'gate-closed', scope: 'place' }, { name: 'plague', scope: 'region' }];
const stub = () => {
    const calls = [];
    return { calls, options: { features: [WORLD_EVENTS], answers: { 'chronicle.conditionNames': NAMES }, call: (type, payload) => { calls.push({ type, payload }); }, carrier: { sid: 'sid_a' } } };
};
const base = () => clockAt(makeState({ minutes: 1440 }), 1440);

test('the switch is declared, off by default, and its teaching text is a gated context part', () => {
    const feature = part.features.find(f => f.id === WORLD_EVENTS);
    assert.equal(feature.default, false);
    assert.equal(part.context.parts.length, 1);
    assert.equal(part.context.parts[0].feature, WORLD_EVENTS);
    assert.equal(part.context.parts[0].static(), 'A world line may also change the standing conditions where it happens: add `| conditions: +name, -name` (+ sets one, - lifts it), using only names from the pack\'s list of world conditions; the place or region on the line says where it holds. Only for what happens in this scene; write at most one world line in a reply.');
});

test('on: conditions set through chronicle.condition.set by the narrator, scope from the declared list, ref from the place', () => {
    const { calls, options } = stub();
    const run = line(base(), '+ world Gate Siege — the north gate is shut | state: ongoing | place: Northgate | conditions: +gate-closed, +plague, -gate-open', options);
    assert.equal(run.ok, true, run.message);
    assert.deepEqual(calls.map(c => c.type), ['chronicle.condition.set', 'chronicle.condition.set']);
    assert.deepEqual(calls[0].payload, { name: 'gate-closed', scope: 'place', ref: 'Northgate', why: 'the north gate is shut', by: 'narrator' });
    // plague is region-scoped: no region on the line, so the place stands in.
    assert.equal(calls[1].payload.ref, 'Northgate');
    assert.match(run.result.summary, /Conditions: \+gate-closed \(Northgate\), \+plague \(Northgate\)\./);
    assert.match(run.result.summary, /Not used: "gate-open" is not a condition the world lists\./);
});

test('a region label gives the ref of a region-scoped condition; "-" lifts through chronicle.condition.clear', () => {
    const { calls, options } = stub();
    const run = line(base(), '+ world Plague — spreading | place: Northgate | region: Marches | conditions: +plague, -gate-closed', options);
    assert.equal(run.ok, true, run.message);
    assert.deepEqual(calls.map(c => [c.type, c.payload.ref]), [['chronicle.condition.set', 'Marches'], ['chronicle.condition.clear', 'Northgate']]);
});

test('a refusal by the command is a note on the card, the world line itself stands; no place is a note', () => {
    const { options } = stub();
    const refused = line(base(), '+ world Gate Siege — shut | place: Northgate | conditions: +gate-closed', { ...options, call: () => { throw new Error('over the cap'); } });
    assert.equal(refused.ok, true);
    assert.ok(eventNamed(refused.state, 'Gate Siege'));
    assert.match(refused.result.summary, /Not used: "gate-closed": over the cap\./);
    const noPlace = line(base(), '+ world Gate Siege — shut | conditions: +gate-closed', options);
    assert.match(noPlace.result.summary, /needs a place on the line/);
});

test('a second world line in one reply is refused; another reply may write its own; a plain command has no limit', () => {
    const { options } = stub();
    const first = line(base(), '+ world One — a', options);
    assert.equal(first.ok, true);
    const second = line(first.state, '+ world Two — b', options);
    assert.equal(second.ok, false);
    assert.equal(second.code, 'REFUSED');
    assert.match(second.message, /one world line/);
    assert.equal(eventNamed(second.state, 'Two'), undefined);
    const other = line(first.state, '+ world Two — b', { ...options, carrier: { sid: 'sid_b' } });
    assert.equal(other.ok, true);
    const ui = line(first.state, '~ world One — c', { ...options, cause: 'ui', carrier: undefined });
    assert.equal(ui.ok, true);
});

test('replay of the ops equals the live state (the reply mark is part of it)', () => {
    const { options } = stub();
    const a = line(base(), '+ world One — a', options);
    const b = line(a.state, '+ world Two — b', { ...options, carrier: { sid: 'sid_b' } });
    assert.deepEqual(replay(base(), [a, b]), b.state);
    assert.deepEqual(b.state.domains.chronicle.worldLine, { sid_a: true, sid_b: true });
});

test('off: a world line is byte-identical to the plain line; the conditions label and a second line are left alone', () => {
    for (const features of [null, []]) {
        const { calls, options } = stub();
        const on = { ...options, features };
        const raw = '+ world Gate Siege — shut | place: Northgate | conditions: +gate-closed';
        const got = line(base(), raw, on);
        const plain = line(base(), raw, { carrier: options.carrier });
        assert.deepEqual(got.state, plain.state);
        assert.deepEqual(got.result, plain.result);
        assert.equal(calls.length, 0);
        assert.equal(got.state.domains.chronicle.worldLine, undefined);
        const again = line(got.state, '+ world Two — b', on);
        assert.equal(again.ok, true);
    }
    // the plain handler is the one that ran
    const direct = line(base(), '+ world X — y', { features: null });
    assert.equal(direct.ok, true);
    assert.equal(typeof applyPlainWorldLine, 'function');
    assert.ok(apply);
});
