import test from 'node:test';
import assert from 'node:assert/strict';
import { astraOf, reply, withAstra } from './helpers/host.js';
import { levelOf, pointsOf } from '../src/module-parts/standing.js';
import { effectiveStats, poolOf } from '../src/module-parts/effective.js';

const MAJOR = ['+ foes Ogres | count: 1 | kind: elite', '? try Astra | Lore | hard', '+ xp Party — a deed'];
const dropReply = async (host, at) => { await host.st.deleteMessage(at + 1); await host.st.deleteMessage(at); };

async function levelFour(host) {
    for (const text of ['One.', 'Two.']) await host.send(text, reply('Told.', MAJOR));
    const at = host.ctx.chat.length;
    await host.send('Three.', reply('Told.', MAJOR));
    await host.send('Rest.', reply('Quiet.'));
    return at;
}

test('a purchase that does not fit waits, and a later smaller one still counts: the free point is usable after a level loss', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        const at = await levelFour(host);
        assert.equal(levelOf(astraOf(host)), 4);
        const spend = stats => host.sdk.command('textRpg.spend', { member: 'Astra', stats });
        assert.equal((await spend({ str: 1 })).ok, true);
        assert.equal((await spend({ int: 2 })).ok, true);
        assert.equal(pointsOf(astraOf(host)), 0);

        await dropReply(host, at);
        const me = () => astraOf(host);
        assert.deepEqual([levelOf(me()), effectiveStats(me()).str, effectiveStats(me()).int, pointsOf(me())], [3, 8, 6, 1], 'the first counts, the second waits, one point is free');
        assert.equal((await spend({ dex: 1 })).ok, true);
        assert.deepEqual([effectiveStats(me()).dex, pointsOf(me())], [8, 0], 'the later, smaller purchase counts and the point is spent');
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'rebuild == live');
    } finally {
        host.close();
    }
});

test('a skill cost after a purchase stops counting is taken from the pool as it reads, not from the stored excess', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        const at = await levelFour(host);
        assert.equal((await host.sdk.command('textRpg.spend', { member: 'Astra', stats: { agi: 3 } })).ok, true);
        const grown = poolOf(astraOf(host), 'sp');
        await dropReply(host, at);
        const lost = poolOf(astraOf(host), 'sp');
        assert.ok(lost.max < grown.max && lost.now === lost.max, 'the pool shrank and reads full');
        await host.send('Five.', reply('Told.', ['~ spend Astra — Obscure']));
        assert.equal(poolOf(astraOf(host), 'sp').now, lost.max - 2, 'the cost is not free');
    } finally {
        host.close();
    }
});
