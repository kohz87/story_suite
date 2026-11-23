import test from 'node:test';
import assert from 'node:assert/strict';
import { BUY, astraOf, drawn, reply, slice, tries, withAstra } from './helpers/host.js';
import { practiceGain } from '../src/rules/growth.js';
import { harmFor } from '../src/rules/harm.js';
import { levelOf, pointsOf, woundsOf } from '../src/module-parts/standing.js';
import { effectiveStats, poolOf, skillActive } from '../src/module-parts/effective.js';
import { skillRows } from '../src/module-parts/sheet-skills.js';

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
        assert.equal(astraOf(host).practice.lore ?? 0, 0);
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
        assert.equal(astraOf(host).practice.obscure > 0, true, 'the middle reply taught Obscure');
        const xpOf = host.store.receipts().map(entry => entry.receipt).filter(receipt => receipt.type === 'capture.xp').map(receipt => receipt.data.amount);
        await host.st.deleteMessage(middleAt + 1);
        await host.st.deleteMessage(middleAt);
        assert.deepEqual(host.store.problems(), [], 'the chat replays with no problem');
        const left = tries(host).map(receipt => receipt.data);
        assert.deepEqual(left.map(data => data.die), [all[0].die, all[2].die], 'each surviving reply keeps its own die');
        assert.deepEqual(astraOf(host).conditions, [], 'the middle reply\'s condition went with it');
        assert.equal(astraOf(host).xp, xpOf[0] + xpOf[2], 'and its xp: the later reply adds its change to what is there');
        assert.equal(astraOf(host).practice.obscure ?? 0, 0, 'its practice went with it');
        assert.equal(astraOf(host).practice.lore ?? 0, [all[0], all[2]].reduce((sum, data) => sum + practiceGain(data.band, data.difficulty), 0), 'and the surviving replies keep theirs');
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
        assert.equal(astraOf(host).wounds, 2);
        await host.st.deleteMessage(middleAt + 1);
        await host.st.deleteMessage(middleAt);
        assert.deepEqual(host.store.problems(), []);
        assert.equal(astraOf(host).wounds, 2, 'Hurt is Hurt whatever the deleted reply did');
        await host.sdk.command('textRpg.rest', { kind: 'short' });
        assert.equal(astraOf(host).pools.sp.now, astraOf(host).pools.sp.max);
    } finally {
        host.close();
    }
});

test('wounds are a stage counter: a heal reply deleted between two failures leaves what a fresh telling of the two failures leaves', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        // Danger with a natural die cannot be chosen, so the wounds each surviving reply added are read from its own receipt.
        const hurt = ['? try Astra | Lore | very hard | threat: above you'];
        await host.send('One.', reply('First.', hurt));
        const healAt = host.ctx.chat.length;
        await host.send('Two.', reply('Second.', ['~ health Astra — Unhurt | why: a long rest']));
        await host.send('Three.', reply('Third.', hurt));
        await host.st.deleteMessage(healAt + 1);
        await host.st.deleteMessage(healAt);
        assert.deepEqual(host.store.problems(), []);
        let wounds = 0;
        for (const { data } of tries(host)) wounds += Math.min(harmFor(data.band, true), Math.max(0, 4 - wounds));
        assert.equal(tries(host).length, 2);
        assert.equal(woundsOf(astraOf(host)), wounds, 'the same stage as the two failures told fresh');
        const after = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), after, 'rebuild == live');
    } finally {
        host.close();
    }
});

test('level and points follow the xp that survives: deleting an early xp reply takes the later level-up with it', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        const rolled = ['? try Astra | Lore | normal', '+ xp Party — a deed | size: real'];
        await host.send('One.', reply('First.', ['? try Astra | Lore | hard', '+ xp Party — a deed | size: major']));
        const firstAt = host.ctx.chat.length - 1;
        await host.send('Two.', reply('Second.', rolled));
        await host.send('Three.', reply('Third.', rolled));
        assert.deepEqual([astraOf(host).xp, levelOf(astraOf(host)), pointsOf(astraOf(host))], [100, 2, 1]);
        await host.st.deleteMessage(firstAt + 1);
        await host.st.deleteMessage(firstAt);
        assert.deepEqual(host.store.problems(), []);
        // 40 xp is below level 2 (100): a fresh telling of the two surviving replies reads the same.
        assert.deepEqual([astraOf(host).xp, levelOf(astraOf(host)), pointsOf(astraOf(host))], [40, 1, 0]);
        const [row] = host.sdk.query('rpg.sheet');
        assert.deepEqual([row.level, row.points, host.sdk.query('party.levels')[0].level], [1, 0, 1], 'the rows the Party tab reads');
        assert.equal(Object.hasOwn(astraOf(host), 'level'), false, 'level is derived, not stored');
        assert.equal(Object.hasOwn(astraOf(host), 'points'), false, 'points are derived, not stored');
    } finally {
        host.close();
    }
});

