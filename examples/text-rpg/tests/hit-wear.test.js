// A `? try` whose hit wounds also wears one piece the roller has on, by code, once a reply, never over the narrator's own wear line, and only on replies captured under the rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecord } from '../../../core/persist.js';
import { STORY_WEAR } from '../../../modules/inventory/wear.js';
import { DIFFICULTIES } from '../src/rules/difficulty.js';
import { WEAR, pieceFor } from '../src/module-parts/hit-wear.js';
import { rollCards } from '../src/module-parts/roll-cards.js';
import { rollsOf } from '../src/module-parts/rolls.js';
import { drawn, reply, slice, tries, withAstra } from './helpers/host.js';

const GEAR = ['+ item Mail Shirt | slot: body | equipped: body', '+ item Wrapped Forearms | slot: accessory | equipped: accessory', '+ item Round Shield | slot: off-hand | equipped: off-hand'];

async function host(t, lines = GEAR) {
    t.mock.method(console, 'warn', () => {});
    const h = await withAstra({ 'story-block.gear': true });
    // SillyTavern's global, as the browser has it: the code reads the reply's own lines from its chat.
    const had = globalThis.SillyTavern;
    const own = { getContext: () => h.ctx };
    globalThis.SillyTavern = own;
    // (a test with two hosts: only the global this host put there is put back, whatever order the hooks run in)
    t.after(() => { if (globalThis.SillyTavern === own) globalThis.SillyTavern = had; return h.close(); });
    await h.send('Hello.', reply('The kit.', lines));
    return h;
}
const itemOf = (h, name) => h.sdk.query('inventory.items').find(item => item.name === name);
const condOf = (h, name) => h.sdk.query('gear.view', {}).rows[itemOf(h, name).stack].cond;
const conds = h => ['Mail Shirt', 'Wrapped Forearms', 'Round Shield'].map(name => condOf(h, name));
// A skill not on the sheet rolls the die − 3, so a difficulty 1 to 9 over that is a failure or a success at a cost: one wound stage, whatever the die.
// The die is drawn during a send, so the try is written by a Continue, which draws none.
async function oneStage(h, hit) {
    await h.send('Go on.', 'A foe closes in.');
    const total = drawn(h).list[0] - 3;
    const { word } = DIFFICULTIES.find(step => step.dc - total >= 1 && step.dc - total <= 9);
    await h.cont(`\n\n${reply('It lands.', [`? try Astra | Juggling | ${word}${hit ? ` | hit: ${hit}` : ''}`])}`);
}
// At near impossible the same roll is always a bad failure: two stages.
const twoStages = hit => `? try Astra | Juggling | near impossible | hit: ${hit}`;
const say = (h, lines) => h.send('Go on.', reply('The fight goes on.', lines));
const last = h => tries(h).at(-1);
function sound(h) {
    const live = JSON.stringify(h.head());
    h.store.rebuild();
    assert.equal(JSON.stringify(h.head()), live, 'rebuild == live');
}

test('the amounts are the inventory\'s own story wear amounts', () => {
    assert.deepEqual([WEAR.scuff.amount, WEAR.tear.amount], [STORY_WEAR.scuff, STORY_WEAR.tear]);
});

