// Batch 1 B1.2 (coins): the prompt now lets a coin line name several coins ("+ coin 4 silver 5 copper"); the parse and the apply
// are unchanged, so no rule mark. Replay tests R0-R5 (audit §7.1 rule 3): replies written before this change replay as they
// were, and a refusal (decimal, unknown coin, overspend) stays visible and leaves the wallet alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../packages/story-block/testkit/index.js';

const COINS = [{ name: 'copper', value: 1 }, { name: 'silver', value: 10 }, { name: 'gold', value: 100 }];
const reply = (prose, ...lines) => `${prose}\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const wallet = host => host.sdk.query('inventory.wallet', { owner: 'party' }).coin ?? 0;
const hash = host => JSON.stringify(host.head());
const record = (host, index) => host.ctx.chat[index].extra.storySuite;
const last = host => host.ctx.chat.length - 1;

async function start(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { modules: { 'story-block': { currency: 'copper', currencyPlural: 'copper', coins: COINS } } } });
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    return host;
}
test('R0: an old reply (the record has none of the new prompt\'s marks, and it never needed one) reads the same: 3 silver 6 copper is 36', async t => {
    const host = await start(t);
    await host.send('I sell.', reply('He pays.', '+ coin 3 silver 6 copper | from: the trader'));
    const at = last(host);
    assert.equal(wallet(host), 36);
    const live = hash(host);
    record(host, at).rules = [];
    const done = await host.turn.reread(at);
    assert.equal(done.ok, true, done.message);
    assert.deepEqual(done.problems, []);
    assert.deepEqual(done.receipts.map(receipt => receipt.type), ['capture.coin']);
    assert.equal(wallet(host), 36);
    assert.equal(hash(host), live, 'the same head state as the first read');
});

test('R1: a Re-read of a multi-coin line gives the same head hash and receipts', async t => {
    const host = await start(t);
    await host.send('I sell.', reply('He pays.', '+ coin 4 silver 5 copper | from: the trader'));
    const at = last(host);
    assert.equal(wallet(host), 45);
    const live = hash(host);
    const receipts = JSON.stringify(record(host, at).receipts.map(({ type, cause }) => [type, cause]));
    const done = await host.turn.reread(at);
    assert.equal(done.ok, true, done.message);
    assert.equal(hash(host), live);
    assert.equal(JSON.stringify(record(host, at).receipts.map(({ type, cause }) => [type, cause])), receipts);
    assert.equal(wallet(host), 45, 'paid once');
});

test('R2: a swipe with another coin line pays by its own line; swiping back restores the first', async t => {
    const host = await start(t);
    await host.send('I sell.', reply('He pays.', '+ coin 4 silver 5 copper'));
    const at = last(host);
    const first = hash(host);
    await host.swipe(reply('He pays more.', '+ coin 1 gold 2 silver'));
    assert.equal(wallet(host), 120, 'the new swipe is its own build');
    const second = hash(host);
    await host.st.swipeTo(at, 0);
    assert.equal(wallet(host), 45);
    assert.equal(hash(host), first, 'going back restores the first');
    await host.st.swipeTo(at, 1);
    assert.equal(hash(host), second);
});

test('R3: an edit of the prose changes nothing; an edit of the coin line is computed once from the new line', async t => {
    const host = await start(t);
    await host.send('I sell.', reply('He pays.', '+ coin 4 silver 5 copper'));
    const at = last(host);
    const before = hash(host);
    await host.st.editMessage(at, reply('He pays, grumbling.', '+ coin 4 silver 5 copper'));
    assert.equal(hash(host), before, 'prose only');
    assert.equal(wallet(host), 45);
    await host.st.editMessage(at, reply('He pays, grumbling.', '+ coin 1 gold 2 silver'));
    const done = await host.turn.reread(at);
    assert.equal(done.ok, true, done.message);
    assert.equal(wallet(host), 120, 'the new line only, the old payment taken back');
});

test('R4: a continue adds its own coin line and applies nothing twice', async t => {
    const host = await start(t);
    await host.send('I sell.', reply('He pays.', '+ coin 4 silver 5 copper'));
    assert.equal(wallet(host), 45);
    await host.cont(reply(' And a tip.', '+ coin 2 silver'));
    assert.equal(wallet(host), 65, '45 once, then 20');
});

test('R5: a rebuild after an earlier reply is deleted gives the hash built live', async t => {
    const host = await start(t);
    await host.send('One.', reply('Pay.', '+ coin 3 silver 6 copper'));
    await host.send('Two.', reply('Pay.', '+ coin 2 silver 5 copper'));
    await host.send('Three.', reply('Spend.', '- coin 1 silver | to: the inn'));
    assert.equal(wallet(host), 36 + 25 - 10);
    const live = hash(host);
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(hash(host), live, 'a reload gives the live state');
    await host.st.deleteMessage(6);
    await host.st.deleteMessage(5);
    await host.turn.onChatChanged();
    assert.equal(wallet(host), 36 - 10, 'the deleted reply\'s coins are gone, the rest stand');
    const rebuilt = hash(host);
    const twin = await start(t);
    await twin.send('One.', reply('Pay.', '+ coin 3 silver 6 copper'));
    await twin.send('Three.', reply('Spend.', '- coin 1 silver | to: the inn'));
    assert.equal(wallet(twin), wallet(host));
    // Revs and swipe ids differ by construction (the deleted reply took a rev); the money state is what must match.
    const money = text => { const { wallets, perReply } = JSON.parse(text).domains.inventory; return { wallets, spent: Object.values(perReply) }; };
    assert.deepEqual(money(rebuilt), money(hash(twin)), 'the rebuilt head holds the money built live');
});

test('refusals stay visible on the card and leave the wallet alone: a decimal, an unknown coin, an overspend', async t => {
    const host = await start(t);
    await host.send('Pay.', reply('Coins.', '+ coin 3 silver'));
    assert.equal(wallet(host), 30);
    for (const line of ['+ coin 4.5 silver', '+ coin 4 platinum 5 copper', '- coin 5 gold | to: the king']) {
        await host.send('Again.', reply('More.', line));
        const at = last(host);
        assert.equal(wallet(host), 30, line);
        const done = await host.turn.reread(at);
        assert.equal(done.ok, true, done.message);
        assert.equal(done.problems.length, 1, `${line}: ${JSON.stringify(done.problems)}`);
        assert.ok(done.problems[0].message || done.problems[0].code, line);
    }
    const overspend = (await host.turn.reread(last(host))).problems[0];
    assert.match(`${overspend.code} ${overspend.message ?? ''}`, /NOT_ENOUGH|has only/, JSON.stringify(overspend));
});
