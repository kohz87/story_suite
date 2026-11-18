// Open templates on the real host: the slot waits one reply for its answer, is applied from the stored result, and a call-ahead answer is applied
// the moment the day crosses. One batched call per slot set; the call count is in the ledger.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, dailyOf, ledgerOpen, openHost, open, reply, settle, slotRows, WORLD, chronicle } from './open-host.helpers.js';

const begin = host => host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
const step = async (host, text, line) => { await host.send(text, reply(text, [line])); await settle(); };

test('a slot rolled on the first day waits for its answer; the next reply stores it and applies it; one call, counted in the ledger', async () => {
    const host = await openHost();
    await begin(host);
    await settle();
    assert.equal(dailyOf(host).pending.length, 1, 'rolled, nothing stored: the slot waits (the reply was not held up)');
    assert.equal(slotRows(host)[0].outcome, 'waiting');
    assert.equal(chronicle(host).conditions?.['unrest@Highmark'], undefined, 'nothing applied yet');
    assert.equal(host.model.calls, 1, 'asked ahead right after the first reply, from the state its step left (perf PB9: afterReceive)');
    await step(host, 'Hours pass.', '! time +1h');
    assert.ok(Object.keys(ledgerOpen(host).results).length === 1, 'the answer is stored in the message before the next reply');
    assert.equal(dailyOf(host).pending, undefined, 'and settled on that reply');
    const [row] = slotRows(host);
    assert.deepEqual([row.outcome, row.name, row.people], ['ok', 'Border scuffle', ['warden']]);
    assert.ok(chronicle(host).conditions['unrest@Highmark'], 'the menu-picked condition is set');
    assert.equal(dailyOf(host).standings['power:crown'], 47, 'the power moved by the answer');
    assert.equal(dailyOf(host).facts['incident-noted'].text, 'Soldiers scuffle at the gate.', 'the fact the template writes');
    assert.equal(ledgerOpen(host).calls, 1);
    assert.equal(Object.keys(ledgerOpen(host).results).length, 1);
    assert.equal(host.model.calls, 1, 'no second call');
    await agrees(host, 'settled');
    host.done();
});

test('a slot answered ahead is applied on the day it crosses, with no waiting', async () => {
    const world = { ...WORLD, templates: [open('border-incident'), open('night-watch', { needs: ['unrest@place'], where: { kinds: ['town'] } })] };
    const host = await openHost(undefined, world);
    await begin(host);
    await settle();
    await step(host, 'Hours pass.', '! time +1h');
    await step(host, 'More hours.', '! time +1h');
    assert.ok(chronicle(host).conditions['unrest@Highmark']);
    await step(host, 'Still the same day.', '! time +1h');
    assert.equal(host.model.calls, 2, 'the second template\'s slot for tomorrow was asked ahead');
    await step(host, 'Another hour.', '! time +1h');
    const before = host.model.calls;
    await host.send('Next day.', reply('Dawn.', ['! time +1d']));
    const crossed = slotRows(host).find(row => row.template === 'night-watch');
    assert.ok(crossed, 'the second slot rolled on the crossing day');
    assert.equal(crossed.outcome, 'ok', 'applied at once from the stored answer');
    assert.equal(dailyOf(host).pending, undefined);
    assert.equal(host.model.calls, before, 'no further call');
    await agrees(host, 'call ahead');
    host.done();
});

test('a refused answer gets one retry with the errors; a second refusal or a failed call applies the fallback; the problem is shown', async () => {
    for (const [mode, outcome, calls] of [['bad-first', 'retry', 2], ['bad', 'fallback', 2], ['fail', 'fallback', 1]]) {
        const host = await openHost();
        host.model.mode = mode;
        await begin(host);
        await settle();
        await step(host, 'Hours pass.', '! time +1h');
        await step(host, 'More hours.', '! time +1h');
        assert.equal(slotRows(host)[0].outcome, outcome, mode);
        assert.equal(host.model.calls, calls, `${mode}: calls`);
        assert.equal(ledgerOpen(host).calls, calls, `${mode}: the ledger counts every call (a retry too)`);
        if (mode !== 'fail') assert.match(host.model.prompts[1] ?? '', /refused|Border|moves|number/i);
        if (outcome === 'fallback') {
            assert.ok(chronicle(host).conditions['unrest@Highmark'], 'the fallback\'s own effect keys');
            assert.equal(dailyOf(host).standings['power:crown'], 50, 'nothing the Director picked');
        }
        assert.ok(host.turn.problems().some(item => /open template/.test(item.message)), `${mode}: shown in Problems`);
        host.done();
    }
});

test('a busy model is not a failure: the slot is asked again on a later reply', async () => {
    const host = await openHost();
    host.model.mode = 'busy';
    await begin(host);
    await settle();
    await step(host, 'Hours pass.', '! time +1h');
    await step(host, 'More hours.', '! time +1h');
    assert.equal(dailyOf(host).pending.length, 1, 'still waiting, no fallback');
    host.model.mode = 'good';
    await step(host, 'Later.', '! time +1h');
    await step(host, 'Later still.', '! time +1h');
    await step(host, 'Later again.', '! time +1h');
    assert.equal(slotRows(host)[0].outcome, 'ok');
    host.done();
});

test('two slots of one day are answered in one batched call', async () => {
    const world = { ...WORLD, templates: [open('border-incident'), open('night-watch')] };
    const host = await openHost(undefined, world);
    await begin(host);
    await settle();
    assert.equal(dailyOf(host).pending.length, 2, 'two slots rolled on the first day');
    await step(host, 'Hours pass.', '! time +1h');
    assert.equal(host.model.calls, 1, 'one call for both');
    assert.equal(host.model.prompts[0].match(/^Slot /gm).length, 2);
    assert.match(host.model.prompts[0], /Happening: border-incident/);
    assert.equal(host.model.requests[0].role, 'quick', 'on the Quick profile');
    await step(host, 'More hours.', '! time +1h');
    assert.deepEqual(slotRows(host).map(row => row.outcome), ['ok', 'ok']);
    assert.equal(ledgerOpen(host).calls, 1);
    host.done();
});
