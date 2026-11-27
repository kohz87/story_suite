// `~ rest` and leftover foes: only a fight still on refuses it, the reply card says what happened, and an older reply keeps the rule it was captured under.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecord } from '../../../core/persist.js';
import { blockingFoes } from '../src/module-parts/foes-fights.js';
import { astraOf, reply, slice, withAstra } from './helpers/host.js';

const quiet = t => t.mock.method(console, 'warn', () => {});
const full = member => member.pools.sp.now === member.pools.sp.max;
const sound = host => { const live = JSON.stringify(slice(host)); host.store.rebuild(); assert.equal(JSON.stringify(slice(host)), live, 'rebuild == live'); assert.deepEqual(host.store.problems(), []); };
const card = (host, index = host.ctx.chat.length - 1) => host.sdk.query('reply.changes', { index })?.lines ?? [];
const REST = '~ rest Party — short';
const rests = (host, index) => host.store.receipts().filter(entry => entry.index === index && entry.receipt.type === 'capture.rest');
const tries = host => host.store.receipts().map(entry => entry.receipt).filter(receipt => receipt.type === 'capture.try');
const roll = (against = null) => `? try Astra | Obscure | ordinary${against ? ` | against: ${against}` : ''}`;
const spend = host => host.send('Spend.', reply('Spent.', ['~ spend Astra — Obscure']));
const hogs = host => host.send('Hogs.', reply('Hogs.', ['+ foes Hogs | count: 3 | kind: common']));
const rest = (host, lines = [REST]) => host.send('Rest.', reply('Rest.', lines));

async function host(t) {
    quiet(t);
    const made = await withAstra();
    t.after(() => made.close());
    return made;
}

test('foes left over from an earlier reply (no clock) do not stop a rest, stay standing, and the card says it', async t => {
    const h = await host(t);
    await hogs(h);
    await spend(h);
    const before = JSON.stringify(slice(h).foes);
    await rest(h);
    assert.equal(full(astraOf(h)), true);
    assert.equal(JSON.stringify(slice(h).foes), before, 'the leftover group is not touched');
    assert.deepEqual(card(h).map(line => [line.line, line.applied]), [['The party rests a while: mana and stamina full.', true]]);
    sound(h);
});

test('a group set up in this reply or the one before refuses, names itself on the card, and `- foes` frees the rest', async t => {
    const h = await host(t);
    await spend(h);
    await rest(h, ['+ foes Hogs | count: 3 | kind: common', '+ foes Wolves | count: 1 | kind: common', REST]);
    assert.equal(full(astraOf(h)), false);
    const [line] = card(h);
    assert.deepEqual([line.line, line.applied], ['Rest refused: the fight with Hogs and Wolves is still on.', false]);
    assert.match(line.detail, /"- foes Hogs" and "- foes Wolves"/);
    await rest(h);
    assert.equal(full(astraOf(h)), false, 'the reply before');
    assert.match(h.turn.problems('text-rpg').at(-1).message, /^"~ rest Party — short" was not used: the fight with Hogs and Wolves is still on\./);
    await rest(h, ['- foes Hogs', '- foes Wolves', REST]);
    assert.equal(full(astraOf(h)), true);
    sound(h);
});

test('a touch holds for this reply and the one before, and with a clock for 60 story minutes from the reply that made it', () => {
    const state = (sid = 'old', left = 2) => ({ foes: { groups: { hogs: { name: 'Hogs', left, fight: 'f', at: null, sid } }, fights: {} }, dice: {} });
    const dice = (index, clock) => ({ index, receipt: { type: 'textRpg.dice', data: { list: [1, 2, 3], ...(clock === null ? {} : { clock }) } } });
    const set = index => ({ index, receipt: { type: 'capture.foes', data: { group: 'hogs' } } });
    const hit = index => ({ index, receipt: { type: 'capture.xp', data: { touched: ['hogs'] } } });
    // The reply being read is at 8; the replies before it are at 2, 4 and 6 (each holds the dice step of the next).
    const names = (entries, now = null, slice0 = state()) => blockingFoes(slice0, { sid: 'now', index: 8, entries, now }).map(([id]) => id);
    const older = clock => [dice(2, clock), set(4), dice(4, clock), dice(6, clock)];
    assert.deepEqual(names(older(null)), [], 'two replies back, no clock');
    assert.deepEqual([names(older(100), 160), names(older(100), 161)], [['hogs'], []]);
    assert.deepEqual(names([set(6), dice(6, 100)], 900), ['hogs'], 'the reply before, however the clock moved');
    assert.deepEqual(names([...older(null), hit(6)]), ['hogs'], 'a hit is a touch');
    assert.deepEqual(names([...older(null), { index: 6, receipt: { type: 'capture.try', data: { touched: ['hogs'] } } }]), ['hogs'], 'a roll against it is a touch');
    assert.deepEqual(names([], 900, state('now')), ['hogs'], 'touched in this very reply');
    assert.deepEqual(names([set(6), set(10)], null, state('old', 0)), [], 'none standing');
});

