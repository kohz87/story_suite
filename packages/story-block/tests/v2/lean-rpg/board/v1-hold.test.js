// The story's own practice line in the winning reply is not used on a skill the fight practised (code sets the number), on a whole host with story lines; and everything stays the same after a swipe, swipe back, edited Re-read, rewind, reload and a middle delete.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../qa/helpers/seeded.js';
import { rollReceipt } from '../helpers.js';
import { holdHost, stageFight } from './v1-hold.helpers.js';

const PRACTICE = amount => `Done.\n<Changes>\n+ dm skills — why | kind: practice-1 | amount: ${amount}\n</Changes>`;
const practice = host => host.head().domains.dataModules.instances['pack.chat/skills'].chat.fields.practice1;
const xp = host => host.head().domains.dataModules.instances['pack.chat/character'].chat.fields.xp;
const types = host => host.store.receipts().map(entry => entry.receipt.type);

async function same(host, label) {
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live, `${label}: live == rebuild`);
    await host.store.flush();
    const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
    await host.st.loadChat(chat, `hold-${label}`);
    host.ctx.chatMetadata = meta;
    assert.equal(JSON.stringify(host.head()), live, `${label}: reload == live`);
}

test('a story practice line in the winning reply is put back; the same after swipe, Re-read (edited), rewind and reload', async t => {
    const restore = seedCrypto(5);
    t.after(restore);
    const host = await holdHost(t, { settings: { rpgRolls: 'off' } });
    stageFight(host);
    await host.send('Go.', PRACTICE(15));
    const at = host.ctx.chat.length - 1, got = rollReceipt(host, at).data.v2.result;
    assert.equal(got.stop, 'won');
    const code = got.paid.practice[0].amount;
    assert.ok(code > 0 && code !== 15, 'the code\'s number differs from the story\'s, so the check is not vacuous');
    assert.equal(practice(host), code, 'code\'s practice only: the story\'s +15 on top is put back');
    assert.equal(xp(host), 15, 'XP is the code\'s (the v1 Character has no story XP line)');
    assert.ok(types(host).includes('rpg.fight'), 'the hold step ran');
    await same(host, 'first');

    // a reply that is not the winning one keeps the story's practice (the hold is only for the fight's own reply)
    const live = JSON.stringify(host.head());
    await host.swipe(PRACTICE(9));
    assert.equal(practice(host), code, 'swipe: the same code number');
    await host.st.swipeTo(at, 0);
    assert.equal(JSON.stringify(host.head()), live, 'swipe back: as before');
    await same(host, 'swipe');

    const text = host.ctx.chat[at].mes;
    await host.st.editMessage(at, PRACTICE(20));
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.equal(practice(host), code, 'Re-read with another story line: still the code\'s number');
    await same(host, 'reread-grown');
    await host.st.editMessage(at, 'Done.');
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.equal(practice(host), code, 'Re-read with no story line: the code\'s number, the hold step gone or idle');
    await same(host, 'reread-shrunk');
    await host.st.editMessage(at, text);
    assert.equal((await host.sdk.reread(at)).ok, true);

    const entry = host.store.receipts().filter(item => item.index === at).find(item => item.receipt.type === 'interaction.settle');
    assert.equal((await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev })).ok, true);
    assert.equal(practice(host), 0, 'rewind: nothing paid');
    assert.equal(xp(host), 0);
    await same(host, 'rewind');
});

test('a middle delete (a later reply stays) takes the pay and the hold with the fight; replay equals live', async t => {
    const restore = seedCrypto(6);
    t.after(restore);
    const host = await holdHost(t, { settings: { rpgRolls: 'off' } });
    stageFight(host);
    await host.send('Go.', PRACTICE(15));
    await host.send('Later.', 'A later reply.');
    assert.ok(practice(host) > 0);
    await host.st.deleteMessage(4);
    await host.st.deleteMessage(3);
    assert.equal(practice(host), 0, 'the fight pair is gone, so is its pay');
    assert.equal(xp(host), 0);
    await same(host, 'middle delete');
});
