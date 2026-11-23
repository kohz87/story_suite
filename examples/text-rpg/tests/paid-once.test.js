import test from 'node:test';
import assert from 'node:assert/strict';
import { astraOf, reply, tries, withAstra } from './helpers/host.js';
import { GRAMMAR, STATIC_TEXT } from '../src/module-parts/static-text.js';

const TRY = '? try Astra | Obscure | easy';
const SPEND = '~ spend Astra — Obscure';
const spOf = host => astraOf(host).pools.sp.now;
/** The stamina one reply took, less the extra a "success at a cost" roll takes on its own (paid: skill or stamina). */
async function taken(t, lines) {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    const before = spOf(host);
    await host.send('Go.', reply('Told.', lines));
    const extra = tries(host).filter(r => ['skill', 'stamina'].includes(r.data.paid)).length;
    return { host, drop: before - spOf(host), extra, receipts: tries(host) };
}

test('a try then a spend of one skill pays its cost once, and the receipts say so', async t => {
    const { host, drop, extra, receipts } = await taken(t, [TRY, SPEND]);
    if (!extra) assert.equal(drop, 2);
    assert.equal(receipts.length, 1);
    const spend = host.store.receipts().map(e => e.receipt).find(r => r.type === 'textRpg.spend' || /uses Obscure/.test(r.summary ?? ''));
    assert.match(spend.summary, /\(paid by the roll\)/);
});

test('a spend then a try of one skill pays its cost once', async t => {
    const { drop, extra, receipts } = await taken(t, [SPEND, TRY]);
    if (!extra) assert.equal(drop, 2);
    assert.match(receipts[0].summary, /cost already paid/);
    assert.equal(receipts[0].data.costPaid, true);
});

test('two tries of one skill each pay; a lone spend and a lone try pay once', async t => {
    const both = await taken(t, [TRY, TRY]);
    if (!both.extra) assert.equal(both.drop, 4);
    assert.ok(both.receipts.every(r => !r.data.costPaid));
    const lone = await taken(t, [SPEND]);
    assert.equal(lone.drop, 2);
});

test('spend, try, spend: the second spend is free too; replay == live through rebuild, swipe and delete', async t => {
    const { host, drop, extra } = await taken(t, [SPEND, TRY, SPEND]);
    if (!extra) assert.equal(drop, 2);
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live, 'rebuild == live');
    const at = host.ctx.chat.length - 2;
    await host.swipe(reply('Again.', [TRY]));
    assert.ok(tries(host).every(r => !r.data.costPaid), 'a swipe leaves no mark behind');
    await host.st.deleteMessage(at + 1);
    await host.st.deleteMessage(at);
    assert.equal(spOf(host), astraOf(host).pools.sp.max, 'a delete gives the cost back');
    assert.deepEqual(host.store.problems(), []);
});

test('the xp grammar and the rules say XP is paid as foes fall', () => {
    assert.match(GRAMMAR.xp, /in the reply where they fall or the danger is overcome: foes = how many fell this reply; once a reply/);
    assert.match(STATIC_TEXT, /Pay XP as foes fall: \+ xp in the reply they go down, not only when the fight ends\./);
    assert.match(GRAMMAR.spend, /only a skill used without a \? try; a try pays its own cost/);
});
