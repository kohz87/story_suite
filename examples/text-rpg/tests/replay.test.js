import test from 'node:test';
import assert from 'node:assert/strict';
import { astraOf, drawn, reply, slice, tries, withAstra } from './helpers/host.js';

const TRY = ['? try Astra | Lore | normal | threat: a fair match', '+ xp Party — the gate | size: real'];
const summary = host => JSON.stringify({ textRpg: slice(host), meta: host.head().meta?.rev });

test('a swipe draws new dice and takes the first try back; a Re-read keeps the dice and the state', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('We sneak.', reply('The gate looms.', TRY));
        const first = drawn(host).list;
        assert.equal(tries(host).length, 1);
        assert.equal(astraOf(host).xp, 20);

        // A swipe with no lines: the try and its xp are gone, and the dice are the swipe's own.
        await host.swipe(reply('Another way.'));
        assert.equal(astraOf(host).xp, 0);
        assert.equal(astraOf(host).skills[1].practice, 0);
        assert.equal(tries(host).length, 0);

        // Swipes draw fresh dice (a new seed each): within a few swipes the set differs from the first.
        let differs = JSON.stringify(drawn(host).list) !== JSON.stringify(first);
        for (let n = 0; n < 5 && !differs; n += 1) {
            await host.swipe(reply('Again.', TRY));
            differs = JSON.stringify(drawn(host).list) !== JSON.stringify(first);
        }
        assert.equal(differs, true, 'a swipe is a new try with new dice');
        await host.swipe(reply('The gate.', TRY));
        const before = summary(host);
        const kept = drawn(host).list;
        assert.equal((await host.sdk.reread(host.ctx.chat.length - 1)).ok, true);
        assert.deepEqual(drawn(host).list, kept, 'a Re-read keeps the dice');
        assert.equal(JSON.stringify(slice(host)), JSON.stringify(JSON.parse(before).textRpg), 'and the state');
        assert.equal(tries(host).length, 1);
        assert.deepEqual(host.turn.problems(), []);
    } finally {
        host.close();
    }
});

test('a Re-read of edited lines rolls them with the same dice', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('We sneak.', reply('The gate looms.', ['? try Astra | Lore | normal']));
        const [made] = tries(host);
        const at = host.ctx.chat.length - 1;
        host.ctx.chat[at].mes = host.ctx.chat[at].mes.replace('Lore | normal', 'Lore | hard');
        assert.equal((await host.sdk.reread(at)).ok, true);
        const [again] = tries(host);
        assert.equal(again.data.die, made.data.die, 'the same die');
        assert.equal(again.data.difficulty, 2, 'the new difficulty');
    } finally {
        host.close();
    }
});

test('rebuild == live, and a middle delete replays the surviving replies with the dice they were played with', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        const xp = size => `+ xp Party — a deed | size: ${size}`;
        await host.send('One.', reply('First.', ['? try Astra | Lore | normal', xp('real')]));
        const middleAt = host.ctx.chat.length;
        await host.send('Two.', reply('Second.', ['? try Astra | Obscure | hard | threat: above you', '~ condition Astra — poisoned | until: treated', xp('real')]));
        await host.send('Three.', reply('Third.', ['? try Astra | Lore | easy', xp('minor')]));
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'rebuild == live');
        assert.deepEqual(host.store.problems(), []);

        const all = tries(host).map(receipt => receipt.data);
        assert.equal(all.length, 3);
        const xpOf = host.store.receipts().map(entry => entry.receipt).filter(receipt => receipt.type === 'capture.xp').map(receipt => receipt.data.amount);
        await host.st.deleteMessage(middleAt + 1);
        await host.st.deleteMessage(middleAt);
        assert.deepEqual(host.store.problems(), [], 'the chat replays with no problem');
        const left = tries(host).map(receipt => receipt.data);
        assert.deepEqual(left.map(data => data.die), [all[0].die, all[2].die], 'each surviving reply keeps its own die');
        assert.deepEqual(astraOf(host).conditions, [], 'the middle reply\'s condition went with it');
        assert.equal(astraOf(host).xp, xpOf[0] + xpOf[2], 'and its xp: the later reply adds its change to what is there');
        const after = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), after);
    } finally {
        host.close();
    }
});

test('the live dice are the head\'s: the tail of every reply lists that reply\'s own', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('One.', reply('First.'));
        const first = drawn(host).list.join(', ');
        await host.send('Two.', reply('Second.'));
        const second = drawn(host).list.join(', ');
        const tails = host.st.promptLog.filter(entry => entry.key === 'story_suite_tail_1' && entry.value);
        assert.match(tails.at(-2).value, new RegExp(`in order: ${first}\\.`));
        assert.match(tails.at(-1).value, new RegExp(`in order: ${second}\\.`));
    } finally {
        host.close();
    }
});

test('a Re-read of an earlier reply uses that reply\'s own dice, not a later reply\'s, and changes nothing when the text is unchanged', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('One.', reply('First.', ['? try Astra | Lore | normal | threat: a fair match', '+ xp Party — a deed | size: real']));
        const firstAt = host.ctx.chat.length - 1;
        await host.send('Two.', reply('Second.', ['? try Astra | Lore | hard', '? try Astra | Obscure | normal']));
        const dice = tries(host).map(receipt => receipt.data.die);
        const live = JSON.stringify(host.head());
        assert.equal((await host.sdk.reread(firstAt)).ok, true);
        assert.deepEqual(tries(host).map(receipt => receipt.data.die), dice, 'every roll keeps its own die');
        assert.equal(JSON.stringify(host.head()), live, 'an unchanged Re-read changes nothing');
        assert.deepEqual(host.turn.problems(), []);
    } finally {
        host.close();
    }
});

test('a Re-read of a swiped reply that a later reply followed keeps the swipe\'s own dice', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('One.', reply('First.', ['? try Astra | Lore | normal']));
        await host.swipe(reply('First, again.', ['? try Astra | Lore | normal', '? try Astra | Lore | hard']));
        const firstAt = host.ctx.chat.length - 1;
        await host.send('Two.', reply('Second.', ['? try Astra | Lore | normal']));
        const dice = tries(host).map(receipt => receipt.data.die);
        const live = JSON.stringify(host.head());
        assert.equal((await host.sdk.reread(firstAt)).ok, true);
        assert.deepEqual(tries(host).map(receipt => receipt.data.die), dice);
        assert.equal(JSON.stringify(host.head()), live);
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'rebuild == live');
    } finally {
        host.close();
    }
});

test('a health stage and a rest are sets: after a middle delete they land where they say, not where deltas would', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('One.', reply('A.', ['~ health Astra — Wounded | why: a spear']));
        const middleAt = host.ctx.chat.length;
        await host.send('Two.', reply('B.', ['~ health Astra — Down | why: a fall']));
        await host.send('Three.', reply('C.', ['~ health Astra — Hurt']));
        assert.equal(astraOf(host).pools.hp.now, 22);
        await host.st.deleteMessage(middleAt + 1);
        await host.st.deleteMessage(middleAt);
        assert.deepEqual(host.store.problems(), []);
        assert.equal(astraOf(host).pools.hp.now, 22, 'Hurt is Hurt whatever the deleted reply did');
        await host.sdk.command('textRpg.rest', { kind: 'short' });
        assert.equal(astraOf(host).pools.sp.now, astraOf(host).pools.sp.max);
    } finally {
        host.close();
    }
});