test('which piece: a name word, else a slot word, else the body armour, else the shield, else nothing', () => {
    const piece = (stack, name, broken = false) => ({ stack, name, broken });
    const slots = { weapon: piece('w', 'Iron Sword'), body: piece('b', 'Mail Shirt'), 'off-hand': piece('o', 'Round Shield'), head: piece('h', 'Iron Cap'), feet: piece('f', 'Wolfhide Boots'), 'accessory-1': piece('a', 'Wrapped Forearms') };
    const of = (hit, worn = slots) => pieceFor(worn, hit)?.stack ?? null;
    assert.equal(of('claws across the forearm'), 'a');
    assert.equal(of('teeth in one boot'), 'f');
    assert.equal(of('a club to the head'), 'h');
    assert.equal(of('a kick at the feet'), 'f');
    assert.equal(of('a blow on the off-hand'), 'o');
    assert.equal(of('an iron sword cut'), 'b', 'the attacker\'s weapon and material name no piece');
    assert.equal(of('the forearm and a boot'), 'b', 'two named pieces name none');
    assert.equal(of('a spear', { weapon: slots.weapon, 'off-hand': slots['off-hand'] }), 'o');
    assert.equal(of('a spear', { weapon: slots.weapon, head: slots.head }), null);
    assert.equal(of('claws across the forearm', { ...slots, 'accessory-1': piece('a', 'Wrapped Forearms', true) }), 'b', 'a broken piece is never chosen');
    assert.equal(pieceFor(undefined, 'a spear'), null);
});

test('a hit that wounds one stage scuffs the body armour, and the receipt and card say so', async t => {
    const h = await host(t);
    await oneStage(h, 'a spear to the side');
    const { data, summary } = last(h);
    assert.ok(['cost', 'failure'].includes(data.band), data.band);
    assert.deepEqual(conds(h), [95, 100, 100]);
    assert.equal(data.wore, 'Mail Shirt scuffed');
    assert.match(summary, /; Mail Shirt scuffed\.$/);
    const index = h.ctx.chat.length - 1;
    const card = Object.values(rollCards())[0].for({}, null, { index, query: () => rollsOf(h.store.receipts(), index, () => 'Astra') });
    assert.match(card.rows.map(row => row.text).join('\n'), / · Mail Shirt scuffed/);
    assert.deepEqual(h.store.problems(), []);
    sound(h);
});

test('the piece the hit names is chosen, and two stages tear it', async t => {
    const h = await host(t);
    await say(h, [twoStages('claws across the forearm')]);
    assert.equal(last(h).data.band, 'bad');
    assert.deepEqual(conds(h), [100, 85, 100]);
    assert.equal(last(h).data.wore, 'Wrapped Forearms torn');
    sound(h);
});

test('no hit, or no wound, wears nothing; so does a bare roller', async t => {
    const h = await host(t);
    await oneStage(h, '');
    await say(h, ['? try Astra | Juggling | near impossible']);
    // A learned skill at trivial succeeds on all but the lowest dice: look for the success.
    for (let i = 0; i < 8 && last(h).data.band !== 'success'; i++) await say(h, ['? try Astra | Lore | trivial']);
    // A success with a hit: at trivial (5) any die of 5 or more.
    for (let i = 0; i < 20; i++) {
        await h.send('Go on.', 'Quiet.');
        if (drawn(h).list[0] >= 5) break;
    }
    await h.cont(`\n\n${reply('Easy.', ['? try Astra | Lore | trivial | hit: a spear'])}`);
    assert.equal(last(h).data.band, 'success');
    assert.deepEqual(conds(h), [100, 100, 100]);
    assert.equal(tries(h).some(entry => 'wore' in entry.data), false);
    sound(h);
    const bare = await host(t, ['+ item Iron Sword | slot: weapon | equipped: weapon']);
    await say(bare, [twoStages('a spear')]);
    assert.equal(condOf(bare, 'Iron Sword'), 100);
    assert.equal('wore' in last(bare).data, false);
});

