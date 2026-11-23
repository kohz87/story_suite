import test from 'node:test';
import assert from 'node:assert/strict';
import { astraOf, reply, withAstra } from './helpers/host.js';
import { levelOf } from '../src/module-parts/standing.js';
import { astra } from './helpers/fake-ctx.js';
import { poolOf } from '../src/module-parts/effective.js';

const MAJOR = ['? try Astra | Lore | hard | threat: above you', '+ xp Party — a deed | size: major'];
const dropReply = async (host, at) => { await host.st.deleteMessage(at + 1); await host.st.deleteMessage(at); };
const sizes = host => [levelOf(astraOf(host)), poolOf(astraOf(host), 'mp').max, poolOf(astraOf(host), 'sp').max];

test('the pools follow the level: a level-up raises the size, a roll-back lowers it and what is left reads clamped; replay == live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        assert.deepEqual(sizes(host), [1, 11, 11], 'stats 6+6 and 7+7 at level 1');
        const at = host.ctx.chat.length;
        let sent = 0;
        while (levelOf(astraOf(host)) < 4 && sent < 12) {
            await host.send(`Deed ${sent}.`, reply(`Done ${sent}.`, MAJOR));
            sent += 1;
        }
        assert.deepEqual(sizes(host), [4, 12, 12], 'the fourth level adds one to each');
        assert.equal((await host.sdk.command('textRpg.rest', { kind: 'short' })).ok, true);
        assert.deepEqual([astraOf(host).pools.mp.now, astraOf(host).pools.sp.now], [12, 12], 'a rest fills to the new size');

        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'rebuild == live');

        for (let n = 0; n < sent; n += 1) await dropReply(host, at);
        assert.deepEqual(host.store.problems(), []);
        assert.deepEqual(sizes(host), [1, 11, 11], 'the level is back to 1 and so is the size');
        assert.deepEqual([poolOf(astraOf(host), 'sp').now, poolOf(astraOf(host), 'mp').now], [11, 11], 'what was left reads clamped to the smaller size');

        await host.send('Again.', reply('Again.', MAJOR));
        const again = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), again, 'rebuild == live after the roll-back');
    } finally {
        host.close();
    }
});

test('a member whose level is lost reads the pool clamped to the smaller size; the stored counter is kept', () => {
    const me = astra({ xp: 400 });
    assert.deepEqual([levelOf(me), poolOf(me, 'sp').max], [5, 15], 'level 5: 8 + 1 + (12 + 12)÷4');
    me.pools.sp.now = 15;
    me.xp = 0;
    assert.deepEqual([levelOf(me), poolOf(me, 'sp')], [1, { max: 14, now: 14 }]);
    assert.equal(me.pools.sp.now, 15);
});
