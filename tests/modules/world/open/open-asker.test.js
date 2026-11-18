// The open-template asker's in-memory answers: kept per chat (a chat's answers and calls go only to that chat), and a transient failure on the retry
// keeps the first call's accepted answers and its call.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { openAsker, scopeOf } from '../../../../modules/world/chronicle/world-daily/open-ask.js';
import { dailyOf, ledgerOpen, open, openHost, reply, settle, slotRows, WORLD } from './open-host.helpers.js';

const begin = host => host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
const step = async (host, text, line) => { await host.send(text, reply(text, [line])); await settle(); };

test('answers and calls are handed only to the chat that asked: another chat or seed drains nothing; only the slots this chat has pending', async () => {
    const host = await openHost();
    const real = openAsker.drain.bind(openAsker);
    const seen = [];
    openAsker.drain = (scope, stored, wanted) => { seen.push(scope); return null; };
    await begin(host);
    await settle();
    await step(host, 'Hours pass.', '! time +1h');
    openAsker.drain = real;
    assert.equal(host.model.calls, 1, 'one call, asked ahead');
    const mine = seen.at(-1);
    assert.match(mine, /\|/, 'the scope is chat | seed');
    assert.equal(real(`${mine}-other-chat`, {}, null), null, 'another chat or seed gets nothing');
    assert.equal(real(mine, {}, new Set()), null, 'a slot this chat has not pending is not handed over');
    const ready = real(mine, {}, null);
    assert.equal(Object.keys(ready.results).length, 1, 'the chat that asked gets its answer');
    assert.equal(ready.calls, 1, 'with the call it made');
    assert.equal(real(mine, {}, null).calls, 0, 'the calls are counted once');
    assert.equal(scopeOf({ chatId: () => 'a' }, 's'), 'a|s');
    assert.notEqual(scopeOf({ chatId: () => 'a' }, 's'), scopeOf({ chatId: () => 'b' }, 's'));
    host.done();
});

test('a transient failure on the retry keeps the first call\'s accepted answer and its call; only the refused slot is asked again', async () => {
    const world = { ...WORLD, templates: [open('border-incident'), open('night-watch')] };
    const host = await openHost(undefined, world);
    host.model.mode = 'half';
    await begin(host);
    await settle();
    await step(host, 'Hours pass.', '! time +1h');
    await step(host, 'More hours.', '! time +1h');
    assert.ok(host.model.calls >= 2, 'the batch and the busy retry (asked again on later replies)');
    assert.equal(Object.keys(ledgerOpen(host).results ?? {}).length, 1, 'the accepted answer is stored, not thrown away');
    assert.equal(ledgerOpen(host).calls, 1, 'the first call is counted');
    host.model.mode = 'good';
    await step(host, 'Later.', '! time +1h');
    await step(host, 'Later still.', '! time +1h');
    await step(host, 'Later again.', '! time +1h');
    assert.equal(host.model.prompts.at(-1).match(/^Slot /gm).length, 1, 'only the refused slot was asked again');
    assert.deepEqual(slotRows(host).map(row => row.outcome).sort(), ['ok', 'ok']);
    assert.equal(ledgerOpen(host).calls, 2);
    host.done();
});

test('final review L6 (seam F1): beforeGenerate hands the drain the keys the look-ahead wants, so an answer for a slot no longer coming is never stored', async () => {
    const host = await openHost();
    const real = openAsker.drain.bind(openAsker);
    const wanted = [];
    openAsker.drain = (scope, stored, keys) => { wanted.push(keys); return real(scope, stored, keys); };
    try {
        await begin(host);
        await settle();
        const key = dailyOf(host).pending[0].key;
        await step(host, 'Hours pass.', '! time +1h');
        assert.ok(wanted.length >= 1);
        for (const keys of wanted) assert.deepEqual(keys instanceof Set ? [...keys] : keys, [key], 'the drain gets the wanted set: the waiting slot only');
        assert.deepEqual(Object.keys(ledgerOpen(host).results), [key], 'stored before the next reply (asked ahead after the first one, perf PB9)');
    } finally { openAsker.drain = real; host.done(); }
});
