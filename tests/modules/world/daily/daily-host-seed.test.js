// The campaign seed on the host (seam audit E19): minted once before the first reply (claim `world:seed`, stored on the message
// before it), so a swipe or an edited Re-read of the reply that took the first step keeps the seed and the rolls; a Continue
// steps nothing twice and adds no second fallback hour (E20); with the switch off nothing is minted.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { agrees, chronicle, dailyOf, dailyReceipts, newHost, reply, world } from './daily-host.helpers.js';

const seedReceipts = host => host.sdk.receipts().filter(entry => entry.receipt.type === 'chronicle.world.seed');

test('E19: the seed is minted once before the first reply; a swipe and an edited Re-read of the first-step reply keep it (and the world)', async () => {
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    const first = host.ctx.chat.length - 1;
    assert.ok(dailyReceipts(host).some(entry => entry.index === first), 'the first reply takes the first step');
    const seed = chronicle(host).worldSeed;
    assert.match(seed, /^[0-9a-f]{16}$/);
    assert.equal(dailyOf(host).seed, seed, 'the step uses the minted seed');
    assert.deepEqual(seedReceipts(host).map(entry => entry.index), [0], 'stored on the message before the reply (the greeting)');
    const before = world(host);
    for (const text of ['Dust, grey.', 'Dust, red.', 'Dust, cold.']) {
        await host.swipe(reply(text, ['~ time June 3, 1200, 08:00 pm']));
        assert.equal(dailyOf(host).seed, seed, `a swipe of the first-step reply keeps the seed (${text})`);
        assert.equal(world(host), before, 'and the world');
    }
    await agrees(host, 'swiped');
    await host.st.swipeTo(first, 0);
    assert.equal(world(host), before, 'swipe back');
    await host.send('Rest.', reply('A quiet night.', ['! time +2d']));
    await host.st.editMessage(first, reply('Dust.', ['~ time June 4, 1200, 08:00 pm']));
    assert.equal((await host.sdk.reread(first)).ok, true);
    assert.equal(dailyOf(host).seed, seed, 'an edited Re-read of the first-step reply keeps the seed');
    assert.equal(seedReceipts(host).length, 1, 'minted once');
    await agrees(host, 'edited Re-read');
    host.done();
});

test('E19: switched on mid-chat, the seed rides on the last reply before the next one; deleting that reply keeps the later steps\' seed', async () => {
    const host = await newHost(false);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    host.features.set('story-director.world-events', true);
    const carrier = host.ctx.chat.length - 1;
    await host.send('Next.', reply('Noon.', ['! time +1d']));
    assert.deepEqual(seedReceipts(host).map(entry => entry.index), [carrier], 'minted on the last reply before the first one with the switch on');
    const seed = chronicle(host).worldSeed;
    assert.equal(dailyOf(host).seed, seed);
    await host.send('Later.', reply('Days pass.', ['! time +2d']));
    const before = JSON.stringify(dailyOf(host));
    await host.st.deleteMessage(carrier);
    assert.deepEqual(host.store.problems(), []);
    assert.equal(JSON.stringify(dailyOf(host)), before, 'the later steps keep their records and seed');
    assert.equal(chronicle(host).worldSeed, undefined, 'the minted seed went with its reply');
    await agrees(host, 'carrier deleted');
    await host.send('Again.', reply('Another day.', ['! time +1d']));
    assert.equal(seedReceipts(host).length, 1, 'minted again (the claim went with the reply)');
    assert.equal(dailyOf(host).seed, seed, 'the step keeps the seed its state recorded, not the new one');
    await agrees(host, 'after re-mint');
    host.done();
});

test('E19 (known edge, pinned): switched on mid-chat and the next generation is a swipe of the last reply → the seed rides on that reply, so each swipe mints anew', async () => {
    const host = await newHost(false);
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    host.features.set('story-director.world-events', true);
    const last = host.ctx.chat.length - 1;
    await host.swipe(reply('Dawn, grey.', ['! time +1d']));
    const first = chronicle(host).worldSeed;
    assert.deepEqual(seedReceipts(host).map(entry => entry.index), [last]);
    await host.swipe(reply('Dawn, red.', ['! time +1d']));
    assert.notEqual(chronicle(host).worldSeed, first, 'a new seed with the new swipe (no world day was kept before it)');
    await agrees(host, 'swiped after switch-on');
    host.done();
});

test('E19: with the switch off nothing is minted', async () => {
    const off = await newHost(false);
    await off.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await off.send('Day.', reply('Dawn.', ['! time +1d']));
    assert.equal('worldSeed' in chronicle(off), false);
    assert.deepEqual(seedReceipts(off), []);
    off.done();
});
