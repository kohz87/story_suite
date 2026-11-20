// A v1 fight's gear wear through the whole host: paid once at the settle, the same after swipe, Re-read, rewind and reload; the reply card's change list shows it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { equip, reply } from '../../inventory/gear-inventory.helpers.js';
import { rollReceipt } from '../helpers.js';
import { holdHost, stageFight } from './v1-hold.helpers.js';

const worn = host => Object.entries(host.sdk.query('inventory.gear', { owner: 'party' })?.slots ?? {}).map(([place, piece]) => `${place}:${piece?.cond}`);

async function fight(t, seed) {
    const restore = seedCrypto(seed);
    t.after(restore);
    const host = await holdHost(t, { count: 3, level: 8, settings: { rpgRolls: 'off' } });
    host.features.set('story-block.gear', true);
    await host.send('Kit.', reply('Kit.', ['+ item Traveling Robe | slot: body', '+ item Short Sword | slot: weapon']));
    await equip(host, 'Traveling Robe');
    await equip(host, 'Short Sword');
    const before = JSON.stringify(worn(host));
    stageFight(host, 8);
    await host.send('Go.', 'Done.');
    return { host, before, got: rollReceipt(host, host.ctx.chat.length - 1).data.v2.result };
}

test('wear is paid once at the settle: swipe, Re-read and rewind give the same state, and the narrator is told', async t => {
    let found = null;
    for (let seed = 1; seed < 30 && !found; seed += 1) {
        const made = await fight(t, seed);
        if (made.got.wear?.length) found = made; else made.host.close();
    }
    assert.ok(found, 'some seed has a decisive hit or miss');
    const { host, before, got } = found, at = host.ctx.chat.length - 1;
    assert.notEqual(JSON.stringify(worn(host)), before, 'the gear wore');
    assert.ok(got.wear.every(event => event.from !== event.to));
    const after = JSON.stringify(worn(host));
    await host.swipe('Done.');
    assert.equal(JSON.stringify(worn(host)), after, 'swipe: wears once, not twice');
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.equal(JSON.stringify(worn(host)), after, 'Re-read: the same');
    host.store.rebuild();
    assert.equal(JSON.stringify(worn(host)), after, 'rebuild: the same');
    const entry = host.store.receipts().filter(item => item.index === at).find(item => item.receipt.type === 'interaction.settle');
    assert.equal((await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev })).ok, true);
    assert.equal(JSON.stringify(worn(host)), before, 'rewind: the gear is as it was');
});

test('gear switched off after it was worn: the fight still settles (the record decides)', async t => {
    const restore = seedCrypto(3);
    t.after(restore);
    const host = await holdHost(t, { count: 3, level: 8, settings: { rpgRolls: 'off' } });
    host.features.set('story-block.gear', true);
    await host.send('Kit.', reply('Kit.', ['+ item Traveling Robe | slot: body']));
    await equip(host, 'Traveling Robe');
    host.features.set('story-block.gear', false);
    stageFight(host, 8);
    await host.send('Go.', 'Done.');
    const got = rollReceipt(host, host.ctx.chat.length - 1)?.data?.v2?.result;
    assert.ok(got, 'the fight settled');
    assert.equal(got.wear?.length > 0, true, 'the record decides: worn gear wears as it rolled');
});