for (const [order, lines] of [
    ['before the try', (a, b) => [a, b]],
    ['after the try', (a, b) => [b, a]],
]) {
    test(`a narrator wear line on the same piece ${order} wins: its scuff stands, not the code's tear`, async t => {
        const h = await host(t);
        await say(h, lines('~ item the Mail Shirt | wear: scuff', twoStages('a spear')));
        const narrated = () => {
            assert.equal(tries(h).length, 1);
            assert.deepEqual(conds(h), [95, 100, 100], 'and no other piece wears in its place');
            assert.equal('wore' in last(h).data, false);
            assert.doesNotMatch(last(h).summary, /Mail Shirt/);
            assert.doesNotMatch(JSON.stringify(h.turn.problems()), /already took its wear/);
        };
        narrated();
        sound(h);
        assert.equal((await h.sdk.reread(h.ctx.chat.length - 1)).ok, true);
        narrated();
        sound(h);
    });

    test(`a narrator ruin ${order} stays a ruin and keeps its note`, async t => {
        const h = await host(t);
        await say(h, lines('~ item **Mail Shirt** — split by the spear | wear: ruin | note: split down the side', twoStages('a spear')));
        const ruined = () => {
            assert.deepEqual(conds(h), [0, 100, 100]);
            assert.equal(itemOf(h, 'Mail Shirt').note, 'split down the side');
            assert.equal('wore' in last(h).data, false);
            assert.doesNotMatch(last(h).summary, /Mail Shirt/);
            assert.deepEqual(h.store.problems(), []);
        };
        ruined();
        sound(h);
        assert.equal((await h.sdk.reread(h.ctx.chat.length - 1)).ok, true);
        ruined();
        sound(h);
    });
}

test('a narrator line without wear, or wearing another piece, leaves the code its wear', async t => {
    const h = await host(t);
    await say(h, ['~ item Mail Shirt | note: muddy', '~ item Round Shield | wear: scuff', twoStages('a spear')]);
    assert.deepEqual(conds(h), [85, 100, 95]);
    assert.equal(last(h).data.wore, 'Mail Shirt torn');
    sound(h);
});

test('two hits on one piece in one reply wear it once; the next reply wears it again', async t => {
    const h = await host(t);
    await say(h, [twoStages('a spear'), twoStages('another spear')]);
    assert.deepEqual(conds(h), [85, 100, 100]);
    assert.deepEqual(tries(h).map(entry => entry.data.wore), ['Mail Shirt torn', undefined]);
    await say(h, [twoStages('a spear')]);
    assert.deepEqual(conds(h), [70, 100, 100]);
    sound(h);
});

test('a companion\'s hit wears their own gear, not the reader\'s', async t => {
    const h = await host(t);
    await say(h, ['+ companion Torka | level: 3 | strengths: maul', '+ item Hide Jerkin | slot: body']);
    const torka = Object.values(slice(h).members).find(member => member.name === 'Torka').id;
    const worn = await h.sdk.command('item.equip', { stack: itemOf(h, 'Hide Jerkin').stack, owner: torka, slot: 'body', transfer: true });
    assert.equal(worn.ok, true, worn.message);
    await say(h, ['? try Torka | Juggling | near impossible | hit: a boar\'s charge']);
    assert.equal(last(h).data.wore, 'Hide Jerkin torn');
    assert.equal(condOf(h, 'Hide Jerkin'), 85);
    assert.deepEqual(conds(h), [100, 100, 100]);
    sound(h);
});

test('a reply captured before the rule wears nothing, on Re-read and after a Continue', async t => {
    const h = await host(t);
    const writer = h.store.setRuleMarks;
    h.store.setRuleMarks = () => { throw new Error('no mark: an old reply'); };
    await say(h, [twoStages('a spear')]);
    h.store.setRuleMarks = writer;
    const at = h.ctx.chat.length - 1;
    const untouched = () => {
        assert.equal(readRecord(h.ctx.chat[at]).rules, undefined);
        assert.deepEqual(conds(h), [100, 100, 100]);
        assert.equal(tries(h).some(entry => 'wore' in entry.data), false);
    };
    untouched();
    assert.equal((await h.sdk.reread(at)).ok, true);
    untouched();
    await h.cont(`\n\n${reply('More.', [twoStages('a second spear')])}`);
    assert.equal((await h.sdk.reread(at)).ok, true);
    untouched();
    sound(h);
});