test('a Re-read of an earlier reply that named no threat is not put in danger by a later reply\'s threat', async t => {
    t.mock.method(console, 'warn', () => {});
    for (let round = 0; round < 6; round += 1) {
        const host = await withAstra();
        try {
            await host.send('One.', reply('First.', ['? try Astra | Lore | very hard']));
            const firstAt = host.ctx.chat.length - 1;
            await host.send('Two.', reply('Second.', ['? try Astra | Lore | very hard | threat: above you']));
            const live = JSON.stringify(host.head());
            assert.equal((await host.sdk.reread(firstAt)).ok, true);
            assert.equal(JSON.stringify(host.head()), live, 'an unchanged Re-read changes nothing');
            host.store.rebuild();
            assert.equal(JSON.stringify(host.head()), live, 'rebuild == live');
        } finally {
            host.close();
        }
    }
});

test('a heal deleted between a wound and a failed try leaves Badly wounded, never Down, and the next try is used', async t => {
    t.mock.method(console, 'warn', () => {});
    for (let round = 0; round < 6; round += 1) {
        const host = await withAstra();
        try {
            await host.send('A.', reply('A.', ['~ health Astra — Badly wounded']));
            const healAt = host.ctx.chat.length;
            await host.send('H.', reply('H.', ['~ health Astra — Hurt']));
            await host.send('C.', reply('C.', ['? try Astra | Lore | normal | threat: beyond you']));
            await host.st.deleteMessage(healAt + 1);
            await host.st.deleteMessage(healAt);
            assert.equal(woundsOf(astraOf(host)), 4, 'Badly wounded, as a fresh telling of A then C');
            assert.equal(astraOf(host).down, false);
            await host.send('D.', reply('D.', ['? try Astra | Lore | normal']));
            assert.equal(tries(host).length, 2, 'the next try is used, not refused as Down');
            assert.deepEqual(host.store.problems(), []);
        } finally {
            host.close();
        }
    }
});

const MAJOR = ['? try Astra | Lore | hard | threat: above you', '+ xp Party — a deed | size: major'];
const dropReply = async (host, at) => { await host.st.deleteMessage(at + 1); await host.st.deleteMessage(at); };

test('a stat bought with a level\'s point goes back with the level, and comes back when a later reply re-levels', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        const at = host.ctx.chat.length;
        await host.send('One.', reply('First.', MAJOR));
        await host.send('Two.', reply('Second.', MAJOR));
        assert.equal(levelOf(astraOf(host)), 2);
        assert.equal((await host.sdk.command('textRpg.spend', { member: 'Astra', stats: { str: 1 } })).ok, true);
        assert.deepEqual([effectiveStats(astraOf(host)).str, pointsOf(astraOf(host)), poolOf(astraOf(host), 'sp').max], [8, 0, 24]);

        await dropReply(host, at);
        assert.deepEqual(host.store.problems(), []);
        const me = astraOf(host);
        assert.deepEqual([levelOf(me), effectiveStats(me).str, me.stats.str, pointsOf(me), poolOf(me, 'mp').max], [1, 7, 7, 0, 22], 'level 1: the base stat, no points');
        assert.equal(Object.keys(me.bought).length, 1, 'the purchase is kept, waiting');

        await host.send('Three.', reply('Third.', MAJOR));
        assert.deepEqual([levelOf(astraOf(host)), effectiveStats(astraOf(host)).str, pointsOf(astraOf(host))], [2, 8, 0], 'the level is back and so is the purchase');
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'rebuild == live');
    } finally {
        host.close();
    }
});

test('a skill learned into the level-10 slot is inactive without the level, refused in a try, and back with it', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra(undefined, undefined, { level: 9, stats: { ...BUY, str: 15 } });
    try {
        const at = host.ctx.chat.length;
        await host.send('One.', reply('First.', MAJOR));
        await host.send('Two.', reply('Second.', MAJOR));
        assert.equal(levelOf(astraOf(host)), 10);
        for (const name of ['Tracking', 'Knots', 'Haggling', 'Cooking']) {
            const made = await host.sdk.command('textRpg.skillEdit', { member: 'Astra', name, stat: 'wis' });
            assert.equal(made.ok, true, `${name} fits the slots of level 10`);
        }
        const cooking = () => astraOf(host).skills.find(skill => skill.name === 'Cooking');
        assert.equal(skillActive(astraOf(host), cooking()), true);

        await dropReply(host, at);
        assert.deepEqual(host.store.problems(), []);
        assert.equal(levelOf(astraOf(host)), 9);
        assert.equal(astraOf(host).skills.length, 6, 'the skill is still listed');
        assert.deepEqual(astraOf(host).skills.filter(skill => !skillActive(astraOf(host), skill)).map(skill => skill.name), ['Cooking'], 'the latest learned is the one inactive');
        assert.equal(skillRows(astraOf(host)).find(row => row.name === 'Cooking').inactive, true);
        const before = tries(host).length;
        await host.send('Three.', reply('Third.', ['? try Astra | Cooking | normal']));
        assert.equal(tries(host).length, before, 'an inactive skill cannot be used in a try');

        await host.send('Four.', reply('Fourth.', MAJOR));
        assert.equal(levelOf(astraOf(host)), 10);
        assert.equal(skillActive(astraOf(host), cooking()), true, 'back with the level');
        assert.deepEqual(host.store.problems(), []);
    } finally {
        host.close();
    }
});
