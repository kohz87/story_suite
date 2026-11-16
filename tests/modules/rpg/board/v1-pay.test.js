// What a v1 fight pays: tier XP for a win, practice for the skills it used, a legend for a foe 10 levels above the party; paid through the settle, once, whatever way the chat changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { rollReceipt } from '../helpers.js';
import { openFight, stage, step, v1Host } from './v1.helpers.js';

const CHAR = 'pack.chat/character', SKILLS = 'pack.chat/skills';
const mine = host => ({ xp: host.head().domains.dataModules.instances[CHAR].chat.fields.xp, practice: host.head().domains.dataModules.instances[SKILLS].chat.fields.practice1 });
const settled = (host, index = 2) => rollReceipt(host, index)?.data?.v2?.result;
const won = async options => {
    const made = await v1Host({ hero: { str: 30 }, ...options });
    assert.equal(openFight(made.host).ok, true);
    for (let at = 0; at < 14; at += 1) stage(made.host, step('skill'));
    await made.host.send('Go.', 'Done.');
    return made;
};

test('a won fight pays the tier\'s XP, once, and practice per use; a different tier pays a different amount', async () => {
    const restore = seedCrypto(5);
    const paid = {};
    try {
        // (Astra is level 5: a level 5 standard foe pays 15, a mob a quarter of that, an elite one and a half times)
        for (const [tier, xp] of [['standard', 15], ['mob', 3], ['elite', 22]]) {
            const { host } = await won({ count: 1, level: 5, tier });
            const got = settled(host);
            assert.equal(got.stop, 'won', tier);
            assert.deepEqual(got.paid.xp, [{ who: 'Astra', xp }], `${tier}: XP by tier`);
            assert.equal(mine(host).xp, xp, `${tier}: the block holds it`);
            paid[tier] = mine(host).practice;
            host.close();
        }
        assert.ok(Object.values(paid).every(practice => practice > 100), 'practice per use on the Cut skill');
    } finally { restore(); }
});

test('an unfinished fight pays practice but no XP', async () => {
    const restore = seedCrypto(6);
    const { host } = await v1Host({ count: 6, level: 30, tier: 'elite' });
    try {
        assert.equal(openFight(host).ok, true);
        stage(host, step('skill'));
        await host.send('Go.', 'One.');
        const got = settled(host);
        assert.notEqual(got.stop, 'won');
        assert.deepEqual(got.paid?.xp ?? [], []);
        assert.equal(mine(host).xp, 0);
        assert.ok(mine(host).practice >= 100, 'the practice of the skill it used is still paid');
    } finally { host.close(); restore(); }
});

test('a win against a foe 10 levels above the party earns the legend; 9 above does not', async () => {
    const restore = seedCrypto(7);
    try {
        for (const [level, legend] of [[15, 1], [14, undefined]]) {
            const { host } = await won({ count: 1, level, tier: 'mob' });
            assert.equal(settled(host).stop, 'won');
            assert.equal(settled(host).legend, legend, `level ${level}`);
            host.close();
        }
    } finally { restore(); }
});

test('the pay is the same after a swipe, swipe back, edited Re-read, rewind and reload (never paid twice, never lost)', async () => {
    const restore = seedCrypto(9);
    const { host } = await won({ count: 1, level: 5, tier: 'standard' });
    try {
        const was = mine(host);
        assert.equal(was.xp, 15);
        const live = JSON.stringify(host.head());
        const same = async label => {
            host.store.rebuild();
            assert.deepEqual(mine(host), was, `${label}: rebuilt`);
            await host.store.flush();
            const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
            await host.st.loadChat(chat, `pay-${label}`);
            host.ctx.chatMetadata = meta;
            assert.deepEqual(mine(host), was, `${label}: reloaded`);
        };
        await same('first');
        await host.swipe('Told again.');
        assert.deepEqual(mine(host), was, 'swipe: paid once, not twice');
        await host.st.swipeTo(2, 0);
        assert.equal(JSON.stringify(host.head()), live, 'swipe back: as before');
        const text = host.ctx.chat[2].mes;
        await host.st.editMessage(2, `${text}\nAnd more words.`);
        assert.equal((await host.sdk.reread(2)).ok, true);
        assert.deepEqual(mine(host), was, 'Re-read grown');
        await same('grown');
        await host.st.editMessage(2, text);
        assert.equal((await host.sdk.reread(2)).ok, true);
        assert.deepEqual(mine(host), was, 'Re-read shrunk');
        await same('shrunk');
        const entry = host.store.receipts().filter(item => item.index === 2).find(item => item.receipt.type === 'interaction.settle');
        assert.equal((await host.sdk.rewind({ index: entry.index, beforeRev: entry.receipt.rev })).ok, true);
        assert.deepEqual(mine(host), { xp: 0, practice: 100 }, 'rewind: nothing paid, as before the fight');
    } finally { host.close(); restore(); }
});

test('a middle delete (a later reply stays) takes the pay with the fight; live == rebuild == reload on the whole state', async () => {
    const restore = seedCrypto(10);
    const { host } = await won({ count: 1, level: 5, tier: 'standard' });
    try {
        await host.send('Later.', 'A later reply.');
        assert.equal(mine(host).xp, 15);
        await host.st.deleteMessage(2);
        await host.st.deleteMessage(1);
        assert.deepEqual(mine(host), { xp: 0, practice: 100 }, 'the pair with the fight is gone, so is its pay');
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'live == rebuild');
        await host.store.flush();
        const chat = structuredClone(host.ctx.chat), meta = structuredClone(host.ctx.chatMetadata);
        await host.st.loadChat(chat, 'pay-delete');
        host.ctx.chatMetadata = meta;
        assert.equal(JSON.stringify(host.head()), live, 'reload == live');
    } finally { host.close(); restore(); }
});

test('the highest pay still passes the award\'s own check: 60 XP at the 300 % rate, and a use count clamped to 99', async () => {
    const { paidOf, awardCommand } = await import('../../../../modules/rpg/board/v1-award.js');
    const foes = Array.from({ length: 6 }, (_, at) => ({ id: `1.${at + 1}`, level: 99, tier: 'apex' }));
    const skills = [{ name: 'Cut', type: 'attack', stat: 'str' }];
    const rounds = Array.from({ length: 120 }, () => [['attack', 'Astra', 'skill', 'x', 10, 12, 5, 8, 'hit', 3, 4]]);
    const pay = paidOf({ result: 'win', foes, party: [{ id: 'astra', label: 'Astra', level: 1, skills }], rounds }, { rate: 300, practice: 3 }, { modules: { astra: 'm' }, alive: new Set(['astra']) });
    assert.equal(pay.xp[0].xp, 180, '60 held, x3');
    assert.equal(pay.uses[0].n, 99);
    const ctx = { fail: (code, message) => { throw new Error(`${code}: ${message}`); }, draft: () => ({ instances: {} }), read: () => ({}), source: {} };
    assert.doesNotThrow(() => awardCommand(ctx, { xp: pay.xp, uses: pay.uses, perUse: pay.perUse }));
});