test('swipe, regenerate, Re-read, a deleted reply, a reload and a rewind keep one wear for each standing reply, rebuild == live', async t => {
    const h = await host(t);
    await say(h, [twoStages('a spear')]);
    const at = h.ctx.chat.length - 1;
    assert.deepEqual(conds(h), [85, 100, 100]);
    await h.swipe(reply('Again.', [twoStages('claws across the forearm')]));
    assert.deepEqual(conds(h), [100, 85, 100]);
    sound(h);
    await h.st.swipeTo(at, 0);
    assert.deepEqual(conds(h), [85, 100, 100]);
    sound(h);
    await h.regenerate(reply('Once more.', [twoStages('a blow on the shield')]));
    assert.deepEqual(conds(h), [100, 100, 85]);
    assert.equal((await h.sdk.reread(h.ctx.chat.length - 1)).ok, true);
    assert.deepEqual(conds(h), [100, 100, 85]);
    sound(h);
    await say(h, [twoStages('a spear')]);
    assert.deepEqual(conds(h), [85, 100, 85]);
    await h.st.deleteMessage(h.ctx.chat.length - 3);
    await h.st.settle?.();
    assert.deepEqual(conds(h), [85, 100, 100]);
    sound(h);
    const before = JSON.stringify(h.head().domains);
    await h.st.loadChat(JSON.parse(JSON.stringify(h.ctx.chat)));
    assert.equal(JSON.stringify(h.head().domains), before, 'reload == live');
    sound(h);
    const index = h.ctx.chat.length - 1;
    const wear = h.store.receipts().filter(entry => entry.index === index && entry.receipt.type === 'capture.try').at(-1);
    assert.equal((await h.sdk.rewind({ index, beforeRev: wear.receipt.rev })).ok, true);
    assert.deepEqual(conds(h), [100, 100, 100]);
    sound(h);
});

test('a narrator wear line after the try still wins through a deleted earlier reply, a reload and a swipe back, rebuild == live', async t => {
    const h = await host(t);
    await say(h, []);
    const filler = h.ctx.chat.length - 1;
    await say(h, [twoStages('a spear'), '~ item Mail Shirt | wear: scuff']);
    await say(h, []);
    const kept = left => {
        assert.deepEqual(conds(h), [left, 100, 100]);
        sound(h);
    };
    const reloaded = async () => {
        const before = JSON.stringify(h.head().domains);
        await h.st.loadChat(JSON.parse(JSON.stringify(h.ctx.chat)));
        assert.equal(JSON.stringify(h.head().domains), before, 'reload == live');
    };
    kept(95);
    await h.st.deleteMessage(filler);
    await h.st.settle?.();
    kept(95);
    await reloaded();
    kept(95);
    // Back to the narrator's reply as the last one, then a swipe with the try alone, and back.
    await h.st.deleteMessage(h.ctx.chat.length - 1);
    await h.st.deleteMessage(h.ctx.chat.length - 1);
    await h.st.settle?.();
    const at = h.ctx.chat.length - 1;
    kept(95);
    await h.swipe(reply('Again.', [twoStages('a spear')]));
    kept(85);
    await h.st.swipeTo(at, 0);
    kept(95);
});

test('a wear line that only a Continue brings finds the piece already worn, and a reload keeps what was live', async t => {
    const h = await host(t);
    await say(h, [twoStages('a spear')]);
    await h.cont(`\n\n${reply('The mail gives.', ['~ item Mail Shirt | wear: scuff'])}`);
    assert.deepEqual(conds(h), [85, 100, 100]);
    assert.match(JSON.stringify(h.turn.problems()), /Mail Shirt already took its wear in this reply/);
    const before = JSON.stringify(h.head().domains);
    await h.st.loadChat(JSON.parse(JSON.stringify(h.ctx.chat)));
    assert.equal(JSON.stringify(h.head().domains), before, 'reload == live');
    sound(h);
    // A Re-read reads the whole reply at once, so there the narrator's line wins.
    assert.equal((await h.sdk.reread(h.ctx.chat.length - 1)).ok, true);
    assert.deepEqual(conds(h), [95, 100, 100]);
    sound(h);
});
