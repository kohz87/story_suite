// The Director judge on tomorrow's daily roll (switch story-director.world-events): with the chronicle setting `judge` the events the roll will fire
// are asked about once a day and a refusal holds one back for that day (it rolls again the next); with the arc setting `dailyPass` every eligible
// event is asked about and may be made likelier or less likely. Only stored marks are read: swipes, a rebuild and a reload roll the same way.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { markedChance } from '../../../../modules/world/daily/director-mark.js';
import { SPEC, agrees, daily, day, event, marks, rollHost, rollModel } from './roll-judge.helpers.js';
import { reply, settle } from './judge-host.helpers.js';

test('judge: the event tomorrow\'s roll fires is asked about once; a refusal holds it back that day, it fires the next; replay rolls the same', async () => {
    const model = rollModel(['1: refuse: the Watch keeps Highmark quiet this week', '1: accept']);
    const host = await rollHost(model, { 'chronicle.judge': true });
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        const first = daily(host).day;
        await day(host, 'Day 1.');
        const day1 = first + 1;
        assert.deepEqual(marks(host)[`riot|${day1}`], { veto: 'the Watch keeps Highmark quiet this week' }, 'the refusal is stored before the crossing reply');
        assert.equal(daily(host).events.riot.state, 'eligible', 'held back, still eligible');
        assert.match(model.prompts[0].prompt, /Items:\n1: The riot — A riot in Highmark\. \| place: Highmark$/);
        assert.doesNotMatch(model.prompts[0].system, /likelier/, 'only the pass may weight');
        await day(host, 'Day 2.');
        assert.equal(daily(host).events.riot.fired, day1 + 1, 'the next day it fires');
        assert.equal(model.calls, 2, 'one call a day');
        assert.equal(host.sdk.query('chronicle.directorCalls', {}).count, 2);
        const recorded = JSON.stringify(daily(host));
        await host.swipe(reply('Day 2, again.', ['! time +1d']));
        await settle();
        assert.equal(JSON.stringify(daily(host)), recorded, 'a swipe of the crossing reply rolls the same');
        assert.equal(model.calls, 2, 'a swipe asks nothing');
        const crossing = host.ctx.chat.findIndex(message => !message.is_user && message.mes.startsWith('Day 1.'));
        assert.equal((await host.sdk.reread(crossing)).ok, true);
        assert.equal(JSON.stringify(daily(host)), recorded, 'a Re-read of the vetoed day\'s reply: the stored veto holds, the same rolls');
        await settle();
        assert.equal(model.calls, 2, 'a Re-read asks nothing');
        await agrees(host, 'judged roll');
    } finally { host.done(); }
});

test('daily pass: every eligible event is asked about, "likelier" doubles its odds for that day; the settings off: no call', async () => {
    const spec = { ...SPEC, events: [event('omen', '10% over the window')] };
    const model = rollModel(['1: likelier']);
    const host = await rollHost(model, { 'arc.dailyPass': true }, spec);
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await day(host, 'Day 1.');
        const day1 = daily(host).day;
        assert.deepEqual(marks(host)[`omen|${day1}`], { weight: 2 });
        assert.match(model.prompts[0].system, /<n>: likelier/);
        assert.equal(daily(host).events.omen.fired, undefined, 'a weight changes the odds, never fires by itself');
        await agrees(host, 'daily pass');
    } finally { host.done(); }
    const quiet = rollModel(['1: refuse: no']);
    const off = await rollHost(quiet, {});
    try {
        await off.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await day(off, 'Day 1.');
        await day(off, 'Day 2.');
        assert.equal(quiet.calls, 0, 'neither setting on: nothing is asked');
        assert.ok(daily(off).events.riot.fired !== undefined, 'the roll is code\'s alone');
    } finally { off.done(); }
});

test('the mark on one roll: a veto discards it, a weight scales the odds, set-in-motion and other days are untouched', () => {
    const ws = { directorMarks: { 'omen|5': { weight: 2 }, 'riot|5': { veto: 'quiet' }, 'levy|5': { veto: 'no' } } };
    const chance = { p: 0.2, blocked: false };
    const odds = p => p / (1 - p);
    const weighted = markedChance(ws, { id: 'omen', certainty: 'possible' }, 5, chance);
    assert.ok(Math.abs(odds(weighted.chance.p) / odds(0.2) - 2) < 1e-9);
    assert.deepEqual(markedChance(ws, { id: 'riot', certainty: 'likely' }, 5, chance), { chance, veto: 'quiet' });
    assert.deepEqual(markedChance(ws, { id: 'levy', certainty: 'set-in-motion' }, 5, chance), { chance, veto: '' }, 'a set-in-motion event is never held back');
    assert.deepEqual(markedChance(ws, { id: 'omen', certainty: 'possible' }, 6, chance), { chance, veto: '' }, 'another day: no mark');
});

test('a verdict that comes after its day was stepped is dropped: a swipe of the crossing reply rolls that day as the first reply did', async () => {
    let release = null;
    const gate = new Promise(resolve => { release = resolve; });
    const model = rollModel(['1: refuse: too late to matter']);
    const slow = { calls: 0, prompts: [], async callModel(request) { if (request.module === 'story-director roll judge') await gate; const out = await model.callModel(request); slow.calls = model.calls; return out; } };
    const host = await rollHost(slow, { 'chronicle.judge': true });
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
        await settle();
        await host.send('Day 1.', reply('Day 1.', ['! time +1d']));
        const day1 = daily(host).day;
        assert.equal(daily(host).events.riot.fired, day1, 'no answer in time: the roll is code\'s, the riot fires');
        release();
        await settle();
        assert.equal(model.calls >= 1, true, 'the call did answer, late');
        const recorded = JSON.stringify(daily(host));
        await host.swipe(reply('Day 1, again.', ['! time +1d']));
        assert.equal(marks(host)[`riot|${day1}`], undefined, 'the late veto is never stored');
        assert.equal(JSON.stringify(daily(host)), recorded, 'the swipe rolls the same');
        await agrees(host, 'late verdict');
    } finally { host.done(); }
});
