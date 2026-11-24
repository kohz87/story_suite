// `~ rest Who — short | night | day`: the story line that refills mana and stamina (a day also heals); one rule with `textRpg.rest`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { astraOf, reply, slice, withAstra } from './helpers/host.js';

const quiet = t => t.mock.method(console, 'warn', () => {});
const full = member => member.pools.mp.now === member.pools.mp.max && member.pools.sp.now === member.pools.sp.max;
const sound = host => { const live = JSON.stringify(slice(host)); host.store.rebuild(); assert.equal(JSON.stringify(slice(host)), live, 'rebuild == live'); assert.deepEqual(host.store.problems(), []); };
// Spends stamina (Obscure costs 2) and sets the health stage Hurt (wounds 2) through the story, so each is a real receipt.
const hurt = async host => { await host.send('Ouch.', reply('A blow.', ['~ spend Astra — Obscure', '~ health Astra — Hurt'])); assert.deepEqual([full(astraOf(host)), astraOf(host).wounds], [false, 2]); };

test('short and night refill mana and stamina and leave wounds; day also heals a stage', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    for (const kind of ['short', 'night']) {
        await hurt(host);
        await host.send('Rest.', reply('You rest.', [`~ rest Astra — ${kind}`]));
        assert.equal(full(astraOf(host)), true, kind);
        assert.equal(astraOf(host).wounds, 2, `${kind} heals nothing`);
    }
    await hurt(host);
    await host.send('A day.', reply('A day passes.', ['~ rest Astra — day']));
    assert.deepEqual([full(astraOf(host)), astraOf(host).wounds], [true, 1]);
    sound(host);
});

test('Party rests everyone who plays; a name rests that one; a bad word or name changes nothing', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await hurt(host);
    await host.send('Rest.', reply('Rest.', ['~ rest Zed — night', '~ rest Astra — nap']));
    assert.equal(full(astraOf(host)), false);
    await host.send('Rest.', reply('Rest.', ['~ rest Party — night']));
    assert.equal(full(astraOf(host)), true);
    const receipt = host.store.receipts().map(entry => entry.receipt).filter(r => r.type === 'capture.rest').at(-1);
    assert.match(receipt.summary, /^The party rests the night: mana and stamina full/);
});

test('foes standing refuse the rest and nothing changes; with the foes gone it works', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await hurt(host);
    await host.send('Fight.', reply('Bandits.', ['+ foes Bandits | count: 2 | kind: common', '~ rest Astra — day']));
    assert.deepEqual([full(astraOf(host)), astraOf(host).wounds], [false, 2]);
    await host.send('Flee.', reply('They go.', ['- foes Bandits', '~ rest Astra — night']));
    assert.equal(full(astraOf(host)), true);
});

test('a swipe, a Re-read, a middle delete and a rebuild give the same pools', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('One.', reply('A.', ['~ rest Astra — night']));
    const middleAt = host.ctx.chat.length;
    await host.send('Hurt.', reply('Hurt.', ['~ spend Astra — Obscure', '~ health Astra — Hurt']));
    await host.send('Two.', reply('B.', ['~ rest Astra — day']));
    await host.swipe(reply('B, again.', ['~ rest Astra — short']));
    assert.equal(astraOf(host).wounds, 2, 'a short rest heals no stage');
    assert.equal(full(astraOf(host)), true);
    assert.equal((await host.sdk.reread(middleAt + 3)).ok, true);
    sound(host);
    await host.st.deleteMessage(middleAt + 1);
    await host.st.deleteMessage(middleAt);
    assert.equal(full(astraOf(host)), true, 'the first rest is a set; the deleted reply does not change it');
    assert.equal(astraOf(host).wounds, 0, 'the deleted Hurt reply takes its stage with it');
    sound(host);
});

test('a companion or a blank name is refused, not told as rested', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await hurt(host);
    await host.send('Hello.', reply('Rorke joins.', ['+ companion Rorke | level: 9 | strengths: very strong, swordswoman', '~ rest Rorke — night']));
    assert.equal(full(astraOf(host)), false);
    const summaries = host.store.receipts().map(entry => entry.receipt).filter(r => r.type === 'capture.rest').map(r => r.summary);
    assert.equal(summaries.some(s => /Rorke rests/.test(s)), false);
    sound(host);
});
