// `until: N hours` is real: a timed condition ends at its minute; the tail, the floor and a `? try` read only the live ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTry } from '../src/module-parts/kinds/try.js';
import { beforeGenerate } from '../src/module-parts/hooks.js';
import { liveConditions } from '../src/module-parts/conditions.js';
import { tailOf } from '../src/module-parts/tail.js';
import { astra, fakeCtx, line, run, sliceOf, SID } from './helpers/fake-ctx.js';

const timed = (until = 720) => astra({ conditions: [{ name: 'poisoned', until }, { name: 'stunned', until: 'treated' }] });
const viewOf = (slice, minutes) => ({
    feature: id => id === 'text-rpg.on', query: name => (name === 'textRpg.dice' ? slice.dice[SID] ?? null : null),
    state: { domains: { textRpg: slice, ...(minutes === undefined ? {} : { director: { time: { minutes } } }) } },
});

test('liveConditions drops a timed condition at its minute, keeps treated ones, and keeps all when the time is unknown', () => {
    const me = timed();
    assert.deepEqual(liveConditions(me, 719).map(item => item.name), ['poisoned', 'stunned']);
    assert.deepEqual(liveConditions(me, 720).map(item => item.name), ['stunned']);
    assert.deepEqual(liveConditions(me, null).map(item => item.name), ['poisoned', 'stunned']);
});

test('the tail lists only the conditions still on', () => {
    const slice = sliceOf([timed()], null);
    assert.match(tailOf(viewOf(slice, 700)).lines[0], /Conditions: poisoned, stunned$/);
    assert.match(tailOf(viewOf(slice, 800)).lines[0], /Conditions: stunned$/);
});

test('a ? try counts only live conditions toward the floor', () => {
    const attempt = time => {
        const member = timed();
        const slice = sliceOf([member], { list: [15, 10, 10], floor: 0 });
        return run(applyTry, fakeCtx(slice, { time }), line('try', member.name, 'Lore; easy')).result.data;
    };
    assert.equal(attempt(700).difficulty, 2, 'two live conditions raise easy to the floor of two');
    assert.equal(attempt(800).difficulty, 1, 'one is left');
    assert.equal(attempt(null).difficulty, 2, 'no clock: all of them hold');
});

test('the dice step\'s floor counts only live conditions', () => {
    const floorAt = minutes => beforeGenerate(viewOf(sliceOf([timed()], null), minutes), { type: 'normal' }).commands[0].payload.floor;
    assert.equal(floorAt(700), 2);
    assert.equal(floorAt(800), 1);
});
