// Pack format 4, job M1: the chat's currency is the reader's own, else the chat's frame (the game it began with), else the selected game live (a chat with no frame), else gold.
// A game swapped later does not move the money of a chat with a frame; swipes, a middle delete, a rewind, a reload and a Re-read (grown and shrunk) read the same frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecord } from '../../../../core/persist.js';
import { currencyOffer } from '../../../../modules/inventory/money.js';
import { FROST, SUN, frameHost, said, swapGame } from '../../../core/frame.helpers.js';

const name = host => host.sdk.query('inventory.currency').name;
const reread = async (host, index, text) => {
    await host.st.editMessage(index, text);
    assert.equal((await host.sdk.reread(index)).ok, true);
};

test('currencyOffer: a frame wins (null in it is the built-in gold), else the live game, else none', () => {
    const frame = (currency) => ({ set: true, currency });
    assert.deepEqual(currencyOffer(frame({ name: 'mark' }), { name: 'sun' }), { name: 'mark' });
    assert.equal(currencyOffer(frame(null), { name: 'sun' }), null, 'the frame says built-in: the live game does not move it');
    assert.deepEqual(currencyOffer({ set: false, currency: null }, { name: 'sun' }), { name: 'sun' });
    assert.deepEqual(currencyOffer(null, { name: 'sun' }), { name: 'sun' });
    assert.equal(currencyOffer(undefined, undefined), null);
});

test('before the first reply the selected game gives the currency live; after it the frame does', async t => {
    const host = await frameHost(t);
    assert.equal(name(host), 'mark');
    await swapGame(host, 'g2', SUN, 'sun');
    assert.equal(name(host), 'sun', 'no frame yet: live');
    await swapGame(host, 'g1', FROST, 'mark');
    await host.send('hi', said('R1.'));
    await swapGame(host, 'g2', SUN, 'sun');
    assert.equal(name(host), 'mark', 'the frame keeps the money of the chat');
});

test('swipe, swipe back, a middle delete, a rewind-style rebuild and a reload keep the frame\'s currency', async t => {
    const host = await frameHost(t);
    await host.send('a', said('R1.'));
    await host.send('b', said('R2.'));
    await host.send('c', said('R3.'));
    await swapGame(host, 'g2', SUN, 'sun');
    await host.swipe(said('R3 again.'));
    assert.equal(name(host), 'mark');
    await host.st.swipeTo(host.ctx.chat.length - 1, 0);
    assert.equal(name(host), 'mark');
    await host.st.deleteMessage(4);
    await host.st.deleteMessage(4);
    assert.equal(name(host), 'mark');
    host.store.rebuild();
    assert.equal(name(host), 'mark', 'a reload');
});

test('an edited Re-read, grown and shrunk, keeps the frame\'s currency and the wallet adds up', async t => {
    const host = await frameHost(t);
    await host.send('hi', said('R1.'));
    await swapGame(host, 'g2', SUN, 'sun');
    await reread(host, 2, `Long.\n\n<Changes>\n+ coin 10 | from: Bob\n+ coin 20 | from: Bob\n</Changes>`);
    assert.equal(name(host), 'mark');
    assert.equal(host.sdk.query('inventory.wallet', { owner: 'party' }).coin, 30);
    await reread(host, 2, 'Short.\n\n<Changes>\n+ coin 5 | from: Bob\n</Changes>');
    assert.equal(name(host), 'mark');
    assert.equal(host.sdk.query('inventory.wallet', { owner: 'party' }).coin, 5);
});

test('the reader\'s own currency still wins over the frame', async t => {
    const host = await frameHost(t);
    await host.send('hi', said('R1.'));
    host.ctx.extensionSettings.storySuite = { ...(host.ctx.extensionSettings.storySuite ?? {}), modules: { ...(host.ctx.extensionSettings.storySuite?.modules ?? {}), 'story-block': { currency: 'bead' } } };
    assert.equal(name(host), 'bead');
});

test('a rewind to after the frame keeps the money; a rewind to before it reads the game selected then', async t => {
    const host = await frameHost(t);
    await host.send('a', said('R1.'));
    await host.send('b', said('R2.'));
    await swapGame(host, 'g2', SUN, 'sun');
    const revOf = index => readRecord(host.ctx.chat[index])?.receipts?.at(-1)?.rev;
    assert.equal((await host.sdk.rewind({ index: 4, beforeRev: revOf(4) })).ok, true);
    assert.equal(name(host), 'mark', 'after the frame');
    const frameRev = readRecord(host.ctx.chat[0]).receipts.find(receipt => receipt.type === 'packs.frame').rev;
    assert.equal((await host.sdk.rewind({ index: 0, beforeRev: frameRev })).ok, true);
    assert.equal(name(host), 'sun', 'no frame: the selected game, live');
    await host.send('c', said('R3.'));
    assert.equal(name(host), 'sun');
});
