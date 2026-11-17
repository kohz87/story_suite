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

test('E19: a middle delete of the message that holds the seed keeps the later steps\' seed; switch off mints nothing', async () => {
    const host = await newHost();
    await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    const seed = chronicle(host).worldSeed;
    await host.send('Day.', reply('Dawn.', ['! time +1d']));
    await host.send('Next.', reply('Noon.', ['! time +1d']));
    await host.st.deleteMessage(seedReceipts(host)[0].index + 1);
    assert.deepEqual(host.store.problems(), []);
    assert.equal(dailyOf(host).seed, seed, 'the later step keeps the seed it recorded');
    await agrees(host, 'middle delete');
    host.done();
    const off = await newHost(false);
    await off.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 pm']));
    await off.send('Day.', reply('Dawn.', ['! time +1d']));
    assert.equal('worldSeed' in chronicle(off), false);
    assert.deepEqual(seedReceipts(off), []);
    off.done();
});
