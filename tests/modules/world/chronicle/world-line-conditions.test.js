// World line with conditions (switch story-director.world-events): `conditions: +name, -name` goes through the real condition commands
// (job A's chronicle.condition.set / .clear and chronicle.conditionNames over the pack's list), a reply carries one world line, and with
// the switch off a line is exactly what it was.

import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPlainWorldLine } from '../../../../modules/world/chronicle/capture/world-parts/apply-line.js';
import { said } from '../../../../modules/world/chronicle/capture/world-parts/condition-check.js';
import { WORLD_EVENTS } from '../../../../modules/world/chronicle/capture/world-parts/switch.js';
import { part } from '../../../../modules/world/chronicle/index.js';
import { apply } from '../../../../core/ops.js';
import { clockAt, eventNamed, line, makeState, replay } from './helpers/fake-ctx.js';

const PACKS = {
    conditions: [{ name: 'gate-closed', scope: 'place', fades: 'until cleared', means: 'Shut.' }, { name: 'plague', scope: 'region', fades: '1 season', means: 'Sickness.' }],
    places: [{ name: 'Northgate', region: 'Marches' }, { name: 'Southgate', region: 'Marches' }],
    routes: [],
    list: [{ id: 'p', name: 'Ersveil' }],
};
// The real commands run on the same command's drafts, as the host's ctx.call runs them.
const stub = () => {
    const calls = [];
    const call = (type, payload, ctx) => { calls.push({ type, payload }); return part.commands[type](ctx, payload); };
    return { calls, options: { features: [WORLD_EVENTS], packs: PACKS, call, carrier: { sid: 'sid_a' } } };
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
    // plague is region-scoped: no region on the line, so the place's region (the store refuses a place as a region).
    assert.equal(calls[1].payload.ref, 'Marches');
    assert.deepEqual(Object.keys(run.state.domains.chronicle.conditions).sort(), ['gate-closed@Northgate', 'plague@Marches']);
    assert.match(run.result.summary, /Conditions: gate closed \(Northgate\), plague \(Marches\)\./);
    assert.deepEqual(run.result.data.conditions, ['+gate-closed (Northgate)', '+plague (Marches)'], 'the stored form is unchanged');
    assert.match(run.result.summary, /Not used: "gate-open" is not a condition the world lists\./);
});

test('a region label gives the ref of a region-scoped condition; "-" lifts through chronicle.condition.clear', () => {
    const { calls, options } = stub();
    const shut = line(base(), '+ world Gate Siege — shut | place: Northgate | conditions: +gate-closed', options);
    const run = line(shut.state, '+ world Plague — spreading | place: Northgate | region: Marches | conditions: +plague, -gate-closed', { ...options, carrier: { sid: 'sid_b' } });
    assert.equal(run.ok, true, run.message);
    assert.deepEqual(calls.slice(1).map(c => [c.type, c.payload.ref]), [['chronicle.condition.set', 'Marches'], ['chronicle.condition.clear', 'Northgate']]);
    assert.deepEqual(Object.keys(run.state.domains.chronicle.conditions), ['plague@Marches']);
});

test('what the command would refuse is a note on the card and is never called (a refused call fails the whole line on the host); no place is a note', () => {
    const { calls, options } = stub();
    const refused = line(base(), '+ world Gate Siege — shut | place: Farland | conditions: +gate-closed', options);
    assert.equal(refused.ok, true);
    assert.ok(eventNamed(refused.state, 'Gate Siege'));
    assert.match(refused.result.summary, /Not used: gate closed: "Farland" is not a place of this world\./);
    assert.equal(calls.length, 0);
    const undated = line(makeState(), '+ world Gate Siege — shut | place: Northgate | conditions: +gate-closed', options);
    assert.equal(undated.ok, true);
    assert.match(undated.result.summary, /the story has no date yet; a condition waits for one/);
    assert.equal(calls.length, 0);
    const noPlace = line(base(), '+ world Gate Siege — shut | conditions: +gate-closed', options);
    assert.match(noPlace.result.summary, /needs a place on the line/);
});

test('a second world line with conditions in one reply is refused (seam audit E38: only lines with conditions count); another reply may write its own; a plain command has no limit', () => {
    const { options } = stub();
    const first = line(base(), '+ world One — a | place: Northgate | conditions: +gate-closed', options);
    assert.equal(first.ok, true);
    const second = line(first.state, '+ world Two — b | place: Northgate | conditions: -gate-closed', options);
    assert.equal(second.ok, false);
    assert.equal(second.code, 'REFUSED');
    assert.match(second.message, /one world line with conditions/);
    assert.equal(eventNamed(second.state, 'Two'), undefined);
    const plain = line(first.state, '+ world Three — c', options);
    assert.equal(plain.ok, true, 'a world line without conditions is not capped');
    const other = line(first.state, '+ world Two — b | place: Northgate | conditions: -gate-closed', { ...options, carrier: { sid: 'sid_b' } });
    assert.equal(other.ok, true);
    const ui = line(first.state, '~ world One — c | place: Northgate | conditions: +gate-closed', { ...options, cause: 'ui', carrier: undefined });
    assert.equal(ui.ok, true);
});

test('replay of the ops equals the live state (the reply mark is part of it)', () => {
    const { options } = stub();
    const a = line(base(), '+ world One — a | place: Northgate | conditions: +gate-closed', options);
    const b = line(a.state, '+ world Two — b | place: Northgate | conditions: -gate-closed', { ...options, carrier: { sid: 'sid_b' } });
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

test('a refusal does not lead with the condition\'s slug: the sentence says it in words, or needs no name', () => {
    const { options } = stub();
    const far = line(base(), '+ world Gate Siege — shut | place: Farland | conditions: +gate-closed', options);
    assert.match(far.result.summary, /Not used: gate closed: "Farland" is not a place of this world\./);
    assert.doesNotMatch(far.result.summary, /gate-closed/);
    const bare = line(base(), '+ world Gate Siege — shut | conditions: +Gate-Closed', options);
    assert.match(bare.result.summary, /Not used: gate closed needs a place on the line/);
    assert.equal(said('the gates', 'gate-closed', 'shut today'), '"the gates": shut today', 'other words are quoted');
    assert.equal(said('rain', 'rain', 'Rainmoor already carries 8 conditions'), 'rain: Rainmoor already carries 8 conditions', 'named only as whole words');
});
