// The long-skip note at the default longest jump (seam audit E16: above 14 stepped days, or the reader's longest jump when lower)
// and a Continue (E20): the day records are kept by the watermark, so a Continue steps no day twice and adds no second fallback hour.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, dailyOf, dailyReceipts, newHost, reply, SPEC, world } from './daily-host.helpers.js';

const minutes = host => host.head().domains.director.time.minutes;
const advances = host => host.sdk.receipts().filter(entry => entry.receipt.type === 'director.advance' && entry.receipt.data.cause === 'world-clock');

test('E16: with the default longest jump (30 days) a 20-day skip shows "20 world days simulated"; 14 days do not', async () => {
    const host = await newHost(true, SPEC, {});
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    const day = dailyOf(host).day;
    await host.send('Skip.', reply('Three weeks on.', ['! time +20d']));
    const step = dailyReceipts(host).at(-1).receipt;
    assert.deepEqual([step.data.from, step.data.to, step.data.days], [day + 1, day + 20, 20], 'every day stepped, one by one');
    assert.match(step.summary, /20 world days simulated/);
    await host.send('Fortnight.', reply('Two weeks on.', ['! time +14d']));
    assert.equal(dailyReceipts(host).at(-1).receipt.data.days, 14);
    assert.doesNotMatch(dailyReceipts(host).at(-1).receipt.summary, /world days simulated/);
    await agrees(host, 'default skips');
    host.done();
});

test('E20: a Continue after a day-crossing reply steps nothing again; after a fallback reply it adds no second hour; with a new time line it steps the new day', async () => {
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    const stepped = dailyReceipts(host).length;
    const before = world(host);
    await host.cont(' The bells ring.');
    assert.equal(dailyReceipts(host).length, stepped, 'no second step');
    assert.equal(world(host), before, 'the world as it was');
    await agrees(host, 'continue after a crossing');
    await host.send('Rest.', reply('A quiet afternoon.'));
    const at = minutes(host);
    assert.equal(advances(host).length, 1);
    await host.cont(' Still quiet.');
    assert.equal(advances(host).length, 1, 'no second fallback hour');
    assert.equal(minutes(host), at);
    await host.cont(reply(' Night falls and passes.', ['! time +1d']));
    assert.equal(dailyReceipts(host).length, stepped + 1, 'a Continue that crosses a day steps it, once');
    assert.equal(dailyOf(host).day, Math.floor(minutes(host) / 1440));
    await agrees(host, 'continue');
    host.done();
});