test('a hit by `+ xp` keeps the fight on for the next reply, also in a reply with no roll', async t => {
    const h = await host(t);
    await hogs(h);
    await spend(h);
    await rest(h, ['+ xp Party — a hog down | foes: 1']);
    await rest(h);
    assert.equal(full(astraOf(h)), false);
    await rest(h);
    assert.equal(full(astraOf(h)), true);
    sound(h);
});

test('a roll `against:` a named group keeps its fight on, so tries in two replies still refuse the rest', async t => {
    const h = await host(t);
    await hogs(h);
    await rest(h, [roll('Hogs')]);
    await rest(h, [roll('hogs'), REST]);
    assert.deepEqual(tries(h).map(receipt => receipt.data.touched), [['hogs'], ['hogs']]);
    assert.equal(full(astraOf(h)), false);
    assert.deepEqual(card(h).map(line => [line.line, line.applied]), [['Rest refused: the fight with Hogs is still on.', false]]);
    sound(h);
});

test('a roll with no `against:`, or one naming no standing group, does not keep a leftover group current', async t => {
    const h = await host(t);
    await hogs(h);
    await rest(h, [roll()]);
    await rest(h, [roll('Rats')]);
    assert.equal(full(astraOf(h)), false, 'the tries cost stamina');
    await rest(h);
    assert.deepEqual(tries(h).map(receipt => Object.hasOwn(receipt.data, 'touched')), [false, false]);
    assert.equal(full(astraOf(h)), true);
    sound(h);
});

test('the command is refused only while the fight is on', async t => {
    const h = await host(t);
    await hogs(h);
    const refusedNow = await h.sdk.command('textRpg.rest', { kind: 'short' });
    assert.deepEqual([refusedNow.ok, refusedNow.code], [false, 'REFUSED']);
    assert.match(refusedNow.message, /the fight with Hogs is still on/);
    await spend(h);
    await spend(h);
    assert.equal((await h.sdk.command('textRpg.rest', { kind: 'short' })).ok, true);
});

test('a reply captured before the rule keeps its refusal on Re-read; a new reply uses the new rule; rebuild == live', async t => {
    const h = await host(t);
    await hogs(h);
    await spend(h);
    await spend(h);
    await rest(h);
    const old = h.ctx.chat.length - 1;
    assert.equal(full(astraOf(h)), true);
    // The record as an older version left it: no `restCurrent` mark.
    const record = readRecord(h.ctx.chat[old]);
    assert.ok(record.rules.includes('restCurrent'));
    record.rules.splice(record.rules.indexOf('restCurrent'), 1);
    assert.equal((await h.sdk.reread(old)).ok, true);
    assert.equal(readRecord(h.ctx.chat[old]).rules?.includes('restCurrent') ?? false, false);
    assert.equal(full(astraOf(h)), false, 'refused as it was');
    assert.deepEqual([rests(h, old), card(h, old)], [[], []], 'no receipt and no card row, as before');
    const problem = h.turn.problems('text-rpg').at(-1);
    assert.deepEqual([problem.code, problem.message], ['REFUSED', '"~ rest Party — short" was not used: Foes still stand; no one rests.']);
    sound(h);
    await rest(h);
    assert.equal(full(astraOf(h)), true);
    sound(h);
});

test('a swipe and a delete take the card line with the reply', async t => {
    const h = await host(t);
    await spend(h);
    await rest(h, ['+ foes Hogs | count: 1 | kind: common', REST]);
    await h.swipe(reply('Again.', [REST]));
    assert.deepEqual(card(h).map(line => line.applied), [true]);
    await h.st.deleteMessage(h.ctx.chat.length - 1);
    assert.equal(full(astraOf(h)), false);
    sound(h);
});

test('with no mark every refusal fails with its old code and leaves no receipt', async t => {
    const h = await host(t);
    await spend(h);
    await rest(h, ['~ rest Party — soon', '~ rest Nobody — short']);
    const old = h.ctx.chat.length - 1;
    assert.equal(rests(h, old).length, 2, 'under the mark, kept as receipts');
    const record = readRecord(h.ctx.chat[old]);
    record.rules.splice(record.rules.indexOf('restCurrent'), 1);
    assert.equal((await h.sdk.reread(old)).ok, true);
    assert.deepEqual([rests(h, old), card(h, old)], [[], []]);
    assert.deepEqual(h.turn.problems('text-rpg').slice(-2).map(item => [item.code, item.message]), [
        ['INVALID', '"~ rest Party — soon" was not used: Rest is short, night or day.'],
        ['NOT_FOUND', '"~ rest Nobody — short" was not used: No character called Nobody.'],
    ]);
    sound(h);
});
